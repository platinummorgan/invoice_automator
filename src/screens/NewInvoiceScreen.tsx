import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { invoiceService } from '../services/invoice';
import { customerService } from '../services/customer';
import { subscriptionService } from '../services/subscription';
import { Customer } from '../types';

interface NewInvoiceScreenProps {
  navigation: any;
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

export default function NewInvoiceScreen({ navigation }: NewInvoiceScreenProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [issueDate, setIssueDate] = useState(new Date());
  const [daysUntilDue, setDaysUntilDue] = useState('30');
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: '1', unit_price: '0' },
  ]);
  const [loading, setLoading] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDays, setCustomDays] = useState('');

  const calculateDueDate = () => {
    const days = parseInt(daysUntilDue) || 30;
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Check subscription limit immediately when screen is accessed
      const checkSubscriptionLimit = async () => {
        try {
          const canCreate = await subscriptionService.canCreateInvoice();
          if (!canCreate.allowed) {
            Alert.alert(
              'Upgrade Required',
              canCreate.reason || 'You have reached your free tier limit.',
              [
                { text: 'Maybe Later', style: 'cancel', onPress: () => navigation.goBack() },
                {
                  text: 'Upgrade to Pro',
                  onPress: () => {
                    navigation.goBack();
                    navigation.navigate('Settings');
                  },
                },
              ]
            );
          }
        } catch (error: any) {
          console.error('Error checking subscription:', error);
        }
      };

      checkSubscriptionLimit();
    }, [navigation])
  );

  const loadCustomers = async () => {
    try {
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const addItem = () => {
    const newId = (items.length + 1).toString();
    setItems([
      ...items,
      { id: newId, description: '', quantity: '1', unit_price: '0' },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) {
      Alert.alert('Error', 'You must have at least one item');
      return;
    }
    setItems(items.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    const rate = parseFloat(taxRate) || 0;
    return subtotal * (rate / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSave = async () => {
    // Validation
    if (!selectedCustomer && !newCustomerName) {
      Alert.alert('Error', 'Please select or add a customer');
      return;
    }

    // Require email address
    const customerEmail = newCustomerEmail || selectedCustomer?.email;
    if (!customerEmail || customerEmail.trim() === '') {
      Alert.alert('Error', 'Email address is required for all invoices');
      return;
    }

    const hasInvalidItems = items.some(
      (item) => !item.description || parseFloat(item.unit_price) <= 0
    );
    if (hasInvalidItems) {
      Alert.alert('Error', 'Please fill in all item details');
      return;
    }

    setLoading(true);
    try {
      const formData = {
        customer_id: selectedCustomer?.id,
        customer_name: newCustomerName || selectedCustomer?.name,
        customer_email: newCustomerEmail || selectedCustomer?.email,
        customer_phone: newCustomerPhone || selectedCustomer?.phone,
        issue_date: issueDate,
        due_date: calculateDueDate(),
        tax_rate: parseFloat(taxRate) || 0,
        notes,
        items: items.map((item) => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
        })),
      };

      await invoiceService.createInvoice(formData);
      
      // Increment invoice count for free users
      await subscriptionService.incrementInvoiceCount();
      
      Alert.alert('Success', 'Invoice created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Customer Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          
          {!selectedCustomer ? (
            <>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowCustomerPicker(true)}
              >
                <Text style={styles.selectButtonText}>Select Existing Customer</Text>
              </TouchableOpacity>

              <Text style={styles.orText}>OR ADD NEW CUSTOMER</Text>

              <TextInput
                style={styles.input}
                placeholder="Customer Name (Required)"
                placeholderTextColor="#999"
                value={newCustomerName}
                onChangeText={setNewCustomerName}
              />
              <TextInput
                style={styles.input}
                placeholder="Email Address (Required)"
                placeholderTextColor="#999"
                value={newCustomerEmail}
                onChangeText={setNewCustomerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number (Optional)"
                placeholderTextColor="#999"
                value={newCustomerPhone}
                onChangeText={setNewCustomerPhone}
                keyboardType="phone-pad"
              />
            </>
          ) : (
            <View style={styles.selectedCustomer}>
              <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
              {selectedCustomer.email && (
                <Text style={styles.selectedCustomerDetail}>{selectedCustomer.email}</Text>
              )}
              {selectedCustomer.phone && (
                <Text style={styles.selectedCustomerDetail}>{selectedCustomer.phone}</Text>
              )}
              <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                <Text style={styles.changeButton}>Change</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Items Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
            <TouchableOpacity onPress={addItem}>
              <Text style={styles.addButton}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemNumber}>Item {index + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Text style={styles.removeButton}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Item Description (e.g., Web Design Service)"
                placeholderTextColor="#999"
                value={item.description}
                onChangeText={(text) => updateItem(item.id, 'description', text)}
              />

              <View style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemRowInput]}
                  placeholder="Qty"
                  placeholderTextColor="#999"
                  value={item.quantity}
                  onFocus={() => {
                    if (item.quantity === '0' || item.quantity === '1') {
                      updateItem(item.id, 'quantity', '');
                    }
                  }}
                  onChangeText={(text) => updateItem(item.id, 'quantity', text)}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.itemRowInput]}
                  placeholder="Price ($)"
                  placeholderTextColor="#999"
                  value={item.unit_price}
                  onFocus={() => {
                    if (item.unit_price === '0') {
                      updateItem(item.id, 'unit_price', '');
                    }
                  }}
                  onChangeText={(text) => updateItem(item.id, 'unit_price', text)}
                  keyboardType="numeric"
                />
                <View style={styles.itemAmount}>
                  <Text style={styles.itemAmountLabel}>Amount</Text>
                  <Text style={styles.itemAmountValue}>
                    {formatCurrency(
                      (parseFloat(item.quantity) || 0) *
                        (parseFloat(item.unit_price) || 0)
                    )}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Tax & Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Invoice Date</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.datePickerButtonText}>
                {issueDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </Text>
              <Text style={styles.datePickerIcon}>📅</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Days Until Due</Text>
            <View style={styles.daysPickerRow}>
              <TouchableOpacity
                style={styles.daysButton}
                onPress={() => setDaysUntilDue('7')}
              >
                <Text style={[styles.daysButtonText, daysUntilDue === '7' && styles.daysButtonActive]}>
                  7 days
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.daysButton}
                onPress={() => setDaysUntilDue('15')}
              >
                <Text style={[styles.daysButtonText, daysUntilDue === '15' && styles.daysButtonActive]}>
                  15 days
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.daysButton}
                onPress={() => setDaysUntilDue('30')}
              >
                <Text style={[styles.daysButtonText, daysUntilDue === '30' && styles.daysButtonActive]}>
                  30 days
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.daysButton}
                onPress={() => setDaysUntilDue('60')}
              >
                <Text style={[styles.daysButtonText, daysUntilDue === '60' && styles.daysButtonActive]}>
                  60 days
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.daysPickerRow}>
              <View style={[styles.daysButton, styles.customDaysButton]}>
                <TextInput
                  style={styles.customDaysInput}
                  placeholder="Custom"
                  placeholderTextColor="#fff"
                  value={customDays}
                  onChangeText={(text) => {
                    setCustomDays(text);
                    if (text) {
                      setDaysUntilDue(text);
                    }
                  }}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Due Date</Text>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateText}>
                {calculateDueDate().toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </Text>
              <Text style={styles.dateSubtext}>
                {daysUntilDue} days from invoice date
              </Text>
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tax Rate (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="0 (e.g., 8.5 for 8.5% tax)"
              placeholderTextColor="#999"
              value={taxRate}
              onFocus={() => {
                if (taxRate === '0') {
                  setTaxRate('');
                }
              }}
              onChangeText={setTaxRate}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Payment terms, thank you message, etc. (Optional)"
              placeholderTextColor="#999"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Totals Section */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(calculateSubtotal())}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax ({taxRate}%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(calculateTax())}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(calculateTotal())}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonPrimaryText}>Create Invoice</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Customer Picker Modal */}
      <Modal
        visible={showCustomerPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomerPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Customer</Text>
              <TouchableOpacity onPress={() => setShowCustomerPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={customers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.customerItem}>
                  <TouchableOpacity
                    style={styles.customerItemContent}
                    onPress={() => {
                      setSelectedCustomer(item);
                      setShowCustomerPicker(false);
                    }}
                  >
                    <View>
                      <Text style={styles.customerItemName}>{item.name}</Text>
                      {item.email && (
                        <Text style={styles.customerItemDetail}>{item.email}</Text>
                      )}
                      {item.phone && (
                        <Text style={styles.customerItemDetail}>{item.phone}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.customerDeleteButton}
                    onPress={() => {
                      Alert.alert(
                        'Delete Customer',
                        `Are you sure you want to delete ${item.name}?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await customerService.deleteCustomer(item.id);
                                await loadCustomers();
                                Alert.alert('Success', 'Customer deleted');
                              } catch (error: any) {
                                Alert.alert('Error', error.message);
                              }
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.customerDeleteText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>No customers yet</Text>
                  <Text style={styles.emptyListSubtext}>
                    Create your first customer by filling the form above
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={issueDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setIssueDate(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    color: '#000000',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 8,
  },
  selectedCustomer: {
    padding: 12,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  selectedCustomerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  selectedCustomerDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  changeButton: {
    color: '#007AFF',
    fontSize: 14,
    marginTop: 8,
  },
  addButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  itemCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  removeButton: {
    color: '#F44336',
    fontSize: 14,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  itemRowInput: {
    flex: 1,
    marginBottom: 0,
  },
  itemAmount: {
    flex: 1,
    justifyContent: 'center',
  },
  itemAmountLabel: {
    fontSize: 10,
    color: '#999',
    marginBottom: 4,
  },
  itemAmountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  dateDisplay: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  dateSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  daysPickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  daysButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  daysButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  daysButtonActive: {
    color: '#007AFF',
    fontWeight: 'bold',
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
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 48,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#007AFF',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 20,
    width: '100%',
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: '300',
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  customerItemContent: {
    flex: 1,
    padding: 16,
  },
  customerItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  customerItemDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  customerDeleteButton: {
    padding: 16,
    paddingRight: 20,
  },
  customerDeleteText: {
    fontSize: 20,
  },
  emptyList: {
    padding: 40,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyListSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  datePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  datePickerIcon: {
    fontSize: 20,
  },
  customDaysButton: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#000',
  },
  customDaysInput: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    padding: 0,
  },
});
