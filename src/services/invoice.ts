import { calendarDate, isOutstanding } from '../utils/invoiceValues';
import { resolvePhotos } from './jobPhotos';
import { supabase } from './supabase';
import { Invoice, InvoiceFormData, InvoiceItem } from '../types';

export const invoiceService = {
  async createInvoice(formData: InvoiceFormData, requestId: string, invoiceId?: string): Promise<Invoice> {
    const { data, error } = await supabase.rpc('save_invoice_draft', {
      p_payload: {
        ...formData,
        issue_date: calendarDate(formData.issue_date),
        due_date: calendarDate(formData.due_date),
      },
      p_request_id: requestId,
      p_invoice_id: invoiceId || null,
    });
    if (error) throw error;
    return data;
  },

  async getInvoices(status?: string, startDate?: string, endDate?: string, documentType: 'quote' | 'invoice' = 'invoice'): Promise<Invoice[]> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    let query = supabase
      .from('invoices')
      .select('*, customer:customers(*), items:invoice_items(*)')
      .eq('document_type', documentType)
      .eq('user_id', session.data.session.user.id)
      .order('created_at', { ascending: false });

    if (status === 'voided') {
      query = query.eq('status', 'void');
    } else if (status === 'unpaid') {
      // Unpaid = not paid and not void (includes draft, sent, overdue)
      query = query.in('status', ['sent', 'overdue']);
    } else if (status) {
      query = query.eq('status', status);
    } else {
      // When showing 'all', exclude voided invoices by default
      query = query.neq('status', 'void');
    }

    // Add date range filtering
    if (startDate) {
      query = query.gte('issue_date', startDate.split('T')[0]);
    }
    if (endDate) {
      query = query.lte('issue_date', endDate.split('T')[0]);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getInvoice(id: string): Promise<Invoice> {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, customer:customers(*), items:invoice_items(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    const customer = data.customer;
    return {
      ...data,
      photos: await resolvePhotos(data.photos || []),
      items: (data.items || []).sort((a: InvoiceItem, b: InvoiceItem) => a.sort_order - b.sort_order),
      customer: (customer || data.customer_name) ? {
        ...customer,
        id: customer?.id || '',
        user_id: data.user_id,
        name: data.customer_name || customer?.name,
        email: data.customer_email ?? customer?.email,
        phone: data.customer_phone ?? customer?.phone,
      } : undefined,
    };
  },

  async approveQuote(id: string) {
    const { data, error } = await supabase.rpc('approve_quote', { p_invoice_id: id });
    if (error) throw error;
    return data as Invoice;
  },

  async updateJob(id: string, photos: Invoice['photos'], complete = false) {
    const { error } = await supabase.rpc('update_job', { p_invoice_id: id,
      p_photos: (photos || []).map(({ path, stage }) => ({ path, stage })), p_complete: complete });
    if (error) throw error;
  },

  async markInvoiceSent(id: string) {
    const { data, error } = await supabase.from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'draft').select('id').maybeSingle();
    if (error) throw error;
    if (!data) {
      const current = await this.getInvoice(id);
      if (!['sent', 'overdue'].includes(current.status)) {
        throw new Error('This invoice is no longer a draft. Refresh it before continuing.');
      }
    }
  },

  async updateInvoiceStatus(id: string, status: string) {
    const updateData: any = { status };
    
    // Set sent_at timestamp when marking as sent
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    }

    // Set paid_at timestamp when marking as paid
    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteInvoice(id: string) {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
  },

  async voidInvoice(id: string, reason: string) {
    const { data, error } = await supabase.rpc('void_invoice', {
      p_invoice_id: id,
      p_void_reason: reason,
    });

    if (error) throw error;
    return data;
  },

  async getDashboardStats(startDate?: string, endDate?: string) {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    const userId = session.data.session.user.id;

    // Get non-voided invoices
    let query = supabase
      .from('invoices')
      .select('status, total, due_date')
      .eq('user_id', userId)
      .eq('document_type', 'invoice')
      .neq('status', 'void');

    // Add date range filtering
    if (startDate) {
      query = query.gte('issue_date', startDate.split('T')[0]);
    }
    if (endDate) {
      query = query.lte('issue_date', endDate.split('T')[0]);
    }

    const { data: invoices, error } = await query;

    if (error) throw error;

    // Get voided count separately
    let voidQuery = supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('document_type', 'invoice').eq('status', 'void');

    // Add date range filtering for voided count
    if (startDate) {
      voidQuery = voidQuery.gte('issue_date', startDate.split('T')[0]);
    }
    if (endDate) {
      voidQuery = voidQuery.lte('issue_date', endDate.split('T')[0]);
    }

    const { count: voidedCount, error: voidError } = await voidQuery;

    if (voidError) throw voidError;

    const stats = {
      total: invoices?.length || 0,
      paid: invoices?.filter((i) => i.status === 'paid').length || 0,
      unpaid: invoices?.filter((i) => isOutstanding(i.status)).length || 0,
      voided: voidedCount || 0,
      overdueAmount: invoices?.filter(i => isOutstanding(i.status) && i.due_date < calendarDate(new Date())).reduce((sum, i) => sum + Number(i.total), 0) || 0,
      totalAmount: invoices?.reduce((sum, i) => sum + Number(i.total), 0) || 0,
      paidAmount:
        invoices
          ?.filter((i) => i.status === 'paid')
          .reduce((sum, i) => sum + Number(i.total), 0) || 0,
      unpaidAmount:
        invoices
          ?.filter((i) => isOutstanding(i.status))
          .reduce((sum, i) => sum + Number(i.total), 0) || 0,
    };

    return stats;
  },

  async getMonthlyReports(year: number) {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    const userId = session.data.session.user.id;

    // Get all invoices for the year (excluding voided)
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('issue_date, status, total')
      .eq('user_id', userId)
      .neq('status', 'void')
      .eq('document_type', 'invoice')
      .gte('issue_date', startDate)
      .lte('issue_date', endDate);

    if (error) throw error;

    // Group by month
    const monthlyData: { [key: string]: any } = {};

    invoices?.forEach((invoice) => {
      const month = invoice.issue_date.slice(5, 7);
      const key = month;

      if (!monthlyData[key]) {
        monthlyData[key] = {
          month,
          year,
          totalInvoices: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          paidCount: 0,
          unpaidCount: 0,
        };
      }

      monthlyData[key].totalInvoices++;
      
      if (invoice.status === 'paid') {
        monthlyData[key].paidAmount += Number(invoice.total);
        monthlyData[key].paidCount++;
      } else if (isOutstanding(invoice.status)) {
        monthlyData[key].unpaidAmount += Number(invoice.total);
        monthlyData[key].unpaidCount++;
      }
    });

    // Convert to array and sort by month
    const reports = Object.values(monthlyData).sort((a: any, b: any) => 
      parseInt(a.month) - parseInt(b.month)
    );

    return reports;
  },
};
