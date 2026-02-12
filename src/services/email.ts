import { resolveTemplateSettings } from './templateSettings';
import * as MailComposer from 'expo-mail-composer';
import * as Linking from 'expo-linking';
import { Share } from 'react-native';
import {
  BusinessPaymentMethod,
  Invoice,
  InvoiceItem,
  Customer,
  InvoiceTemplate,
  InvoiceTemplateSettings,
} from '../types';

type DeviceEmailStatus = 'sent' | 'saved' | 'cancelled' | 'undetermined' | 'unavailable';

interface SendInvoiceEmailParams {
  invoice: Invoice;
  items: InvoiceItem[];
  customer: Customer;
  paymentLink?: string;
  paymentMethods?: BusinessPaymentMethod[] | null;
  paymentInstructions?: string;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  logoUrl?: string;
  invoiceTemplate?: InvoiceTemplate;
  templateSettings?: Partial<InvoiceTemplateSettings>;
}

interface SendReceiptEmailParams {
  invoice: Invoice;
  items: InvoiceItem[];
  customer: Customer;
  paidAt?: string;
  paymentMethodLabel?: string;
  receiptReference?: string;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  logoUrl?: string;
  invoiceTemplate?: InvoiceTemplate;
  templateSettings?: Partial<InvoiceTemplateSettings>;
}

type SendDeviceEmailResult =
  | { success: true; status: DeviceEmailStatus }
  | { success: false; status: DeviceEmailStatus; error?: string };

function hexToRgba(hexColor: string, alpha: number) {
  const sanitized = hexColor.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(sanitized)) {
    return `rgba(59,130,246,${alpha})`;
  }
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getTemplateColors(template?: InvoiceTemplate, accentColor?: string) {
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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHttpUrl(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? escapeHtml(trimmed) : '';
}

function htmlToPlainText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');

  const withNewlines = withoutScripts
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n');

  const withoutTags = withNewlines.replace(/<[^>]+>/g, '');
  return withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function openDeviceEmailComposer({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendDeviceEmailResult> {
  const plainText = (text && text.trim().length > 0 ? text : htmlToPlainText(html)).trim();

  try {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (isAvailable) {
      const result = await MailComposer.composeAsync({
        recipients: [to],
        subject,
        body: html,
        isHtml: true,
      });

      const status = (result?.status || 'undetermined') as DeviceEmailStatus;
      if (status === 'cancelled') return { success: false, status };
      return { success: true, status };
    }
  } catch (error: any) {
    // Fall through to a mailto/share fallback.
    console.warn('MailComposer failed, falling back:', error?.message || error);
  }

  try {
    const mailtoUrl =
      `mailto:${encodeURIComponent(to)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(plainText)}`;

    const canOpen = await Linking.canOpenURL(mailtoUrl);
    if (canOpen) {
      await Linking.openURL(mailtoUrl);
      return { success: true, status: 'undetermined' };
    }
  } catch (error: any) {
    console.warn('mailto fallback failed:', error?.message || error);
  }

  try {
    await Share.share({
      message: `${subject}\n\n${plainText}`,
    });
    return { success: true, status: 'undetermined' };
  } catch (error: any) {
    return { success: false, status: 'unavailable', error: error?.message || 'No email app available.' };
  }
}

/**
 * Open the device email composer for an invoice (uses the business owner's email account on-device).
 */
export async function sendInvoiceEmail({
  invoice,
  items,
  customer,
  paymentLink,
  paymentMethods,
  paymentInstructions,
  businessName,
  businessAddress,
  businessPhone,
  logoUrl,
  invoiceTemplate,
  templateSettings,
}: SendInvoiceEmailParams): Promise<SendDeviceEmailResult> {
  try {
    if (!customer.email) {
      throw new Error('Customer email is required to send invoice.');
    }

    const emailHtml = generateInvoiceEmailHTML({
      invoice,
      items,
      customer,
      paymentLink,
      paymentMethods,
      paymentInstructions,
      businessName,
      businessAddress,
      businessPhone,
      logoUrl,
      invoiceTemplate,
      templateSettings,
    });

    return await openDeviceEmailComposer({
      to: customer.email,
      subject: `Invoice #${invoice.invoice_number} - Payment Requested`,
      html: emailHtml,
    });
  } catch (error: any) {
    console.error('Error sending invoice email:', error);
    return {
      success: false,
      status: 'unavailable',
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Open the device email composer for a receipt (uses the business owner's email account on-device).
 */
export async function sendReceiptEmail({
  invoice,
  items,
  customer,
  paidAt,
  paymentMethodLabel,
  receiptReference,
  businessName,
  businessAddress,
  businessPhone,
  logoUrl,
  invoiceTemplate,
  templateSettings,
}: SendReceiptEmailParams): Promise<SendDeviceEmailResult> {
  try {
    if (!customer.email) {
      throw new Error('Customer email is required to send receipt.');
    }

    const emailHtml = generateReceiptEmailHTML({
      invoice,
      items,
      customer,
      paidAt,
      paymentMethodLabel,
      receiptReference,
      businessName,
      businessAddress,
      businessPhone,
      logoUrl,
      invoiceTemplate,
      templateSettings,
    });

    return await openDeviceEmailComposer({
      to: customer.email,
      subject: `Receipt: Invoice #${invoice.invoice_number} Paid`,
      html: emailHtml,
    });
  } catch (error: any) {
    console.error('Error sending receipt email:', error);
    return {
      success: false,
      status: 'unavailable',
      error: error.message || 'Failed to send receipt email',
    };
  }
}

/**
 * Generate HTML email template for invoice
 */
function generateInvoiceEmailHTML({
  invoice,
  items,
  customer,
  paymentLink,
  paymentMethods,
  paymentInstructions,
  businessName,
  businessAddress,
  businessPhone,
  logoUrl,
  invoiceTemplate,
  templateSettings,
}: SendInvoiceEmailParams): string {
  const resolvedTemplateSettings = resolveTemplateSettings(templateSettings, invoiceTemplate);
  const colors = getTemplateColors(invoiceTemplate, resolvedTemplateSettings.accent_color);
  const displayBusinessName = businessName || 'Swift Invoice';
  const safeDisplayBusinessName = escapeHtml(displayBusinessName);
  const safeInvoiceNumber = escapeHtml(invoice.invoice_number);
  const safeCustomerName = escapeHtml(customer.name);
  const safeCustomerEmail = escapeHtml(customer.email);
  const safeCustomerPhone = escapeHtml(customer.phone);
  const safeBusinessPhone = escapeHtml(businessPhone);
  const safeBusinessAddress = escapeHtml(businessAddress);
  const safeLogoUrl = safeHttpUrl(logoUrl);
  const safePaymentLink = safeHttpUrl(paymentLink);
  const safePaymentInstructions = escapeHtml(paymentInstructions);
  const safePaymentMethods = Array.isArray(paymentMethods)
    ? paymentMethods
        .map((method) => {
          const label = escapeHtml(method?.label || '');
          const rawValue = String(method?.value || '').trim();
          if (!label || !rawValue) return null;
          return {
            label,
            value: escapeHtml(rawValue),
            link: safeHttpUrl(rawValue),
          };
        })
        .filter((method): method is { label: string; value: string; link: string } => !!method)
    : [];
  const safeInvoiceNotes = escapeHtml(invoice.notes);
  const safeFooterText = escapeHtml(resolvedTemplateSettings.footer_text);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const itemsHTML = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.amount)}</td>
    </tr>
  `
    )
    .join('');

  const businessContactHtml =
    resolvedTemplateSettings.show_business_contact
      ? `
      ${businessPhone ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted};">${safeBusinessPhone}</p>` : ''}
      ${businessAddress ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted};">${safeBusinessAddress}</p>` : ''}
    `
      : '';

  const headerHtml =
    resolvedTemplateSettings.header_layout === 'inline'
      ? `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
          ${resolvedTemplateSettings.show_logo && safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Business logo" style="max-width: 120px; max-height: 44px; width: auto; height: auto;" />` : ''}
          <div>
            <h1 style="margin: 0; font-size: 22px; color: ${colors.accent};">${safeDisplayBusinessName}</h1>
            ${businessContactHtml}
          </div>
        </div>
        <p style="margin: 0; font-size: 18px; color: #1f2937; font-weight: 600;">#${safeInvoiceNumber}</p>
      </div>
    `
      : `
      ${resolvedTemplateSettings.show_logo && safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Business logo" style="max-width: 220px; max-height: 70px; width: auto; height: auto; margin: 0 auto 12px auto; display: block;" />` : ''}
      <h1 style="margin: 0; font-size: 26px; color: ${colors.accent};">${safeDisplayBusinessName}</h1>
      ${businessContactHtml}
      <p style="margin: 10px 0 0 0; font-size: 18px; color: #1f2937; font-weight: 600;">Invoice #${safeInvoiceNumber}</p>
    `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${safeInvoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background-color: #ffffff; padding: 32px 30px; border-radius: 8px 8px 0 0; text-align: center; border-bottom: 3px solid ${colors.accent};">
      ${headerHtml}
    </div>

    <!-- Invoice Details -->
    <div style="background-color: #ffffff; padding: 30px;">
      <div style="margin-bottom: 30px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; color: ${colors.textMuted};">To:</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${safeCustomerName}</p>
        ${customer.email ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: ${colors.textMuted};">${safeCustomerEmail}</p>` : ''}
        ${customer.phone ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: ${colors.textMuted};">${safeCustomerPhone}</p>` : ''}
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
        <div>
          <p style="margin: 0 0 5px 0; font-size: 14px; color: ${colors.textMuted};">Issue Date</p>
          <p style="margin: 0; font-size: 16px; color: #1f2937;">${formatDate(invoice.issue_date)}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0 0 5px 0; font-size: 14px; color: ${colors.textMuted};">Due Date</p>
          <p style="margin: 0; font-size: 16px; color: #1f2937;">${formatDate(invoice.due_date)}</p>
        </div>
      </div>

      <!-- Line Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: ${colors.accentLight};">
            <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: ${colors.textMuted}; border-bottom: 2px solid #e5e7eb;">Description</th>
            <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: ${colors.textMuted}; border-bottom: 2px solid #e5e7eb;">Qty</th>
            <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: ${colors.textMuted}; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
            <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: ${colors.textMuted}; border-bottom: 2px solid #e5e7eb;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <!-- Totals -->
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
          <span style="font-size: 18px; font-weight: 700; color: #1f2937;">Total Due</span>
          <span style="font-size: 18px; font-weight: 700; color: ${resolvedTemplateSettings.highlight_totals ? colors.accent : '#1f2937'};">${formatCurrency(invoice.total)}</span>
        </div>
      </div>

      ${resolvedTemplateSettings.show_notes && invoice.notes ? `
      <div style="margin-top: 30px; padding: 15px; background-color: ${colors.accentLight}; border-radius: 6px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; font-weight: 600; color: ${colors.textMuted};">Notes</p>
        <p style="margin: 0; font-size: 14px; color: #1f2937; white-space: pre-wrap;">${safeInvoiceNotes}</p>
      </div>
      ` : ''}
    </div>

    <!-- Payment Section -->
    <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; text-align: center;">
      ${safePaymentLink ? `
        <a href="${safePaymentLink}" style="display: inline-block; background-color: ${colors.accent}; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; margin-bottom: 15px;">Pay Invoice Now</a>
        <p style="margin: 15px 0 0 0; font-size: 12px; color: ${colors.textMuted};">Click the button above to securely pay with card</p>
      ` : ''}
      
      ${safePaymentMethods.length > 0 ? `
        <div style="margin-top: ${safePaymentLink ? '20px' : '0'}; padding: 20px; background-color: ${colors.accentLight}; border-radius: 8px; text-align: left;">
          <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #1f2937;">Payment Methods:</p>
          ${safePaymentMethods
            .map(
              (method) => `
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #4b5563;">
                  <span style="font-weight: 600; color: #1f2937;">${method.label}:</span>
                  ${
                    method.link
                      ? `<a href="${method.link}" style="color: ${colors.accent}; text-decoration: none;"> ${method.value}</a>`
                      : ` ${method.value}`
                  }
                </p>
              `
            )
            .join('')}
        </div>
      ` : ''}

      ${paymentInstructions ? `
        <div style="margin-top: ${safePaymentLink || safePaymentMethods.length > 0 ? '20px' : '0'}; padding: 20px; background-color: ${colors.accentLight}; border-radius: 8px; text-align: left;">
          <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #1f2937;">Payment Instructions:</p>
          <p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">${safePaymentInstructions}</p>
        </div>
      ` : ''}
      
      ${!safePaymentLink && !paymentInstructions && safePaymentMethods.length === 0 ? `
        <p style="margin: 0; font-size: 14px; color: ${colors.textMuted};">Please contact us for payment instructions.</p>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="margin-top: 20px; text-align: center; padding: 20px;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">${safeFooterText}</p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">If you have any questions, please reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML email template for payment receipt
 */
function generateReceiptEmailHTML({
  invoice,
  items,
  customer,
  paidAt,
  paymentMethodLabel,
  receiptReference,
  businessName,
  businessAddress,
  businessPhone,
  logoUrl,
  invoiceTemplate,
  templateSettings,
}: SendReceiptEmailParams): string {
  const resolvedTemplateSettings = resolveTemplateSettings(templateSettings, invoiceTemplate);
  const colors = getTemplateColors(invoiceTemplate, resolvedTemplateSettings.accent_color);
  const displayBusinessName = businessName || 'Swift Invoice';
  const safeDisplayBusinessName = escapeHtml(displayBusinessName);
  const safeInvoiceNumber = escapeHtml(invoice.invoice_number);
  const safeCustomerName = escapeHtml(customer.name);
  const safeCustomerEmail = escapeHtml(customer.email);
  const safeCustomerPhone = escapeHtml(customer.phone);
  const safeBusinessPhone = escapeHtml(businessPhone);
  const safeBusinessAddress = escapeHtml(businessAddress);
  const safeLogoUrl = safeHttpUrl(logoUrl);
  const safePaymentMethodLabel = escapeHtml(paymentMethodLabel || 'Card / Manual');
  const safeReceiptReference = escapeHtml(receiptReference || invoice.invoice_number);
  const safeInvoiceNotes = escapeHtml(invoice.notes);
  const safeFooterText = escapeHtml(resolvedTemplateSettings.footer_text);

  const formatCurrency = (amount: number) => {
    const value = Number(amount || 0);
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const lineItems = items || [];
  const itemsHTML =
    lineItems.length > 0
      ? lineItems
          .map(
            (item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.description)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
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
    resolvedTemplateSettings.show_business_contact
      ? `
      ${businessPhone ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted};">${safeBusinessPhone}</p>` : ''}
      ${businessAddress ? `<p style="margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted};">${safeBusinessAddress}</p>` : ''}
    `
      : '';

  const headerHtml =
    resolvedTemplateSettings.header_layout === 'inline'
      ? `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 10px; text-align: left;">
          ${resolvedTemplateSettings.show_logo && safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Business logo" style="max-width: 120px; max-height: 44px; width: auto; height: auto;" />` : ''}
          <div>
            <h1 style="margin: 0; font-size: 22px; color: ${colors.accent};">${safeDisplayBusinessName}</h1>
            ${businessContactHtml}
          </div>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 18px; color: #1f2937; font-weight: 700;">Receipt</p>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted};">Invoice #${safeInvoiceNumber}</p>
        </div>
      </div>
    `
      : `
      ${resolvedTemplateSettings.show_logo && safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Business logo" style="max-width: 220px; max-height: 70px; width: auto; height: auto; margin: 0 auto 12px auto; display: block;" />` : ''}
      <h1 style="margin: 0; font-size: 26px; color: ${colors.accent};">${safeDisplayBusinessName}</h1>
      ${businessContactHtml}
      <p style="margin: 12px 0 0 0; font-size: 20px; color: #1f2937; font-weight: 700;">Payment Receipt</p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: ${colors.textMuted};">Invoice #${safeInvoiceNumber}</p>
    `;

  const resolvedPaidAt = paidAt || invoice.paid_at || new Date().toISOString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - Invoice #${safeInvoiceNumber}</title>
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
          <p style="margin: 6px 0 0 0; font-size: 16px; color: #1f2937; font-weight: 600;">${formatDate(resolvedPaidAt)}</p>
        </div>
      </div>

      <div style="margin-bottom: 28px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; color: ${colors.textMuted};">Billed To:</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${safeCustomerName}</p>
        ${customer.email ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: ${colors.textMuted};">${safeCustomerEmail}</p>` : ''}
        ${customer.phone ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: ${colors.textMuted};">${safeCustomerPhone}</p>` : ''}
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
          <span style="font-size: 18px; font-weight: 700; color: ${resolvedTemplateSettings.highlight_totals ? colors.accent : '#1f2937'};">${formatCurrency(invoice.total)}</span>
        </div>
      </div>

      <div style="margin-top: 24px; padding: 14px; background-color: ${colors.accentLight}; border-radius: 6px;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: ${colors.textMuted}; font-weight: 600;">Payment Details</p>
        <p style="margin: 0; font-size: 14px; color: #1f2937;">Method: ${safePaymentMethodLabel}</p>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #1f2937;">Reference: ${safeReceiptReference}</p>
      </div>

      ${resolvedTemplateSettings.show_notes && invoice.notes ? `
      <div style="margin-top: 24px; padding: 14px; background-color: ${colors.accentLight}; border-radius: 6px;">
        <p style="margin: 0 0 5px 0; font-size: 13px; font-weight: 600; color: ${colors.textMuted};">Notes</p>
        <p style="margin: 0; font-size: 14px; color: #1f2937; white-space: pre-wrap;">${safeInvoiceNotes}</p>
      </div>
      ` : ''}
    </div>

    <div style="margin-top: 20px; text-align: center; padding: 20px;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">${safeFooterText}</p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">This receipt confirms payment was received in full.</p>
    </div>
  </div>
</body>
</html>
  `;
}
