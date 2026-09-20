import { BusinessPaymentMethod } from '../types';

const LINK_METHODS = new Set(['paypal', 'venmo', 'cash_app', 'stripe']);

export function paymentMethodUrl(value: string): string | undefined {
  const trimmed = value.trim();
  // Accept a pasted web address without a scheme, but never invent a recipient
  // from a username, email address, or phone number.
  const candidate = /^[\w-]+(?:\.[\w-]+)+(?:\/[^\s]*)?$/.test(trimmed)
    ? `https://${trimmed}` : trimmed;
  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return;
    return url.href;
  } catch { return; }
}

export function preparePaymentMethods(methods: BusinessPaymentMethod[]): BusinessPaymentMethod[] {
  return methods.map(method => {
    const value = method.value.trim();
    if (!value) throw new Error(`Enter payment details for ${method.label}, or deselect it before saving.`);
    const url = paymentMethodUrl(value);
    if (LINK_METHODS.has(method.type) && !url) {
      throw new Error(`Paste your full ${method.label} payment link, including https://, so customers can pay from their invoice.`);
    }
    return { ...method, value: url || value };
  });
}
