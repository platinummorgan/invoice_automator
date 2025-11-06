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

  async getInvoices(status?: string): Promise<Invoice[]> {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    let query = supabase
      .from('invoices')
      .select('*, customer:customers(*), items:invoice_items(*)')
      .eq('user_id', session.data.session.user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
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
    const { data, error } = await supabase
      .from('invoices')
      .update({ status })
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

  async getDashboardStats() {
    const session = await supabase.auth.getSession();
    if (!session.data.session?.user) throw new Error('Not authenticated');

    const userId = session.data.session.user.id;

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('status, total')
      .eq('user_id', userId);

    if (error) throw error;

    const stats = {
      total: invoices?.length || 0,
      paid: invoices?.filter((i) => i.status === 'paid').length || 0,
      unpaid: invoices?.filter((i) => i.status !== 'paid').length || 0,
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
};
