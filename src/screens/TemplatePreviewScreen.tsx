import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_TEMPLATE_SETTINGS, resolveTemplateSettings } from '../services/templateSettings';
import { InvoiceTemplate, InvoiceTemplateSettings } from '../types';

interface TemplatePreviewScreenProps {
  route: any;
}

const sampleItems = [
  { description: 'Interior wall prep and paint', quantity: 1, unitPrice: 450 },
  { description: 'Trim and detail work', quantity: 1, unitPrice: 175 },
];

const hexToRgba = (hexColor: string, alpha: number) => {
  const sanitized = hexColor.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(sanitized)) {
    return `rgba(59,130,246,${alpha})`;
  }
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const getPreviewPalette = (
  template: InvoiceTemplate | undefined,
  templateSettings: InvoiceTemplateSettings,
  theme: any
) => {
  switch (template) {
    case 'painter':
      return {
        accent: templateSettings.accent_color,
        headerBackground: '#FFF4EA',
        sectionLabel: '#8A4A1A',
      };
    case 'minimal':
      return {
        accent: templateSettings.accent_color,
        headerBackground: '#F8FAFC',
        sectionLabel: '#4B5563',
      };
    case 'classic':
    default:
      return {
        accent: templateSettings.accent_color,
        headerBackground: hexToRgba(templateSettings.accent_color, 0.08),
        sectionLabel: theme.colors.textSecondary,
      };
  }
};

const getReadableAccent = (accent: string, theme: any, isDark: boolean) => {
  if (!isDark) return accent;
  const sanitized = accent.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(sanitized)) return theme.colors.primary;
  const r = parseInt(sanitized.substring(0, 2), 16) / 255;
  const g = parseInt(sanitized.substring(2, 4), 16) / 255;
  const b = parseInt(sanitized.substring(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.45 ? '#93C5FD' : accent;
};

export default function TemplatePreviewScreen({ route }: TemplatePreviewScreenProps) {
  const { theme, isDark } = useTheme();
  const styles = createStyles(theme);
  const params = route?.params || {};
  const invoiceTemplate = (params.invoiceTemplate || 'classic') as InvoiceTemplate;
  const templateSettings = resolveTemplateSettings(
    params.templateSettings || DEFAULT_TEMPLATE_SETTINGS,
    invoiceTemplate
  );
  const palette = getPreviewPalette(invoiceTemplate, templateSettings, theme);
  const highlightedTotalColor = getReadableAccent(palette.accent, theme, isDark);

  const businessName = params.businessName || 'Swift Invoice';
  const businessAddress = params.businessAddress || '123 Market St, San Diego, CA';
  const businessPhone = params.businessPhone || '(555) 123-4567';
  const logoUrl = params.logoUrl || '';

  const subtotal = sampleItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const formatCurrency = (amount: number) =>
    `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View
          style={[
            styles.invoiceCard,
            {
              borderTopColor: palette.accent,
              backgroundColor: theme.colors.card,
            },
          ]}
        >
          <View style={[styles.header, { backgroundColor: palette.headerBackground }]}>
            {templateSettings.header_layout === 'inline' ? (
              <View style={styles.inlineHeaderRow}>
                <View style={styles.inlineBusinessBlock}>
                  {templateSettings.show_logo && !!logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={styles.inlineLogo} resizeMode="contain" />
                  ) : null}
                  <View style={styles.inlineBusinessText}>
                    <Text style={[styles.businessNameInline, { color: palette.accent }]}>
                      {businessName}
                    </Text>
                    {templateSettings.show_business_contact ? (
                      <>
                        <Text style={styles.businessDetailInline}>{businessPhone}</Text>
                        <Text style={styles.businessDetailInline}>{businessAddress}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.invoiceNumber}>INV-2026-0007</Text>
              </View>
            ) : (
              <>
                {templateSettings.show_logo && !!logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
                ) : null}
                <Text style={[styles.businessName, { color: palette.accent }]}>{businessName}</Text>
                {templateSettings.show_business_contact ? (
                  <>
                    <Text style={styles.businessDetail}>{businessPhone}</Text>
                    <Text style={styles.businessDetail}>{businessAddress}</Text>
                  </>
                ) : null}
                <Text style={styles.invoiceNumber}>INV-2026-0007</Text>
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.sectionLabel }]}>Bill To</Text>
            <Text style={styles.customerName}>Taylor Homes LLC</Text>
            <Text style={styles.customerDetail}>billing@taylorhomes.com</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.sectionLabel }]}>Items</Text>
            {sampleItems.map((item) => (
              <View key={item.description} style={styles.itemRow}>
                <View style={styles.itemTextWrap}>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                  <Text style={styles.itemSubtext}>
                    {item.quantity} x {formatCurrency(item.unitPrice)}
                  </Text>
                </View>
                <Text style={styles.itemAmount}>{formatCurrency(item.quantity * item.unitPrice)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax (8%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(tax)}</Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalLabelFinal}>Total</Text>
              <Text
                style={[
                  styles.totalValueFinal,
                  {
                    color: templateSettings.highlight_totals
                      ? highlightedTotalColor
                      : theme.colors.text,
                  },
                ]}
              >
                {formatCurrency(total)}
              </Text>
            </View>
          </View>

          {templateSettings.show_notes ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.sectionLabel }]}>Notes</Text>
              <Text style={styles.noteText}>
                Thank you for your business. We appreciate the opportunity to work on this project.
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.footerText}>{templateSettings.footer_text}</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 28,
    },
    invoiceCard: {
      borderRadius: 14,
      borderTopWidth: 4,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      alignItems: 'center',
    },
    inlineHeaderRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    inlineBusinessBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    inlineBusinessText: {
      flex: 1,
    },
    inlineLogo: {
      width: 70,
      height: 40,
      borderRadius: 6,
    },
    logo: {
      width: 160,
      height: 68,
      marginBottom: 10,
      borderRadius: 6,
    },
    businessName: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 6,
      textAlign: 'center',
    },
    businessNameInline: {
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 2,
    },
    businessDetail: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: 1,
      textAlign: 'center',
    },
    businessDetailInline: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 1,
    },
    invoiceNumber: {
      fontSize: 18,
      fontWeight: '700',
      color: '#1f2937',
      marginTop: 6,
    },
    section: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    customerName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
    },
    customerDetail: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemTextWrap: {
      flex: 1,
      paddingRight: 10,
    },
    itemDescription: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
      marginBottom: 2,
    },
    itemSubtext: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    itemAmount: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '600',
      alignSelf: 'center',
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    totalRowFinal: {
      borderTopWidth: 2,
      borderTopColor: theme.colors.border,
      marginTop: 6,
      paddingTop: 10,
      marginBottom: 0,
    },
    totalLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    totalValue: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    totalLabelFinal: {
      fontSize: 17,
      color: theme.colors.text,
      fontWeight: '700',
    },
    totalValueFinal: {
      fontSize: 18,
      fontWeight: '700',
    },
    noteText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    footerText: {
      textAlign: 'center',
      marginTop: 14,
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
  });
