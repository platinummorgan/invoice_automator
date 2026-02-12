import { supabase } from './supabase';

export const paymentService = {
  async getPaymentStatus(invoiceId: string) {
    const { data, error } = await supabase
      .from('payment_records')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async recordManualPayment(invoiceId: string, amount: number, paidAt?: string) {
    const { data, error } = await supabase
      .from('payment_records')
      .insert({
        invoice_id: invoiceId,
        amount,
        currency: 'usd',
        status: 'succeeded',
        paid_at: paidAt || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
