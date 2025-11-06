import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { invoiceService } from '../services/invoice';
import { paymentService } from '../services/payment';
import { sendInvoiceEmail } from '../services/email';
import { supabase } from '../services/supabase';
import { Invoice } from '../types';

interface InvoiceDetailScreenProps {
  navigation: any;
  route: any;
}

export default function InvoiceDetailScreen({
  navigation,
  route,
}: InvoiceDetailScreenProps) {
  const { invoiceId } = route.params;
  const insets = useSafeAreaInsets();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [businessName, setBusinessName] = useState('Swift Invoice');
  const [paymentInstructions, setPaymentInstructions] = useState<string | null>(null);

  useEffect(() => {
    loadInvoice();
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name, payment_instructions')
        .eq('id', user.id)
        .single();

      if (profile) {
        setBusinessName(profile.business_name || 'Swift Invoice');
        setPaymentInstructions(profile.payment_instructions);
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

  const handleGeneratePaymentLink = async () => {
    if (!invoice) return;

    setGeneratingLink(true);
    try {
      const paymentLink = await paymentService.createPaymentLink(invoice.id);
      setInvoice({ ...invoice, stripe_payment_link: paymentLink });
      Alert.alert('Success', 'Payment link generated!');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleSharePaymentLink = async () => {
    if (!invoice?.stripe_payment_link) return;

    try {
      const message = `Pay Invoice ${invoice.invoice_number} ($${invoice.total}): ${invoice.stripe_payment_link}`;
      
      await Share.share({
        message,
        title: `Invoice ${invoice.invoice_number}`,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message);
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
              await invoiceService.updateInvoiceStatus(invoice.id, 'paid');
              loadInvoice();
              Alert.alert('Success', 'Invoice marked as paid');
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
          text: 'Send',
          onPress: async () => {
            setSendingEmail(true);
            try {
              // Load user profile to get payment_instructions
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Not authenticated');

              const { data: profile } = await supabase
                .from('profiles')
                .select('payment_instructions')
                .eq('id', user.id)
                .single();

              const result = await sendInvoiceEmail({
                invoice,
                items: invoice.items || [],
                customer: invoice.customer!,
                paymentLink: invoice.stripe_payment_link,
                paymentInstructions: profile?.payment_instructions,
              });

              if (result.success) {
                // Update invoice status to 'sent'
                await invoiceService.updateInvoiceStatus(invoice.id, 'sent');
                loadInvoice();
                Alert.alert('Success', 'Invoice email sent successfully!');
              } else {
                Alert.alert('Error', result.error || 'Failed to send email');
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
        <ActivityIndicator size="large" color="#007AFF" />
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
        <View style={styles.header}>
          <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(invoice.status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusLabel(invoice.status).toUpperCase()}</Text>
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

        {/* Dates */}
        <View style={styles.section}>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Issue Date:</Text>
            <Text style={styles.dateValue}>{formatDate(invoice.issue_date)}</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Due Date:</Text>
            <Text style={styles.dateValue}>{formatDate(invoice.due_date)}</Text>
          </View>
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
            <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Preview & Send Section */}
        {invoice.status !== 'paid' && invoice.status !== 'void' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.previewButton}
              onPress={() => setShowPreviewModal(true)}
            >
              <Text style={styles.previewButtonText}>📄 Preview Invoice</Text>
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
            <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
              <Text style={styles.previewCloseButton}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Invoice Preview</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewContent}>
            {/* Invoice Header */}
            <View style={styles.previewInvoiceHeader}>
              <Text style={styles.previewBusinessName}>{businessName}</Text>
              <Text style={styles.previewInvoiceNumber}>{invoice.invoice_number}</Text>
            </View>

            {/* Customer Info */}
            <View style={styles.previewSection}>
              <Text style={styles.previewSectionTitle}>Bill To:</Text>
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
                <Text style={styles.previewDateValue}>{formatDate(invoice.created_at)}</Text>
              </View>
              <View style={styles.previewDateRow}>
                <Text style={styles.previewDateLabel}>Due Date:</Text>
                <Text style={styles.previewDateValue}>{formatDate(invoice.due_date)}</Text>
              </View>
            </View>

            {/* Line Items */}
            <View style={styles.previewSection}>
              <Text style={styles.previewSectionTitle}>Items:</Text>
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
                <Text style={styles.previewFinalValue}>{formatCurrency(invoice.total)}</Text>
              </View>
            </View>

            {/* Notes */}
            {invoice.notes && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Notes:</Text>
                <Text style={styles.previewNotes}>{invoice.notes}</Text>
              </View>
            )}

            {/* Payment Instructions */}
            {paymentInstructions && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Payment Methods:</Text>
                <View style={styles.paymentInstructionsBox}>
                  <Text style={styles.paymentInstructionsText}>{paymentInstructions}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Send Email Button */}
          <View style={[styles.previewActions, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            <TouchableOpacity
              style={[styles.sendEmailButton, { flex: 0, width: '100%' }, sendingEmail && styles.buttonDisabled]}
              onPress={() => {
                setShowPreviewModal(false);
                handleSendEmail();
              }}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendEmailButtonText}>📧 Send Invoice Email</Text>
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
              placeholderTextColor="#999"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 12,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dateLabel: {
    fontSize: 13,
    color: '#666',
  },
  dateValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemDescription: {
    flex: 1,
  },
  itemText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 3,
  },
  itemSubtext: {
    fontSize: 11,
    color: '#999',
  },
  itemAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  totalsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  grandTotalRow: {
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
    marginTop: 12,
    marginBottom: 0,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  grandTotalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  notesText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  paymentLink: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },
  generateButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  sendEmailButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendEmailButtonText: {
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
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  voidButton: {
    flex: 1,
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  voidButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  markPaidButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  markPaidButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  voidNotice: {
    backgroundColor: '#FFF3CD',
    borderWidth: 2,
    borderColor: '#856404',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  voidTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  voidReason: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 4,
  },
  voidDate: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
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
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalButtonCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonVoid: {
    backgroundColor: '#F44336',
  },
  modalButtonVoidText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#fff',
    marginBottom: 0, // Back to full screen now that button is visible
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  previewCloseButton: {
    fontSize: 28,
    color: '#666',
    fontWeight: '300',
    width: 40,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 20,
    paddingBottom: 100, // Space for bottom button
  },
  previewInvoiceHeader: {
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  previewBusinessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  previewInvoiceNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  previewSection: {
    marginBottom: 24,
  },
  previewSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  previewCustomerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  previewCustomerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  previewDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewDateLabel: {
    fontSize: 14,
    color: '#666',
  },
  previewDateValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  previewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  previewItemLeft: {
    flex: 1,
  },
  previewItemDescription: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  previewItemQuantity: {
    fontSize: 13,
    color: '#666',
  },
  previewItemAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  previewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewTotalLabel: {
    fontSize: 14,
    color: '#666',
  },
  previewTotalValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  previewFinalTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#333',
  },
  previewFinalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  previewFinalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  previewNotes: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  paymentInstructionsBox: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
  },
  paymentInstructionsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  previewActions: {
    padding: 16,
    paddingBottom: 16, // Dynamic padding applied inline
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});
