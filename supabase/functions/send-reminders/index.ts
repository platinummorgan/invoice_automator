// Supabase Edge Function: send-reminders
// Deploy: supabase functions deploy send-reminders
// Schedule: Run daily via Supabase Cron

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';

    // Get overdue invoices that need reminders
    const overdueResponse = await fetch(
      `${supabaseUrl}/rest/v1/invoices?status=in.(sent,overdue)&select=*,customer:customers(*),profile:profiles(*)`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    const invoices = await overdueResponse.json();
    const now = new Date();
    const remindersToSend = [];

    for (const invoice of invoices) {
      const dueDate = new Date(invoice.due_date);
      const daysSinceDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const lastReminder = invoice.last_reminder_sent_at
        ? new Date(invoice.last_reminder_sent_at)
        : null;
      const daysSinceLastReminder = lastReminder
        ? Math.floor((now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Send reminder if:
      // 1. Invoice is due in 3 days (first reminder)
      // 2. Invoice is overdue and it's been 7+ days since last reminder
      const shouldSendReminder =
        (daysSinceDue === -3 && !lastReminder) ||
        (daysSinceDue >= 0 && daysSinceLastReminder >= 7);

      if (shouldSendReminder && invoice.customer?.email) {
        remindersToSend.push(invoice);
      }
    }

    // Send reminder emails via Resend
    const results = [];
    for (const invoice of remindersToSend) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Invoice Automator <invoices@yourdomain.com>',
            to: [invoice.customer.email],
            subject: `Payment Reminder: Invoice ${invoice.invoice_number}`,
            html: `
              <h2>Payment Reminder</h2>
              <p>Hi ${invoice.customer.name},</p>
              <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> 
              for <strong>$${invoice.total}</strong> is ${
                new Date(invoice.due_date) > now ? 'due soon' : 'overdue'
              }.</p>
              <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
              ${
                invoice.stripe_payment_link
                  ? `<p><a href="${invoice.stripe_payment_link}" style="display: inline-block; padding: 12px 24px; background-color: #007AFF; color: white; text-decoration: none; border-radius: 6px;">Pay Now</a></p>`
                  : ''
              }
              <p>Thank you,<br>${invoice.profile?.business_name || invoice.profile?.full_name || 'Invoice Automator'}</p>
            `,
          }),
        });

        if (emailResponse.ok) {
          // Update invoice reminder tracking
          await fetch(`${supabaseUrl}/rest/v1/invoices?id=eq.${invoice.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              last_reminder_sent_at: now.toISOString(),
              reminder_count: invoice.reminder_count + 1,
              status: 'overdue',
            }),
          });

          results.push({ invoice_id: invoice.id, status: 'sent' });
        }
      } catch (error) {
        console.error(`Failed to send reminder for invoice ${invoice.id}:`, error);
        results.push({ invoice_id: invoice.id, status: 'failed', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: results.filter((r) => r.status === 'sent').length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Reminder function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
