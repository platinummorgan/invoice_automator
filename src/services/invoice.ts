import { supabase } from './supabase';
import { Invoice, InvoiceFormData, InvoiceItem } from '../types';

export const invoiceService = {
  async createInvoice(formData: InvoiceFormData): Promise<Invoice> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    const userId = session.data.session.user.id;

    // Generate invoice number
    const { data: invoiceNumber, error: numberError } = await supabase.rpc(
      'generate_invoice_number',
      { p_user_id: userId }
    );

    if (numberError) throw numberError;

    // Calculate totals
    const subtotal = formData.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const taxAmount = subtotal * (formData.tax_rate / 100);
    const total = subtotal + taxAmount;

    // Create customer if needed
    let customerId = formData.customer_id;
    if (!customerId && formData.customer_name) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          user_id: userId,
          name: formData.customer_name,
          email: formData.customer_email,
          phone: formData.customer_phone,
        })
        .select()
        .single();

      if (customerError) throw customerError;
      customerId = customer.id;
    }

    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: userId,
        customer_id: customerId,
        customer_name: formData.customer_name, // Store name for history
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: formData.issue_date.toISOString().split('T')[0],
        due_date: formData.due_date.toISOString().split('T')[0],
        subtotal,
        tax_rate: formData.tax_rate,
        tax_amount: taxAmount,
        total,
        notes: formData.notes,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Create invoice items
    const items = formData.items.map((item, index) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.quantity * item.unit_price,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(items);

    if (itemsError) throw itemsError;

    // Increment user's invoice count
    await supabase.rpc('increment_invoice_count', { p_user_id: userId });

    return invoice;
  },

  async getInvoices(status?: string, startDate?: string, endDate?: string): Promise<Invoice[]> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    let query = supabase
      .from('invoices')
      .select('*, customer:customers(*), items:invoice_items(*)')
      .eq('user_id', session.data.session.user.id)
      .order('created_at', { ascending: false });

    if (status === 'voided') {
      query = query.eq('status', 'void');
    } else if (status === 'unpaid') {
      // Unpaid = not paid and not void (includes draft, sent, overdue)
      query = query.neq('status', 'paid').neq('status', 'void');
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
    return data;
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
      .select('status, total')
      .eq('user_id', userId)
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
      .eq('status', 'void');

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
      unpaid: invoices?.filter((i) => i.status !== 'paid').length || 0,
      voided: voidedCount || 0,
      totalAmount: invoices?.reduce((sum, i) => sum + Number(i.total), 0) || 0,
      paidAmount:
        invoices
          ?.filter((i) => i.status === 'paid')
          .reduce((sum, i) => sum + Number(i.total), 0) || 0,
      unpaidAmount:
        invoices
          ?.filter((i) => i.status !== 'paid')
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
      .gte('issue_date', startDate)
      .lte('issue_date', endDate);

    if (error) throw error;

    // Group by month
    const monthlyData: { [key: string]: any } = {};

    invoices?.forEach((invoice) => {
      const date = new Date(invoice.issue_date);
      const month = String(date.getMonth() + 1).padStart(2, '0');
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
      } else {
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
