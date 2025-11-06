import { Invoice, InvoiceItem, Customer } from '../types';

const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_API_KEY;
const RESEND_API_URL = 'https://api.resend.com/emails';

interface SendInvoiceEmailParams {
  invoice: Invoice;
  items: InvoiceItem[];
  customer: Customer;
  paymentLink?: string;
  paymentInstructions?: string;
}

/**
 * Send an invoice email to the customer via Resend API
 */
export async function sendInvoiceEmail({
  invoice,
  items,
  customer,
  paymentLink,
  paymentInstructions,
}: SendInvoiceEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!RESEND_API_KEY || RESEND_API_KEY === 'your_resend_api_key') {
      throw new Error('Resend API key not configured. Please add RESEND_API_KEY to .env file.');
    }

    if (!customer.email) {
      throw new Error('Customer email is required to send invoice.');
    }

    const emailHtml = generateInvoiceEmailHTML({
      invoice,
      items,
      customer,
      paymentLink,
      paymentInstructions,
    });

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Swift Invoice <invoices@platovalabs.com>',
        to: [customer.email],
        subject: `Invoice #${invoice.invoice_number} - Payment Requested`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to send email');
    }

    const result = await response.json();
    console.log('Email sent successfully:', result);

    return { success: true };
  } catch (error: any) {
    console.error('Error sending invoice email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
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
  paymentInstructions,
}: SendInvoiceEmailParams): string {
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
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.amount)}</td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${invoice.invoice_number}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background-color: #ffffff; padding: 40px 30px; border-radius: 8px 8px 0 0; text-align: center; border-bottom: 3px solid #3b82f6;">
      <h1 style="margin: 0; font-size: 28px; color: #1f2937;">Invoice</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px; color: #6b7280;">Invoice #${invoice.invoice_number}</p>
    </div>

    <!-- Invoice Details -->
    <div style="background-color: #ffffff; padding: 30px;">
      <div style="margin-bottom: 30px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">To:</p>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${customer.name}</p>
        ${customer.email ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">${customer.email}</p>` : ''}
        ${customer.phone ? `<p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">${customer.phone}</p>` : ''}
      </div>

      <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
        <div>
          <p style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Issue Date</p>
          <p style="margin: 0; font-size: 16px; color: #1f2937;">${formatDate(invoice.issue_date)}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Due Date</p>
          <p style="margin: 0; font-size: 16px; color: #1f2937;">${formatDate(invoice.due_date)}</p>
        </div>
      </div>

      <!-- Line Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 12px; text-align: left; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Description</th>
            <th style="padding: 12px; text-align: center; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Qty</th>
            <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
            <th style="padding: 12px; text-align: right; font-size: 14px; font-weight: 600; color: #6b7280; border-bottom: 2px solid #e5e7eb;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="margin-left: auto; max-width: 300px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 14px; color: #6b7280;">Subtotal</span>
          <span style="font-size: 14px; color: #1f2937;">${formatCurrency(invoice.subtotal)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 14px; color: #6b7280;">Tax</span>
          <span style="font-size: 14px; color: #1f2937;">${formatCurrency(invoice.tax_amount)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px 0; background-color: #f9fafb; margin: 10px -15px 0 -15px; padding-left: 15px; padding-right: 15px;">
          <span style="font-size: 18px; font-weight: 700; color: #1f2937;">Total Due</span>
          <span style="font-size: 18px; font-weight: 700; color: #3b82f6;">${formatCurrency(invoice.total)}</span>
        </div>
      </div>

      ${invoice.notes ? `
      <div style="margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 6px;">
        <p style="margin: 0 0 5px 0; font-size: 14px; font-weight: 600; color: #6b7280;">Notes</p>
        <p style="margin: 0; font-size: 14px; color: #1f2937; white-space: pre-wrap;">${invoice.notes}</p>
      </div>
      ` : ''}
    </div>

    <!-- Payment Section -->
    <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 8px 8px; text-align: center;">
      ${paymentLink ? `
        <a href="${paymentLink}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; margin-bottom: 15px;">Pay Invoice Now</a>
        <p style="margin: 15px 0 0 0; font-size: 12px; color: #6b7280;">Click the button above to securely pay with card</p>
      ` : ''}
      
      ${paymentInstructions ? `
        <div style="margin-top: ${paymentLink ? '20px' : '0'}; padding: 20px; background-color: #f9fafb; border-radius: 8px; text-align: left;">
          <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #1f2937;">Payment Instructions:</p>
          <p style="margin: 0; font-size: 14px; color: #4b5563; white-space: pre-wrap;">${paymentInstructions}</p>
        </div>
      ` : ''}
      
      ${!paymentLink && !paymentInstructions ? `
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Please contact us for payment instructions.</p>
      ` : ''}
    </div>

    <!-- Footer -->
    <div style="margin-top: 20px; text-align: center; padding: 20px;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Thank you for your business!</p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #9ca3af;">If you have any questions, please reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
}
