import { InvoiceTemplate, InvoiceTemplateSettings } from '../types';

export const TEMPLATE_PRESET_COLORS: Record<InvoiceTemplate, string> = {
  classic: '#3B82F6',
  painter: '#C75B12',
  minimal: '#1F2937',
};

export const DEFAULT_TEMPLATE_SETTINGS: InvoiceTemplateSettings = {
  accent_color: TEMPLATE_PRESET_COLORS.classic,
  header_layout: 'stacked',
  show_logo: true,
  show_business_contact: true,
  show_notes: true,
  highlight_totals: true,
  footer_text: 'Thank you for your business!',
};

export const normalizeHexColor = (value?: string | null): string => {
  if (!value) return DEFAULT_TEMPLATE_SETTINGS.accent_color;
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const isHex = /^#[0-9A-Fa-f]{6}$/.test(withHash);
  return isHex ? withHash.toUpperCase() : DEFAULT_TEMPLATE_SETTINGS.accent_color;
};

export const resolveTemplateSettings = (
  raw: Partial<InvoiceTemplateSettings> | null | undefined,
  template?: InvoiceTemplate | null
): InvoiceTemplateSettings => {
  const presetColor = template ? TEMPLATE_PRESET_COLORS[template] : undefined;

  return {
    accent_color: normalizeHexColor(raw?.accent_color || presetColor),
    header_layout:
      raw?.header_layout === 'inline' || raw?.header_layout === 'stacked'
        ? raw.header_layout
        : DEFAULT_TEMPLATE_SETTINGS.header_layout,
    show_logo:
      typeof raw?.show_logo === 'boolean'
        ? raw.show_logo
        : DEFAULT_TEMPLATE_SETTINGS.show_logo,
    show_business_contact:
      typeof raw?.show_business_contact === 'boolean'
        ? raw.show_business_contact
        : DEFAULT_TEMPLATE_SETTINGS.show_business_contact,
    show_notes:
      typeof raw?.show_notes === 'boolean'
        ? raw.show_notes
        : DEFAULT_TEMPLATE_SETTINGS.show_notes,
    highlight_totals:
      typeof raw?.highlight_totals === 'boolean'
        ? raw.highlight_totals
        : DEFAULT_TEMPLATE_SETTINGS.highlight_totals,
    footer_text:
      typeof raw?.footer_text === 'string' && raw.footer_text.trim() !== ''
        ? raw.footer_text.trim()
        : DEFAULT_TEMPLATE_SETTINGS.footer_text,
  };
};
