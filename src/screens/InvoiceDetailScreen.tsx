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
} from 'react-native';
import { invoiceService } from '../services/invoice';
import { paymentService } from '../services/payment';
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
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    loadInvoice();
  }, []);

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

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
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
      case 'draft':
        return '#9E9E9E';
      default:
        return '#757575';
    }
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
            <Text style={styles.statusText}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.customerName}>{invoice.customer?.name || 'No customer'}</Text>
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

        {/* Payment Link Section */}
        {invoice.status !== 'paid' && (
          <View style={styles.section}>
            {invoice.stripe_payment_link ? (
              <>
                <Text style={styles.sectionTitle}>Payment Link</Text>
                <Text style={styles.paymentLink} numberOfLines={1}>
                  {invoice.stripe_payment_link}
                </Text>
                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={handleSharePaymentLink}
                >
                  <Text style={styles.shareButtonText}>Share Payment Link</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.generateButton, generatingLink && styles.buttonDisabled]}
                onPress={handleGeneratePaymentLink}
                disabled={generatingLink}
              >
                {generatingLink ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.generateButtonText}>Generate Payment Link</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      {invoice.status !== 'paid' && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.markPaidButton}
            onPress={handleMarkAsPaid}
          >
            <Text style={styles.markPaidButtonText}>Mark as Paid</Text>
          </TouchableOpacity>
        </View>
      )}
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
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  invoiceNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
  },
  dateValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemDescription: {
    flex: 1,
  },
  itemText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  itemSubtext: {
    fontSize: 12,
    color: '#999',
  },
  itemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
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
  buttonDisabled: {
    opacity: 0.6,
  },
  bottomActions: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  markPaidButton: {
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
});
