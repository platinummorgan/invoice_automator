import Stripe from 'stripe';
import { supabase } from './supabase';
import * as Sharing from 'expo-sharing';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export const paymentService = {
  async createPaymentLink(invoiceId: string): Promise<string> {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, customer:customers(*)')
      .eq('id', invoiceId)
      .single();

    if (error) throw error;

    // Create Stripe payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.notes || undefined,
            },
            unit_amount: Math.round(invoice.total * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.EXPO_PUBLIC_APP_URL || 'https://app.invoiceautomator.com'}/payment-success?invoice=${invoiceId}`,
        },
      },
    });

    // Update invoice with payment link
    await supabase
      .from('invoices')
      .update({
        stripe_payment_link: paymentLink.url,
        status: 'sent',
      })
      .eq('id', invoiceId);

    return paymentLink.url;
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

  async handleWebhook(event: any) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        const invoiceId = paymentIntent.metadata.invoice_id;

        if (invoiceId) {
          // Update invoice status
          await supabase
            .from('invoices')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', invoiceId);

          // Create payment record
          await supabase.from('payment_records').insert({
            invoice_id: invoiceId,
            stripe_payment_intent_id: paymentIntent.id,
            stripe_charge_id: paymentIntent.latest_charge,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: 'succeeded',
          });

          // TODO: Send receipt email and push notification
        }
        break;

      case 'payment_intent.payment_failed':
        // Handle failed payment
        break;
    }
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
