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
} from 'react-native';
import { invoiceService } from '../services/invoice';
import { customerService } from '../services/customer';
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
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  const [taxRate, setTaxRate] = useState('0');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: '1', unit_price: '0' },
  ]);
  const [loading, setLoading] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

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
    return `$${amount.toFixed(2)}`;
  };

  const handleSave = async () => {
    // Validation
    if (!selectedCustomer && !newCustomerName) {
      Alert.alert('Error', 'Please select or add a customer');
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
        due_date: dueDate,
        tax_rate: parseFloat(taxRate) || 0,
        notes,
        items: items.map((item) => ({
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
        })),
      };

      await invoiceService.createInvoice(formData);
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

              <Text style={styles.orText}>OR</Text>

              <TextInput
                style={styles.input}
                placeholder="Customer Name *"
                value={newCustomerName}
                onChangeText={setNewCustomerName}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={newCustomerEmail}
                onChangeText={setNewCustomerEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Phone"
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
                placeholder="Description *"
                value={item.description}
                onChangeText={(text) => updateItem(item.id, 'description', text)}
              />

              <View style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemRowInput]}
                  placeholder="Qty"
                  value={item.quantity}
                  onChangeText={(text) => updateItem(item.id, 'quantity', text)}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.itemRowInput]}
                  placeholder="Unit Price"
                  value={item.unit_price}
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
            <Text style={styles.inputLabel}>Tax Rate (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              value={taxRate}
              onChangeText={setTaxRate}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Additional notes..."
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

      {/* Customer Picker Modal would go here - simplified for MVP */}
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
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
});
