import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { generateInvoiceEmailHTML } from './email';

export async function shareInvoicePdf(params: Parameters<typeof generateInvoiceEmailHTML>[0]) {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const html = generateInvoiceEmailHTML(params).replace('</head>', `<style>
    @page { margin: 24px; }
    body { background: white !important; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    thead { display: table-header-group; }
  </style></head>`);
  const { uri } = await Print.printToFileAsync({ html });
  // Keep the generated cache file: Android recipients may read it after the
  // share promise resolves. The OS can reclaim the app's cache later.
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Invoice ${params.invoice.invoice_number}` });
}
