import { supabase } from './supabase';
import * as Sharing from 'expo-sharing';

export const paymentService = {
  async createPaymentLink(invoiceId: string): Promise<string> {
    // Note: Payment link generation should be done via a backend API call
    // For MVP, we'll call a Supabase Edge Function to generate the Stripe link
    
    const { data, error } = await supabase.functions.invoke('create-payment-link', {
      body: { invoiceId },
    });

    if (error) throw error;
    
    if (!data?.paymentLink) {
      throw new Error('Failed to generate payment link');
    }

    // Update invoice with payment link
    await supabase
      .from('invoices')
      .update({
        stripe_payment_link: data.paymentLink,
        status: 'sent',
      })
      .eq('id', invoiceId);

    return data.paymentLink;
  },

  async sharePaymentLink(paymentLink: string, invoiceNumber: string) {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    // Create a shareable message
    const message = `Pay Invoice ${invoiceNumber}: ${paymentLink}`;

    // On mobile, we can't share just text with expo-sharing
    // We'd need to create a temporary file or use Share API from react-native
    // For now, return the message for the app to handle
    return message;
  },

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
};
