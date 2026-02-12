import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { invoiceService } from '../services/invoice';
import { paymentService } from '../services/payment';
import { sendInvoiceEmail, sendReceiptEmail } from '../services/email';
import { supabase } from '../services/supabase';
import { DEFAULT_TEMPLATE_SETTINGS, resolveTemplateSettings } from '../services/templateSettings';
import {
  BusinessPaymentMethod,
  Invoice,
  InvoiceTemplate,
  InvoiceTemplateSettings,
} from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface InvoiceDetailScreenProps {
  navigation: any;
  route: any;
}

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

const normalizePaymentMethods = (raw: unknown): BusinessPaymentMethod[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => ({
      type: String((entry as any)?.type || '').trim(),
      label: String((entry as any)?.label || '').trim(),
      value: String((entry as any)?.value || '').trim(),
    }))
    .filter((entry) => entry.label.length > 0 && entry.value.length > 0) as BusinessPaymentMethod[];
};

const formatPaymentMethodsForPreview = (methods: BusinessPaymentMethod[]) =>
  methods.map((method) => `${method.label}: ${method.value}`).join('\n');

export default function InvoiceDetailScreen({
  navigation,
  route,
}: InvoiceDetailScreenProps) {
  const { theme, isDark } = useTheme();
  const styles = createStyles(theme);
  const { invoiceId } = route.params;
  const insets = useSafeAreaInsets();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [businessName, setBusinessName] = useState('Swift Invoice');
  const [businessAddress, setBusinessAddress] = useState<string | null>(null);
  const [businessPhone, setBusinessPhone] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplate>('classic');
  const [templateSettings, setTemplateSettings] =
    useState<InvoiceTemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);
  const previewPalette = getPreviewPalette(invoiceTemplate, templateSettings, theme);
  const highlightedTotalColor = getReadableAccent(previewPalette.accent, theme, isDark);

  useEffect(() => {
    loadInvoice();
    loadProfileData();
  }, []);

  const fetchProfileBranding = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'business_name, business_address, business_phone, payment_instructions, payment_methods, logo_url, invoice_template, template_settings'
      )
      .eq('id', user.id)
      .single();

    if (!profile) return null;

    return {
      business_name: profile.business_name,
      business_address: profile.business_address,
      business_phone: profile.business_phone,
      payment_instructions: profile.payment_instructions,
      payment_methods: normalizePaymentMethods(profile.payment_methods),
      logo_url: profile.logo_url,
      invoice_template: profile.invoice_template,
      template_settings: resolveTemplateSettings(
        profile.template_settings,
        profile.invoice_template
      ),
    };
  };

  const loadProfileData = async () => {
    try {
      const profile = await fetchProfileBranding();

      if (profile) {
        const methodsPreview = formatPaymentMethodsForPreview(profile.payment_methods || []);
        const paymentPreviewText =
          methodsPreview && profile.payment_instructions
            ? `${methodsPreview}\n\n${profile.payment_instructions}`
            : methodsPreview || profile.payment_instructions || null;

        setBusinessName(profile.business_name || 'Swift Invoice');
        setBusinessAddress(profile.business_address || null);
        setBusinessPhone(profile.business_phone || null);
        setPaymentInstructions(paymentPreviewText);
        setLogoUrl(profile.logo_url || null);
        setInvoiceTemplate(profile.invoice_template || 'classic');
        setTemplateSettings(
          resolveTemplateSettings(profile.template_settings, profile.invoice_template)
        );
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadInvoice = async () => {
    try {
      const data = await invoiceService.getInvoice(invoiceId);
      setInvoice(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!invoice) return;

    Alert.alert(
      'Mark as Paid',
      'Are you sure this invoice has been paid?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Paid',
          style: 'default',
          onPress: async () => {
            try {
              const paidAt = new Date().toISOString();
              await invoiceService.updateInvoiceStatus(invoice.id, 'paid');
              await paymentService.recordManualPayment(invoice.id, invoice.total, paidAt);

              await loadInvoice();

              const customer = invoice.customer;
              if (!customer?.email) {
                Alert.alert('Success', 'Invoice marked as paid.');
                return;
              }

              Alert.alert('Paid', 'Invoice marked as paid. Email a receipt now?', [
                { text: 'Not now', style: 'cancel' },
                {
                  text: 'Email Receipt',
                  onPress: async () => {
                    setSendingReceipt(true);
                    try {
                      const profile = await fetchProfileBranding();
                      const receiptResult = await sendReceiptEmail({
                        invoice: { ...invoice, status: 'paid', paid_at: paidAt },
                        items: invoice.items || [],
                        customer,
                        paidAt,
                        paymentMethodLabel: 'Manual Payment',
                        receiptReference: invoice.invoice_number,
                        businessName: profile?.business_name || businessName,
                        businessAddress: profile?.business_address || businessAddress || undefined,
                        businessPhone: profile?.business_phone || businessPhone || undefined,
                        logoUrl: profile?.logo_url || logoUrl || undefined,
                        invoiceTemplate: (profile?.invoice_template || invoiceTemplate) as InvoiceTemplate,
                        templateSettings: profile?.template_settings || templateSettings,
                      });

                      if (receiptResult.success) {
                        Alert.alert('Receipt', 'Receipt draft opened in your email app.');
                      } else if (receiptResult.status === 'cancelled') {
                        // User backed out of the composer; nothing to do.
                      } else {
                        Alert.alert('Receipt Failed', receiptResult.error || 'Unable to open email app.');
                      }
                    } catch (error: any) {
                      Alert.alert('Receipt Failed', error.message);
                    } finally {
                      setSendingReceipt(false);
                    }
                  },
                },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleVoidInvoice = async () => {
    if (!invoice) return;

    if (invoice.status === 'paid') {
      Alert.alert('Cannot Void', 'Cannot void a paid invoice');
      return;
    }

    setShowVoidModal(true);
  };

  const confirmVoidInvoice = async () => {
    if (!invoice) return;

    if (!voidReason || voidReason.trim() === '') {
      Alert.alert('Error', 'Please provide a reason for voiding');
      return;
    }

    try {
      await invoiceService.voidInvoice(invoice.id, voidReason);
      setShowVoidModal(false);
      setVoidReason('');
      loadInvoice();
      Alert.alert('Success', 'Invoice voided. Create a new invoice with correct information.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice) return;

    // Validate email exists
    if (!invoice.customer?.email) {
      Alert.alert('Error', 'Customer email is required to send invoice.');
      return;
    }

    Alert.alert(
      'Send Invoice',
      `Send invoice #${invoice.invoice_number} to ${invoice.customer.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Email',
          onPress: async () => {
            setSendingEmail(true);
            try {
              const profile = await fetchProfileBranding();

              const result = await sendInvoiceEmail({
                invoice,
                items: invoice.items || [],
                customer: invoice.customer!,
                paymentMethods: profile?.payment_methods,
                paymentInstructions: profile?.payment_instructions,
                businessName: profile?.business_name,
                businessAddress: profile?.business_address,
                businessPhone: profile?.business_phone,
                logoUrl: profile?.logo_url,
                invoiceTemplate: profile?.invoice_template,
                templateSettings: profile?.template_settings,
              });

              if (result.success) {
                Alert.alert(
                  'Email Draft Opened',
                  'Your email app opened with the invoice draft. Mark this invoice as sent?',
                  [
                    { text: 'Not yet', style: 'cancel' },
                    {
                      text: 'Mark as Sent',
                      onPress: async () => {
                        try {
                          await invoiceService.updateInvoiceStatus(invoice.id, 'sent');
                          await loadInvoice();
                        } catch (error: any) {
                          Alert.alert('Error', error.message);
                        }
                      },
                    },
                  ]
                );
              } else if (result.status === 'cancelled') {
                // User backed out of the composer; nothing to do.
              } else {
                Alert.alert('Error', result.error || 'Unable to open email app.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setSendingEmail(false);
            }
          },
        },
      ]
    );
  };

  const handleSendReceipt = async () => {
    if (!invoice) return;

    if (!invoice.customer?.email) {
      Alert.alert('Error', 'Customer email is required to send receipt.');
      return;
    }

    if (invoice.status !== 'paid') {
      Alert.alert('Not Paid Yet', 'Receipt can only be sent for paid invoices.');
      return;
    }

    Alert.alert(
      'Send Receipt',
      `Send payment receipt for invoice #${invoice.invoice_number} to ${invoice.customer.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Email',
          onPress: async () => {
            setSendingReceipt(true);
            try {
              const profile = await fetchProfileBranding();
              const latestPayment = await paymentService.getPaymentStatus(invoice.id);
              const result = await sendReceiptEmail({
                invoice,
                items: invoice.items || [],
                customer: invoice.customer!,
                paidAt: latestPayment?.paid_at || invoice.paid_at,
                paymentMethodLabel: 'Manual Payment',
                receiptReference: invoice.invoice_number,
                businessName: profile?.business_name || businessName,
                businessAddress: profile?.business_address || businessAddress || undefined,
                businessPhone: profile?.business_phone || businessPhone || undefined,
                logoUrl: profile?.logo_url || logoUrl || undefined,
                invoiceTemplate: (profile?.invoice_template || invoiceTemplate) as InvoiceTemplate,
                templateSettings: profile?.template_settings || templateSettings,
              });

              if (result.success) {
                Alert.alert('Receipt', 'Receipt draft opened in your email app.');
              } else if (result.status === 'cancelled') {
                // User backed out of the composer; nothing to do.
              } else {
                Alert.alert('Error', result.error || 'Unable to open email app.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            } finally {
              setSendingReceipt(false);
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#4CAF50';
      case 'sent':
        return '#2196F3';
      case 'overdue':
        return '#F44336';
      case 'void':
        return '#757575';
      case 'draft':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'draft' ? 'open' : status;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Invoice not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerEyebrow}>Invoice</Text>
              <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(invoice.status) },
              ]}
            >
              <Text style={styles.statusText}>{getStatusLabel(invoice.status).toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.headerMetaRow}>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Issue</Text>
              <Text style={styles.headerMetaValue}>{formatDate(invoice.issue_date)}</Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Due</Text>
              <Text style={styles.headerMetaValue}>{formatDate(invoice.due_date)}</Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Amount</Text>
              <Text style={styles.headerMetaValue}>{formatCurrency(invoice.total)}</Text>
            </View>
          </View>
        </View>

        {/* Business Branding */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>From</Text>
          <View style={styles.brandingRow}>
            {templateSettings.show_logo && logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.brandingLogo} resizeMode="contain" />
            ) : null}
            <View style={styles.brandingTextBlock}>
              <Text style={styles.brandingBusinessName}>{businessName}</Text>
              {templateSettings.show_business_contact && !!businessPhone ? (
                <Text style={styles.brandingBusinessDetail}>{businessPhone}</Text>
              ) : null}
              {templateSettings.show_business_contact && !!businessAddress ? (
                <Text style={styles.brandingBusinessDetail}>{businessAddress}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Void Notice */}
        {invoice.status === 'void' && invoice.void_reason && (
          <View style={styles.voidNotice}>
            <Text style={styles.voidTitle}>⚠️ VOID - Invoice Cancelled</Text>
            <Text style={styles.voidReason}>Reason: {invoice.void_reason}</Text>
            {invoice.voided_at && (
              <Text style={styles.voidDate}>
                Voided: {formatDate(invoice.voided_at)}
              </Text>
            )}
          </View>
        )}

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.customerName}>{invoice.customer?.name || invoice.customer_name || 'No customer'}</Text>
          {invoice.customer?.email && (
            <Text style={styles.customerDetail}>{invoice.customer.email}</Text>
          )}
          {invoice.customer?.phone && (
            <Text style={styles.customerDetail}>{invoice.customer.phone}</Text>
          )}
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {invoice.items?.map((item, index) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemDescription}>
                <Text style={styles.itemText}>{item.description}</Text>
                <Text style={styles.itemSubtext}>
                  {item.quantity} × {formatCurrency(item.unit_price)}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{formatCurrency(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          {invoice.tax_rate > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax ({invoice.tax_rate}%)</Text>
              <Text style={styles.totalValue}>{formatCurrency(invoice.tax_amount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text
              style={[
                styles.grandTotalValue,
                {
                  color: templateSettings.highlight_totals
                    ? highlightedTotalColor
                    : theme.colors.text,
                },
              ]}
            >
              {formatCurrency(invoice.total)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {templateSettings.show_notes && invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Receipt Actions */}
        {invoice.status === 'paid' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.receiptButton, sendingReceipt && styles.buttonDisabled]}
              onPress={handleSendReceipt}
              disabled={sendingReceipt}
            >
              {sendingReceipt ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.receiptButtonText}>Send Receipt Email</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Preview & Send Section */}
        {invoice.status !== 'paid' && invoice.status !== 'void' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => setShowPreviewModal(true)}
            >
              <Text style={styles.previewButtonText}>Preview Invoice</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      {invoice.status !== 'paid' && invoice.status !== 'void' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.voidButton}
            onPress={handleVoidInvoice}
          >
            <Text style={styles.voidButtonText}>Void Invoice</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.markPaidButton}
            onPress={handleMarkAsPaid}
          >
            <Text style={styles.markPaidButtonText}>Mark as Paid</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Preview Invoice Modal */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        onRequestClose={() => setShowPreviewModal(false)}
      >
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              onPress={() => setShowPreviewModal(false)}
              style={styles.previewBackButton}
            >
              <Text style={styles.previewBackButtonText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Invoice Preview</Text>
            <View style={styles.previewHeaderSpacer} />
          </View>
          
          <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
            {/* Invoice Header */}
            <View
              style={[
                styles.previewInvoiceHeader,
                {
                  borderBottomColor: previewPalette.accent,
                  backgroundColor: previewPalette.headerBackground,
                },
              ]}
            >
              {templateSettings.header_layout === 'inline' ? (
                <View style={styles.previewInlineHeaderRow}>
                  <View style={styles.previewInlineBusinessBlock}>
                    {templateSettings.show_logo && logoUrl ? (
                      <Image source={{ uri: logoUrl }} style={styles.previewInlineLogo} resizeMode="contain" />
                    ) : null}
                    <View style={styles.previewInlineBusinessText}>
                      <Text style={[styles.previewInlineBusinessName, { color: previewPalette.accent }]}>
                        {businessName}
                      </Text>
                      {templateSettings.show_business_contact && businessPhone ? (
                        <Text style={styles.previewInlineBusinessDetail}>{businessPhone}</Text>
                      ) : null}
                      {templateSettings.show_business_contact && businessAddress ? (
                        <Text style={styles.previewInlineBusinessDetail}>{businessAddress}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.previewInvoiceNumber}>{invoice.invoice_number}</Text>
                </View>
              ) : (
                <>
                  {templateSettings.show_logo && logoUrl ? (
                    <Image source={{ uri: logoUrl }} style={styles.previewLogo} resizeMode="contain" />
                  ) : null}
                  <Text style={[styles.previewBusinessName, { color: previewPalette.accent }]}>
                    {businessName}
                  </Text>
                  {templateSettings.show_business_contact && businessPhone ? (
                    <Text style={styles.previewBusinessDetail}>{businessPhone}</Text>
                  ) : null}
                  {templateSettings.show_business_contact && businessAddress ? (
                    <Text style={styles.previewBusinessDetail}>{businessAddress}</Text>
                  ) : null}
                  <Text style={styles.previewInvoiceNumber}>{invoice.invoice_number}</Text>
                </>
              )}
            </View>

            {/* Customer Info */}
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: previewPalette.sectionLabel }]}>Bill To:</Text>
              <Text style={styles.previewCustomerName}>{invoice.customer?.name}</Text>
              {invoice.customer?.email && (
                <Text style={styles.previewCustomerDetail}>{invoice.customer.email}</Text>
              )}
              {invoice.customer?.phone && (
                <Text style={styles.previewCustomerDetail}>{invoice.customer.phone}</Text>
              )}
              {invoice.customer?.address && (
                <Text style={styles.previewCustomerDetail}>{invoice.customer.address}</Text>
              )}
            </View>

            {/* Dates */}
            <View style={styles.previewSection}>
              <View style={styles.previewDateRow}>
                <Text style={styles.previewDateLabel}>Issue Date:</Text>
                <Text style={styles.previewDateValue}>{formatDate(invoice.issue_date)}</Text>
              </View>
              <View style={styles.previewDateRow}>
                <Text style={styles.previewDateLabel}>Due Date:</Text>
                <Text style={styles.previewDateValue}>{formatDate(invoice.due_date)}</Text>
              </View>
            </View>

            {/* Line Items */}
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: previewPalette.sectionLabel }]}>Items:</Text>
              {invoice.items?.map((item, index) => (
                <View key={index} style={styles.previewItemRow}>
                  <View style={styles.previewItemLeft}>
                    <Text style={styles.previewItemDescription}>{item.description}</Text>
                    <Text style={styles.previewItemQuantity}>
                      Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                    </Text>
                  </View>
                  <Text style={styles.previewItemAmount}>{formatCurrency(item.amount)}</Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={styles.previewSection}>
              <View style={styles.previewTotalRow}>
                <Text style={styles.previewTotalLabel}>Subtotal:</Text>
                <Text style={styles.previewTotalValue}>{formatCurrency(invoice.subtotal)}</Text>
              </View>
              {invoice.tax_rate > 0 && (
                <View style={styles.previewTotalRow}>
                  <Text style={styles.previewTotalLabel}>Tax ({invoice.tax_rate}%):</Text>
                  <Text style={styles.previewTotalValue}>{formatCurrency(invoice.tax_amount)}</Text>
                </View>
              )}
              <View style={[styles.previewTotalRow, styles.previewFinalTotal]}>
                <Text style={styles.previewFinalLabel}>Total:</Text>
                <Text
                  style={[
                    styles.previewFinalValue,
                    {
                      color: templateSettings.highlight_totals
                        ? highlightedTotalColor
                        : theme.colors.text,
                    },
                  ]}
                >
                  {formatCurrency(invoice.total)}
                </Text>
              </View>
            </View>

            {/* Notes */}
            {templateSettings.show_notes && invoice.notes && (
              <View style={styles.previewSection}>
                <Text style={[styles.previewSectionTitle, { color: previewPalette.sectionLabel }]}>Notes:</Text>
                <Text style={styles.previewNotes}>{invoice.notes}</Text>
              </View>
            )}

            {/* Payment Instructions */}
            {paymentInstructions && (
              <View style={styles.previewSection}>
                <Text style={[styles.previewSectionTitle, { color: previewPalette.sectionLabel }]}>Payment Methods:</Text>
                <View style={styles.paymentInstructionsBox}>
                  <Text style={styles.paymentInstructionsText}>{paymentInstructions}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Send Email Button */}
          <View style={[styles.previewActions, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            <TouchableOpacity
              style={[
                styles.sendEmailButton,
                { flex: 0, width: '100%', backgroundColor: previewPalette.accent },
                sendingEmail && styles.buttonDisabled,
              ]}
              onPress={() => {
                setShowPreviewModal(false);
                handleSendEmail();
              }}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendEmailButtonText}>Send Invoice Email</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Void Modal */}
      <Modal
        visible={showVoidModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowVoidModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Void Invoice</Text>
            <Text style={styles.modalDescription}>
              Enter reason for voiding this invoice (e.g., pricing error, customer request):
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter void reason..."
              placeholderTextColor={theme.colors.placeholder}
              value={voidReason}
              onChangeText={setVoidReason}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowVoidModal(false);
                  setVoidReason('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonVoid]}
                onPress={confirmVoidInvoice}
              >
                <Text style={styles.modalButtonVoidText}>Void Invoice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  headerCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerEyebrow: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  invoiceNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  headerMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  headerMetaItem: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  headerMetaLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  headerMetaValue: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '600',
  },
  section: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandingLogo: {
    width: 72,
    height: 40,
    borderRadius: 6,
  },
  brandingBusinessName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 2,
  },
  brandingTextBlock: {
    flex: 1,
  },
  brandingBusinessDetail: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemDescription: {
    flex: 1,
  },
  itemText: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  itemSubtext: {
    fontSize: 12,
    color: theme.colors.placeholder,
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  totalsSection: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 14,
    marginTop: 8,
    marginBottom: 0,
  },
  grandTotalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  grandTotalValue: {
    fontSize: 23,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  notesText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  sendEmailButton: {
    flex: 1,
    backgroundColor: theme.colors.info,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendEmailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  receiptButton: {
    backgroundColor: theme.colors.success,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  receiptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 48,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  voidButton: {
    flex: 1,
    backgroundColor: theme.colors.error,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  voidButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  markPaidButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  markPaidButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  voidNotice: {
    backgroundColor: `${theme.colors.warning}20`,
    borderWidth: 1,
    borderColor: `${theme.colors.warning}66`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  voidTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.warning,
    marginBottom: 8,
  },
  voidReason: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  voidDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.inputBackground,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtonCancelText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonVoid: {
    backgroundColor: theme.colors.error,
  },
  modalButtonVoidText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    marginBottom: 0,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  previewBackButton: {
    minWidth: 64,
  },
  previewBackButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  previewHeaderSpacer: {
    width: 64,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 20,
    paddingBottom: 100,
  },
  previewInvoiceHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    borderRadius: 12,
    paddingTop: 18,
    paddingHorizontal: 12,
  },
  previewLogo: {
    width: 180,
    height: 70,
    marginBottom: 12,
  },
  previewBusinessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  previewBusinessDetail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  previewInvoiceNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  previewInlineHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewInlineBusinessBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  previewInlineLogo: {
    width: 72,
    height: 40,
  },
  previewInlineBusinessText: {
    flex: 1,
  },
  previewInlineBusinessName: {
    fontSize: 18,
    fontWeight: '700',
  },
  previewInlineBusinessDetail: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  previewSection: {
    marginBottom: 18,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
  },
  previewSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  previewCustomerName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  previewCustomerDetail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  previewDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewDateLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  previewDateValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  previewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  previewItemLeft: {
    flex: 1,
  },
  previewItemDescription: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  previewItemQuantity: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  previewItemAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  previewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewTotalLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  previewTotalValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  previewFinalTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  previewFinalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  previewFinalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  previewNotes: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  paymentInstructionsBox: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
  },
  paymentInstructionsText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewActions: {
    padding: 16,
    paddingBottom: 16,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
