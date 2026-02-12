// Supabase Edge Function: stripe-webhook
// Deploy: supabase functions deploy stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_URL = 'https://api.resend.com/emails';

function hexToRgba(hexColor: string, alpha: number) {
  const sanitized = (hexColor || '').replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(sanitized)) {
    return `rgba(59,130,246,${alpha})`;
  }
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveTemplateSettings(raw: any) {
  const defaults = {
    accent_color: '#3B82F6',
    header_layout: 'stacked',
    show_logo: true,
    show_business_contact: true,
    show_notes: true,
    highlight_totals: true,
    footer_text: 'Thank you for your business.',
  };

  const source = raw && typeof raw === 'object' ? raw : {};
  const accent = typeof source.accent_color === 'string' ? source.accent_color.trim() : '';
  const normalizedAccent = accent.startsWith('#') ? accent : `#${accent}`;

  return {
    accent_color: /^[#][0-9A-Fa-f]{6}$/.test(normalizedAccent)
      ? normalizedAccent.toUpperCase()
      : defaults.accent_color,
    header_layout: source.header_layout === 'inline' ? 'inline' : 'stacked',
    show_logo: source.show_logo !== false,
    show_business_contact: source.show_business_contact !== false,
    show_notes: source.show_notes !== false,
    highlight_totals: source.highlight_totals !== false,
    footer_text:
      typeof source.footer_text === 'string' && source.footer_text.trim().length > 0
        ? source.footer_text.trim().slice(0, 120)
        : defaults.footer_text,
  };
}

function getTemplateColors(template: string | undefined, accentColor: string) {
  const accent = accentColor || '#3B82F6';

  switch (template) {
    case 'painter':
      return {
        accent,
        accentLight: '#FFF4EA',
        textMuted: '#92400E',
      };
    case 'minimal':
      return {
        accent,
        accentLight: '#F8FAFC',
        textMuted: '#4B5563',
      };
    case 'classic':
    default:
      return {
        accent,
        accentLight: hexToRgba(accent, 0.08),
        textMuted: '#6b7280',
      };
  }
}

function formatCurrency(amount: number) {
  const value = Number(amount || 0);
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateString?: string) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function generateReceiptEmailHTML({
  invoice,
  profile,
  paidAt,
  reference,
}: {
  invoice: any;
  profile: any;
  paidAt: string;
  reference: string;
}) {
  const settings = resolveTemplateSettings(profile?.template_settings);
  const colors = getTemplateColors(profile?.invoice_template, settings.accent_color);
  const businessName = profile?.business_name || 'Swift Invoice';
  const customer = invoice?.customer || {};
  const items = Array.isArray(invoice?.items) ? invoice.items : [];

  const itemsHTML =
    items.length > 0
      ? items
          .map(
            (item: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description || 'Item'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.amount)}</td>
      </tr>
    `
          )
          .join('')
      : `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Invoice payment</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">1</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(invoice.total)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(invoice.total)}</td>
      </tr>
    `;

  const businessContactHtml =
    settings.show_business_contact
      ? `
      ${profile?.business_phone ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted};">${profile.business_phone}</p>` : ''}
      ${profile?.business_address ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted};">${profile.business_address}</p>` : ''}
    `
      : '';

  const headerHtml =
    settings.header_layout === 'inline'
      ? `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
          ${settings.show_logo && profile?.logo_url ? `<img src="${profile.logo_url}" alt="Business logo" style="max-width: 120px; max-height: 44px; width: auto; height: auto;" />` : ''}
          <div>
            <h1 style="margin: 0; font-size: 22px; color: ${colors.accent};">${businessName}</h1>
            ${businessContactHtml}
          </div>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 18px; color: #1f2937; font-weight: 700;">Receipt</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted};">Invoice #${invoice.invoice_number}</p>
        </div>
      </div>
    `
      : `
      ${settings.show_logo && profile?.logo_url ? `<img src="${profile.logo_url}" alt="Business logo" style="max-width: 220px; max-height: 70px; width: auto; height: auto; margin: 0 auto 12px auto; display: block;" />` : ''}
      <h1 style="margin: 0; font-size: 26px; color: ${colors.accent};">${businessName}</h1>
      ${businessContactHtml}
      <p style="margin: 12px 0 0 0; font-size: 20px; color: #1f2937; font-weight: 700;">Payment Receipt</p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: ${colors.textMuted};">Invoice #${invoice.invoice_number}</p>
    `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - Invoice #${invoice.invoice_number}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #ffffff; padding: 32px 30px; border-radius: 8px 8px 0 0; text-align: center; border-bottom: 3px solid ${colors.accent};">
      ${headerHtml}
    </div>

    <div style="background-color: #ffffff; padding: 30px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <p style="margin: 0; font-size: 14px; color: ${colors.textMuted};">Receipt Status</p>
          <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; color: #ffffff; background: #16a34a; border-radius: 999px; padding: 6px 10px; display: inline-block;">PAID</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 14px; color: ${colors.textMuted};">Paid On</p>
          <p style="margin: 6px 0 0 0; font-size: 16px; color: #1f2937; font-weight: 600;">${formatDate(paidAt)}</p>
        </div>
      </div>

      <div style="margin-bottom: 28px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; color: ${colors.textMuted};">Billed To:</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${customer.name || invoice.customer_name || 'Customer'}</p>
        ${customer.email ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: ${colors.textMuted};">${customer.email}</p>` : ''}
        ${customer.phone ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: ${colors.textMuted};">${customer.phone}</p>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: ${colors.accentLight};">
            <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: ${colors.textMuted}; border-bottom: 2px solid #e5e7eb;">Description</th>
            <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: ${colors.textMuted}; border-bottom: 2px solid #e5e7eb;">Qty</th>
            <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: ${colors.textMuted}; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
            <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: ${colors.textMuted}; border-bottom: 2px solid #e5e7eb;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div style="margin-left: auto; max-width: 300px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 14px; color: ${colors.textMuted};">Subtotal</span>
          <span style="font-size: 14px; color: #1f2937;">${formatCurrency(invoice.subtotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 14px; color: ${colors.textMuted};">Tax</span>
          <span style="font-size: 14px; color: #1f2937;">${formatCurrency(invoice.tax_amount)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px 0; background-color: ${colors.accentLight}; margin: 10px -15px 0 -15px; padding-left: 15px; padding-right: 15px;">
          <span style="font-size: 18px; font-weight: 700; color: #1f2937;">Total Paid</span>
          <span style="font-size: 18px; font-weight: 700; color: ${settings.highlight_totals ? colors.accent : '#1f2937'};">${formatCurrency(invoice.total)}</span>
        </div>
      </div>

      <div style="margin-top: 24px; padding: 14px; background-color: ${colors.accentLight}; border-radius: 6px;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: ${colors.textMuted}; font-weight: 600;">Payment Details</p>
        <p style="margin: 0; font-size: 14px; color: #1f2937;">Method: Card (Stripe)</p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #1f2937;">Reference: ${reference || invoice.invoice_number}</p>
      </div>

      ${settings.show_notes && invoice.notes ? `
      <div style="margin-top: 24px; padding: 14px; background-color: ${colors.accentLight}; border-radius: 6px;">
        <p style="margin: 0 0 5px 0; font-size: 13px; font-weight: 600; color: ${colors.textMuted};">Notes</p>
        <p style="margin: 0; font-size: 14px; color: #1f2937; white-space: pre-wrap;">${invoice.notes}</p>
      </div>
      ` : ''}
    </div>

    <div style="margin-top: 20px; text-align: center; padding: 20px;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">${settings.footer_text}</p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">This receipt confirms payment was received in full.</p>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendReceiptEmail({
  resendApiKey,
  invoice,
  profile,
  paidAt,
  reference,
}: {
  resendApiKey: string;
  invoice: any;
  profile: any;
  paidAt: string;
  reference: string;
}) {
  const customerEmail = invoice?.customer?.email;
  if (!customerEmail || !resendApiKey) return;

  const html = generateReceiptEmailHTML({ invoice, profile, paidAt, reference });

  const resendResponse = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: 'Swift Invoice <invoices@platovalabs.com>',
      to: [customerEmail],
      subject: `Receipt: Invoice #${invoice.invoice_number} Paid`,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const errorData = await resendResponse.text();
    throw new Error(`Failed to send receipt email: ${errorData}`);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Missing signature', { status: 400 });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    // Handle payment success
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const invoiceId = paymentIntent.metadata.invoice_id;

      if (invoiceId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
        const paidAt = new Date().toISOString();
        const latestCharge = paymentIntent.latest_charge as unknown;
        const stripeChargeId =
          typeof latestCharge === 'string'
            ? latestCharge
            : (latestCharge as { id?: string } | null)?.id;
        const amountReceived = (paymentIntent.amount_received || paymentIntent.amount || 0) / 100;

        // Update invoice status
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/invoices?id=eq.${invoiceId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            status: 'paid',
            paid_at: paidAt,
            stripe_payment_intent_id: paymentIntent.id,
          }),
        });

        if (!updateResponse.ok) {
          const errorBody = await updateResponse.text();
          throw new Error(`Failed to update invoice: ${errorBody}`);
        }

        // Create payment record
        const paymentRecordResponse = await fetch(
          `${supabaseUrl}/rest/v1/payment_records?on_conflict=stripe_payment_intent_id`,
          {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            invoice_id: invoiceId,
            stripe_payment_intent_id: paymentIntent.id,
            stripe_charge_id: stripeChargeId,
            amount: amountReceived,
            currency: paymentIntent.currency,
            status: 'succeeded',
            paid_at: paidAt,
          }),
        }
        );

        if (!paymentRecordResponse.ok) {
          const errorBody = await paymentRecordResponse.text();
          throw new Error(`Failed to create payment record: ${errorBody}`);
        }

        // Fetch complete invoice context for branded receipt email.
        const invoiceResponse = await fetch(
          `${supabaseUrl}/rest/v1/invoices?id=eq.${invoiceId}&select=*,customer:customers(*),items:invoice_items(*),profile:profiles(*)`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );

        if (!invoiceResponse.ok) {
          const errorBody = await invoiceResponse.text();
          throw new Error(`Failed to load invoice for receipt: ${errorBody}`);
        }

        const invoices = await invoiceResponse.json();
        const invoice = invoices?.[0];

        if (invoice?.customer?.email) {
          await sendReceiptEmail({
            resendApiKey,
            invoice,
            profile: invoice.profile,
            paidAt,
            reference: stripeChargeId || paymentIntent.id,
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown webhook error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
