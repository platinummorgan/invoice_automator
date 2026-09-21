import JobPhotos from '../components/JobPhotos';
import AppIcon from '../components/AppIcon';
import { parseDisplayDate, calendarDate } from '../utils/invoiceValues';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { shareInvoicePdf } from '../services/invoicePdf';
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
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { invoiceId } = route.params;
  const insets = useSafeAreaInsets();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const isQuote = invoice?.document_type === 'quote';
  const documentLabel = isQuote ? 'Quote' : 'Invoice';
  const [photoBusy, setPhotoBusy] = useState(false);
  const [updatingJob, setUpdatingJob] = useState(false);
  const paying = useRef(false);
  useEffect(() => { navigation.setOptions({ title: documentLabel }); }, [navigation, documentLabel]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
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
  const previewPalette = useMemo(
    () => getPreviewPalette(invoiceTemplate, templateSettings, theme),
    [invoiceTemplate, templateSettings, theme]
  );
  const highlightedTotalColor = useMemo(
    () => getReadableAccent(previewPalette.accent, theme, isDark),
    [previewPalette.accent, theme, isDark]
  );

  useFocusEffect(React.useCallback(() => {
    loadInvoice();
    loadProfileData();
  }, [invoiceId]));

  const fetchProfileBranding = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in again to load your business and payment details.');

    const { data: profile, error } = await supabase
      .from('profiles')
      .select(
        'business_name, business_address, business_phone, payment_instructions, payment_methods, logo_url, invoice_template, template_settings'
      )
      .eq('id', user.id)
      .single();

    if (error || !profile) throw new Error('Unable to load your business and payment details. Check your connection and try again.');

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

  // Fetch at export time so an early tap or changed settings cannot produce an
  // invoice with empty/stale payment details. A failed fetch must stop export.
  const getExportBranding = async () => {
    const profile = await fetchProfileBranding();
    return {
      paymentMethods: profile.payment_methods,
      paymentInstructions: profile.payment_instructions || undefined,
      businessName: profile.business_name || 'Swift Invoice',
      businessAddress: profile.business_address || undefined,
      businessPhone: profile.business_phone || undefined,
      logoUrl: profile.logo_url || undefined,
      invoiceTemplate: profile.invoice_template || 'classic',
      templateSettings: profile.template_settings,
    };
  };

  const handleMarkAsPaid = async () => {
    if (!invoice || isQuote || paying.current) return;
    Alert.alert('Record full payment', 'Confirm payment was received in full. A receipt email will open for you to send.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark as paid', onPress: async () => {
        if (paying.current) return;
        paying.current = true;
        setSendingReceipt(true);
        let recorded = false;
        try {
          await paymentService.recordManualPayment(invoice.id);
          recorded = true;
          const paidInvoice = await invoiceService.getInvoice(invoice.id);
          setInvoice(paidInvoice);
          if (!paidInvoice.customer?.email) {
            Alert.alert('Payment saved', 'Your receipt is ready. Use Share receipt PDF to text or save it.');
            return;
          }
          const result = await sendReceiptEmail({ invoice: paidInvoice, items: paidInvoice.items || [],
            customer: paidInvoice.customer, paymentMethodLabel: 'Manual Payment', ...await getExportBranding() });
          Alert.alert('Payment saved', result.success ? 'Receipt draft opened in your email app. Send it there to deliver it.' : 'Receipt was not sent. Use Email receipt or Share receipt PDF to try again.');
        } catch (error: any) {
          Alert.alert(recorded ? 'Payment saved; receipt unavailable' : 'Could not record payment', error.message);
        } finally { paying.current = false; setSendingReceipt(false); }
      } },
    ]);
  };

  const handleApproveQuote = () => {
    if (!invoice || updatingJob) return;
    Alert.alert('Approve quote and create invoice?', 'Confirm the customer approved this quote. All customer details, prices and pictures carry over. Review invoice dates before sending.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve & convert', onPress: async () => {
        setUpdatingJob(true);
        try { await invoiceService.approveQuote(invoice.id); await loadInvoice(); }
        catch (error: any) { Alert.alert('Unable to convert quote', error.message); }
        finally { setUpdatingJob(false); }
      } },
    ]);
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
      `Send ${documentLabel}`,
      `Send ${documentLabel.toLowerCase()} #${invoice.invoice_number} to ${invoice.customer.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Email',
          onPress: async () => {
            setSendingEmail(true);
            try {
              const fresh = await invoiceService.getInvoice(invoice.id);
              const result = await sendInvoiceEmail({
                invoice: fresh,
                items: fresh.items || [],
                customer: fresh.customer!,
                ...await getExportBranding(),
              });

              if (result.success && invoice.status === 'draft') {
                Alert.alert(
                  'Email Draft Opened',
                  `Your email app opened with the ${documentLabel.toLowerCase()} draft. Mark it as sent?`,
                  [
                    { text: 'Not yet', style: 'cancel' },
                    {
                      text: 'Mark as Sent',
                      onPress: async () => {
                        try {
                          await invoiceService.markInvoiceSent(invoice.id);
                          await loadInvoice();
                        } catch (error: any) {
                          Alert.alert('Error', error.message);
                        }
                      },
                    },
                  ]
                );
              } else if (result.success || result.status === 'cancelled') {
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
              const latestPayment = await paymentService.getPaymentStatus(invoice.id);
              const fresh = await invoiceService.getInvoice(invoice.id);
              const result = await sendReceiptEmail({
                invoice: fresh,
                items: fresh.items || [],
                customer: fresh.customer!,
                paidAt: latestPayment?.paid_at || invoice.paid_at,
                paymentMethodLabel: 'Manual Payment',
                receiptReference: invoice.invoice_number,
                businessName,
                businessAddress: businessAddress || undefined,
                businessPhone: businessPhone || undefined,
                logoUrl: logoUrl || undefined,
                invoiceTemplate,
                templateSettings,
              });

              if (result.success) {
                Alert.alert('Receipt', 'Receipt draft opened in your email app.');
              } else if (result.success || result.status === 'cancelled') {
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
    const date = parseDisplayDate(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return theme.colors.primary;
      case 'sent':
        return !isQuote && invoice && invoice.due_date < calendarDate(new Date()) ? theme.colors.error : theme.colors.textSecondary;
      case 'overdue':
        return theme.colors.error;
      case 'void':
        return theme.colors.textSecondary;
      case 'draft':
        return theme.colors.textSecondary;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    if (!isQuote && status === 'sent' && invoice && invoice.due_date < calendarDate(new Date())) return 'Overdue';
    return ({ draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue', void: 'Voided', cancelled: 'Cancelled' } as Record<string, string>)[status] || status;
  };

  const handleMarkSent = () => {
    if (!invoice || invoice.status !== 'draft' || markingSent) return;
    Alert.alert(`Mark ${documentLabel.toLowerCase()} as sent?`, isQuote ? 'Confirm you sent this quote. It can then be approved and converted to an invoice.' : 'Confirm you have sent this invoice to your customer. It will count as outstanding and can no longer be edited as a draft.', [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Mark as sent', onPress: async () => {
        setMarkingSent(true);
        try { await invoiceService.markInvoiceSent(invoice.id); await loadInvoice(); }
        catch (error: any) { Alert.alert('Unable to mark as sent', error.message); }
        finally { setMarkingSent(false); }
      } },
    ]);
  };

  const handleSharePdf = async (receipt = false) => {
    if (!invoice?.customer || sharingPdf) return;
    setSharingPdf(true);
    try {
      const fresh = await invoiceService.getInvoice(invoice.id);
      await shareInvoicePdf({
        invoice: fresh, items: fresh.items || [], customer: fresh.customer!,
        ...await getExportBranding(),
      }, receipt);
    } catch (error: any) {
      Alert.alert('Unable to share PDF', error.message);
    } finally {
      setSharingPdf(false);
    }
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
            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>{invoice.invoice_number}</Text>
              <Text style={styles.invoiceNumber}>{invoice.customer_name || invoice.customer?.name || 'Invoice'}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { borderColor: getStatusColor(invoice.status) },
              ]}
            >
              <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>{getStatusLabel(invoice.status)}</Text>
            </View>
          </View>

          <View style={styles.headerMetaRow}>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>Issued</Text>
              <Text style={styles.headerMetaValue}>{formatDate(invoice.issue_date)}</Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>{isQuote ? 'Valid until' : 'Due'}</Text>
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
            <Text style={styles.voidTitle}>Invoice voided</Text>
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
          <Text style={styles.sectionTitle}>Bill to</Text>
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
                  color: theme.colors.primary,
                },
              ]}
            >
              {formatCurrency(invoice.total)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{documentLabel}{invoice.quote_number ? ` · Approved from ${invoice.quote_number}` : ''}</Text>
          {invoice.completed_at && <Text style={styles.notesText}>Job completed {formatDate(invoice.completed_at)}</Text>}
          <JobPhotos photos={invoice.photos || []} finished={!isQuote} onBusyChange={setPhotoBusy} disabled={updatingJob || photoBusy}
            onChange={['void', 'cancelled'].includes(invoice.status) ? undefined : async photos => {
              await invoiceService.updateJob(invoice.id, photos);
              await loadInvoice();
            }} />
          {isQuote && ['draft', 'sent'].includes(invoice.status) && <TouchableOpacity accessibilityRole="button" style={styles.previewButton} disabled={updatingJob || photoBusy} onPress={handleApproveQuote}>
            <Text style={styles.previewButtonText}>{updatingJob ? 'Converting…' : 'Approve quote & create invoice'}</Text>
          </TouchableOpacity>}
          {!isQuote && !invoice.completed_at && !['void', 'cancelled'].includes(invoice.status) && <TouchableOpacity accessibilityRole="button" style={styles.previewButton} disabled={updatingJob || photoBusy} onPress={async () => {
            setUpdatingJob(true);
            try { await invoiceService.updateJob(invoice.id, invoice.photos, true); await loadInvoice(); }
            catch (error: any) { Alert.alert('Could not complete job', error.message); }
            finally { setUpdatingJob(false); }
          }}><Text style={styles.previewButtonText}>Mark job completed</Text></TouchableOpacity>}
        </View>
        {/* Notes */}
        {templateSettings.show_notes && invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {invoice.status === 'draft' && (
          <View style={styles.actionRow}>
            <TouchableOpacity accessibilityRole="button" style={styles.previewButton}
              onPress={() => navigation.navigate('NewInvoice', { invoiceId: invoice.id, documentType: invoice.document_type })}>
              <Text style={styles.previewButtonText}>Edit draft</Text>
            </TouchableOpacity>
          </View>
        )}
        {invoice.status !== 'void' && invoice.status !== 'cancelled' && (
          <View style={styles.actionRow}>
            <TouchableOpacity accessibilityRole="button" style={styles.previewButton} disabled={sharingPdf || photoBusy}
              onPress={() => handleSharePdf()}>
              <Text style={styles.previewButtonText}>{sharingPdf ? 'Preparing PDF…' : 'Share / save PDF'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {invoice.status === 'draft' && <View style={styles.actionRow}>
          <TouchableOpacity accessibilityRole="button" disabled={markingSent} style={styles.previewButton} onPress={handleMarkSent}>
            <Text style={styles.previewButtonText}>{markingSent ? 'Updating…' : 'Mark as sent'}</Text>
          </TouchableOpacity>
        </View>}

        {invoice.status === 'paid' && <View style={styles.actionRow}>
          <TouchableOpacity accessibilityRole="button" style={styles.previewButton} disabled={sharingPdf || photoBusy} onPress={() => handleSharePdf(true)}>
            <Text style={styles.previewButtonText}>{sharingPdf ? 'Preparing…' : 'Share receipt PDF / text'}</Text>
          </TouchableOpacity>
        </View>}
        {/* Receipt Actions */}
        {invoice.status === 'paid' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.receiptButton, sendingReceipt && styles.buttonDisabled]}
              onPress={handleSendReceipt}
              disabled={sendingReceipt || photoBusy}
            >
              {sendingReceipt ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.receiptButtonText}>Email receipt</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!isQuote && !['paid', 'void', 'cancelled'].includes(invoice.status) && (
          <View style={styles.actionRow}>
            <TouchableOpacity accessibilityRole="button" style={styles.previewButton} disabled={sendingReceipt || photoBusy} onPress={handleMarkAsPaid}>
              <Text style={styles.previewButtonText}>Record full payment</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.previewButton} onPress={handleVoidInvoice}>
              <Text style={[styles.previewButtonText, { color: theme.colors.textSecondary }]}>Void invoice</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {!['paid', 'void', 'cancelled'].includes(invoice.status) && (
        <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity accessibilityRole="button" style={styles.markPaidButton} onPress={() => setShowPreviewModal(true)}>
            <Text style={styles.markPaidButtonText}>Preview & share</Text>
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
          <View style={[styles.previewHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <TouchableOpacity
              onPress={() => setShowPreviewModal(false)}
              style={styles.previewBackButton}
              accessibilityRole="button" accessibilityLabel="Close invoice preview"
            >
              <AppIcon name="close" color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Preview</Text>
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
                  <Text style={styles.previewInvoiceNumber}>{documentLabel} {invoice.invoice_number}</Text>
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
                  <Text style={styles.previewInvoiceNumber}>{documentLabel} {invoice.invoice_number}</Text>
                </>
              )}
            </View>

            {/* Customer Info */}
            <View style={styles.previewSection}>
              <Text style={[styles.previewSectionTitle, { color: previewPalette.sectionLabel }]}>{isQuote ? 'Prepared for:' : 'Bill To:'}</Text>
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
                <Text style={styles.previewDateLabel}>{isQuote ? 'Valid until:' : 'Due Date:'}</Text>
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
            <JobPhotos photos={invoice.photos || []} finished={!isQuote} />
            {!isQuote && paymentInstructions && (
              <View style={styles.previewSection}>
                <Text style={[styles.previewSectionTitle, { color: previewPalette.sectionLabel }]}>Payment Methods:</Text>
                <View style={styles.paymentInstructionsBox}>
                  <Text style={styles.paymentInstructionsText}>{paymentInstructions}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.previewActions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {invoice.customer?.email ? <TouchableOpacity accessibilityRole="button" style={styles.previewButton} disabled={sendingEmail || photoBusy}
              onPress={() => { setShowPreviewModal(false); handleSendEmail(); }}>
              <Text style={styles.previewButtonText}>{sendingEmail ? 'Opening email…' : 'Open email draft'}</Text>
            </TouchableOpacity> : null}
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: sharingPdf, busy: sharingPdf }}
              style={[styles.sendEmailButton, { flex: 0 }, sharingPdf && styles.buttonDisabled]} onPress={() => handleSharePdf()} disabled={sharingPdf || photoBusy}>
              {sharingPdf ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendEmailButtonText}>Share / save PDF</Text>}
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
              placeholder="e.g., Pricing error, duplicate invoice, customer request"
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
  actionRow: { paddingVertical: 4, borderBottomWidth: 1, borderColor: theme.colors.border },
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
    fontFamily: theme.fonts.body,
  },
  scrollView: {
    flex: 1,
  },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  headerCard: { paddingBottom: 22, marginBottom: 4, borderBottomWidth: 1, borderColor: theme.colors.border },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  headerEyebrow: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 },
  invoiceNumber: { fontFamily: theme.fonts.body, fontSize: 26, lineHeight: 33, fontWeight: '600', color: theme.colors.text },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 9, borderWidth: 1, borderRadius: 6 },
  statusText: { fontFamily: theme.fonts.body, fontSize: 12, fontWeight: '500' },
  headerMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  headerMetaItem: { flexGrow: 1, flexBasis: 110, gap: 4 },
  headerMetaLabel: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  headerMetaValue: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, fontVariant: ['tabular-nums'] },
  section: { paddingVertical: 20, borderBottomWidth: 1, borderColor: theme.colors.border },
  sectionTitle: { fontFamily: theme.fonts.body, fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary, marginBottom: 12 },
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
  brandingBusinessName: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 4 },
  brandingTextBlock: {
    flex: 1,
  },
  brandingBusinessDetail: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  customerName: { fontFamily: theme.fonts.body, fontSize: 17, fontWeight: '600', color: theme.colors.text, marginBottom: 4 },
  customerDetail: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 2,
    fontFamily: theme.fonts.body,
  },
  itemRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, paddingVertical: 10 },
  itemDescription: { flex: 1, minWidth: 140 },
  itemText: { fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 22, color: theme.colors.text, marginBottom: 4 },
  itemSubtext: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  itemAmount: { fontFamily: theme.fonts.body, fontSize: 15, fontWeight: '600', color: theme.colors.text, fontVariant: ['tabular-nums'] },
  totalsSection: { paddingVertical: 24, borderBottomWidth: 1, borderColor: theme.colors.border },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  totalValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 14,
    marginTop: 8,
    marginBottom: 0,
  },
  grandTotalLabel: { fontFamily: theme.fonts.body, fontSize: 19, fontWeight: '600', color: theme.colors.text },
  grandTotalValue: { fontFamily: theme.fonts.body, fontSize: 26, fontWeight: '600', color: theme.colors.primary, fontVariant: ['tabular-nums'] },
  notesText: { fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 22, color: theme.colors.textSecondary },
  sendEmailButton: { backgroundColor: '#1B6C53', minHeight: 48, padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sendEmailButtonText: { fontFamily: theme.fonts.body, color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  receiptButton: { backgroundColor: '#1B6C53', minHeight: 48, padding: 14, borderRadius: 8, alignItems: 'center' },
  receiptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: theme.fonts.body,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomActions: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: theme.colors.card, borderTopWidth: 1, borderColor: theme.colors.border },
  voidButton: {
    flex: 1,
    backgroundColor: theme.colors.error,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  voidButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: theme.fonts.body,
  },
  markPaidButton: { minHeight: 48, backgroundColor: '#1B6C53', padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  markPaidButtonText: { fontFamily: theme.fonts.body, color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  voidNotice: { borderLeftWidth: 2, borderColor: theme.colors.textSecondary, paddingLeft: 16, paddingVertical: 12, marginVertical: 16 },
  voidTitle: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  voidReason: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
    fontFamily: theme.fonts.body,
  },
  voidDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    fontFamily: theme.fonts.body,
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
    fontSize: 24,
    color: theme.colors.text,
    marginBottom: 12,
    fontFamily: theme.fonts.headline,
  },
  modalDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
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
    fontSize: 15,
    fontFamily: theme.fonts.body,
  },
  modalButtonVoid: {
    backgroundColor: theme.colors.error,
  },
  modalButtonVoidText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: theme.fonts.body,
  },
  previewButton: { minHeight: 48, justifyContent: 'center', paddingVertical: 12 },
  previewButtonText: { fontFamily: theme.fonts.body, fontSize: 14, fontWeight: '600', color: theme.colors.primary },
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
  previewBackButton: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
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
  previewHeaderSpacer: { width: 44 },
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
  previewActions: { paddingHorizontal: 24, paddingTop: 12, backgroundColor: theme.colors.card, borderTopWidth: 1, borderColor: theme.colors.border },
});
