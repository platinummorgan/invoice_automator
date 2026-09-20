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

  async recordManualPayment(invoiceId: string) {
    const { data, error } = await supabase.rpc('record_manual_payment', {
      p_invoice_id: invoiceId,
    });

    if (error) throw error;
    return data;
  },
};
