import JobPhotos from '../components/JobPhotos';
import { resolvePhotos } from '../services/jobPhotos';
import { JobPhoto } from '../types';
import AppIcon from '../components/AppIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '../services/supabase';
import { parseDisplayDate, positiveNumber, paymentTerms } from '../utils/invoiceValues';
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { invoiceService } from '../services/invoice';
import { customerService } from '../services/customer';
import { subscriptionService } from '../services/subscription';
import { Customer } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface NewInvoiceScreenProps {
  navigation: any;
  route: any;
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
}

export default function NewInvoiceScreen({ navigation, route }: NewInvoiceScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackFields = width < 360 || fontScale > 1.2;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const invoiceId: string | undefined = route.params?.invoiceId;
  const documentType: 'quote' | 'invoice' = route.params?.documentType || 'invoice';
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const requestId = useRef(Crypto.randomUUID());
  const draftKey = useRef<string | null>(null);
  const writes = useRef(Promise.resolve());
  const savingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
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
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerError, setCustomerError] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [draftState, setDraftState] = useState<'saving' | 'saved' | 'error'>('saving');
  const draftWriteVersion = useRef(0);
  const visibleCustomers = useMemo(() => {
    const term = customerSearch.trim().toLocaleLowerCase();
    return customers.filter(customer => `${customer.name} ${customer.email || ''} ${customer.phone || ''}`.toLocaleLowerCase().includes(term));
  }, [customers, customerSearch]);

  useEffect(() => {
    navigation.setOptions({ title: invoiceId ? 'Edit draft' : documentType === 'quote' ? 'New quote' : 'New invoice' });
  }, [navigation, invoiceId, documentType]);

  const calculateDueDate = () => {
    const days = paymentTerms(daysUntilDue) ?? 30;
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  };

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Please sign in again.');
        draftKey.current = `invoice-draft:v1:${user.id}:${invoiceId || (documentType === 'quote' ? 'new-quote' : 'new')}`;
        const stored = await AsyncStorage.getItem(draftKey.current);
        if (!active) return;
        if (stored) {
          const draft = JSON.parse(stored);
          if (draft.version !== 1 || !Array.isArray(draft.items)) throw new Error('Saved draft could not be read.');
          requestId.current = draft.requestId;
          setPhotos(await resolvePhotos(draft.photos || []));
          setSelectedCustomer(draft.selectedCustomer);
          setNewCustomerName(draft.newCustomerName);
          setNewCustomerEmail(draft.newCustomerEmail);
          setNewCustomerPhone(draft.newCustomerPhone);
          setIssueDate(parseDisplayDate(draft.issueDate));
          setDaysUntilDue(draft.daysUntilDue);
          setTaxRate(draft.taxRate); setNotes(draft.notes); setItems(draft.items);
          setDraftMessage('Your unfinished draft was restored. Changes save on this device.');
        } else if (invoiceId) {
          const invoice = await invoiceService.getInvoice(invoiceId);
          if (!active) return;
          if (invoice.status !== 'draft') throw new Error('Only drafts can be edited.');
          setPhotos(invoice.photos || []);
          setSelectedCustomer(invoice.customer || null);
          setNewCustomerName(invoice.customer_name || '');
          setNewCustomerEmail(invoice.customer?.email || '');
          setNewCustomerPhone(invoice.customer?.phone || '');
          setIssueDate(parseDisplayDate(invoice.issue_date));
          setDaysUntilDue(String(Math.round((Date.parse(invoice.due_date) - Date.parse(invoice.issue_date)) / 86400000)));
          setTaxRate(String(invoice.tax_rate)); setNotes(invoice.notes || '');
          setItems((invoice.items || []).sort((a, b) => a.sort_order - b.sort_order).map(item => ({
            id: item.id, description: item.description, quantity: String(item.quantity), unit_price: String(item.unit_price),
          })));
        }
        if (active) setReady(true);
      } catch (error: any) {
        if (active) Alert.alert('Unable to load draft', error.message, [{ text: 'Back', onPress: () => navigation.goBack() }]);
      }
    };
    restore(); loadCustomers();
    return () => { active = false; };
  }, [invoiceId, documentType]);

  useEffect(() => {
    if (!ready || !draftKey.current || savingRef.current) return;
    const key = draftKey.current;
    const draft = JSON.stringify({ version: 1, requestId: requestId.current, selectedCustomer,
      newCustomerName, newCustomerEmail, newCustomerPhone, issueDate: issueDate.toISOString(),
      daysUntilDue, taxRate, notes, items, photos: photos.map(({ path, stage }) => ({ path, stage })) });
    const version = ++draftWriteVersion.current;
    setDraftState('saving');
    // Serialize writes so a slower old write cannot overwrite a newer form.
    writes.current = writes.current.then(() => AsyncStorage.setItem(key, draft)).then(() => {
      if (version === draftWriteVersion.current) setDraftState('saved');
    }).catch(() => {
      if (version === draftWriteVersion.current) setDraftState('error');
    });
  }, [ready, selectedCustomer, newCustomerName, newCustomerEmail, newCustomerPhone, issueDate, daysUntilDue, taxRate, notes, items, photos]);

  useFocusEffect(
    React.useCallback(() => {
      // Check subscription limit immediately when screen is accessed
      const checkSubscriptionLimit = async () => {
        if (invoiceId) return;
        try {
          const canCreate = await subscriptionService.canCreateInvoice();
          if (!canCreate.allowed) {
            Alert.alert(
              Platform.OS === 'android' ? 'Upgrade Required' : 'Monthly Limit Reached',
              canCreate.reason || 'You have reached your free tier limit.',
              [
                { text: 'Maybe Later', style: 'cancel', onPress: () => navigation.goBack() },
                {
                  text: Platform.OS === 'android' ? 'Upgrade to Pro' : 'View plan',
                  onPress: () => {
                    navigation.navigate('Main', {
                      screen: 'Settings',
                      params: { focusPlan: true },
                    });
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
    }, [navigation, invoiceId])
  );

  const loadCustomers = async () => {
    setCustomersLoading(true); setCustomerError(false);
    try {
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch (error: any) {
      setCustomerError(true);
    } finally { setCustomersLoading(false); }
  };

  const addItem = () => {
    const newId = Crypto.randomUUID();
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

  const subtotal = useMemo(
    () => items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + Math.round((qty * price + Number.EPSILON) * 100) / 100;
    }, 0),
    [items]
  );

  const tax = useMemo(
    () => Math.round((subtotal * ((Number(taxRate) || 0) / 100) + Number.EPSILON) * 100) / 100,
    [subtotal, taxRate]
  );

  const invoiceTotal = useMemo(() => subtotal + tax, [subtotal, tax]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSave = async () => {
    // Validation
    if (!selectedCustomer && !newCustomerName.trim()) {
      Alert.alert('Error', 'Please select or add a customer');
      return;
    }

    const customerEmail = (selectedCustomer ? selectedCustomer.email : newCustomerEmail)?.trim();
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      Alert.alert('Check email', 'Enter a valid customer email or leave it blank.'); return;
    }
    const validDecimal = (value: string) => /^\d+(\.\d{1,2})?$/.test(value.trim());
    if (!items.length || items.some(item => !item.description.trim() ||
      positiveNumber(item.quantity) === null || positiveNumber(item.unit_price) === null ||
      !validDecimal(item.quantity) || !validDecimal(item.unit_price))) {
      Alert.alert('Check items', 'Add a description, positive quantity and price for each item. Use at most two decimal places.'); return;
    }
    if (paymentTerms(daysUntilDue) === null || !validDecimal(taxRate) || Number(taxRate) < 0 || Number(taxRate) > 100) {
      Alert.alert('Check terms', 'Enter 0–3650 days and a tax rate between 0 and 100 with at most two decimal places.'); return;
    }
    if (savingRef.current || photoBusy) return;
    savingRef.current = true; setLoading(true);
    try {
      const invoice = await invoiceService.createInvoice({
        document_type: documentType, photos: photos.map(({ path, stage }) => ({ path, stage })),
        customer_id: selectedCustomer?.id,
        customer_name: selectedCustomer?.name || newCustomerName.trim(),
        customer_email: customerEmail,
        customer_phone: selectedCustomer?.phone || newCustomerPhone.trim(),
        issue_date: issueDate, due_date: calculateDueDate(), tax_rate: Number(taxRate), notes,
        items: items.map(item => ({ description: item.description.trim(), quantity: Number(item.quantity), unit_price: Number(item.unit_price) })),
      }, requestId.current, invoiceId);
      await writes.current;
      if (draftKey.current) {
        try { await AsyncStorage.removeItem(draftKey.current); } catch {
          // A retried new draft still uses the same idempotency key.
        }
      }
      if (invoiceId) navigation.goBack();
      else navigation.replace('InvoiceDetail', { invoiceId: invoice.id });
    } catch (error: any) {
      savingRef.current = false;
      Alert.alert('Unable to save invoice', error.message);
    } finally { setLoading(false); }
  };

  if (!ready) return <ActivityIndicator style={{ flex: 1 }} size="large" color={theme.colors.primary} />;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + (Platform.OS === 'ios' ? 44 : 56)}>
      <ScrollView pointerEvents={loading ? 'none' : 'auto'} style={styles.scrollView} contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.draftStatus}>
          <View style={[styles.statusDot, { backgroundColor: draftState === 'error' ? theme.colors.error : theme.colors.primary }]} />
          <Text accessibilityLiveRegion={draftState === 'error' ? 'polite' : 'none'} style={[styles.small, draftState === 'error' && { color: theme.colors.error }]}>
            {draftState === 'error' ? 'Device save failed. Keep this draft open until you save.' : draftState === 'saved' ? 'Saved on this device' : 'Saving on this device…'}
          </Text>
        </View>
        {draftMessage ? <Text style={styles.restoreNote}>{draftMessage}</Text> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Customer</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.textButton} onPress={() => { setCustomerSearch(''); setShowCustomerPicker(true); }}>
              <Text style={styles.link}>{selectedCustomer ? 'Change' : 'Choose saved'}</Text>
            </TouchableOpacity>
          </View>
          {selectedCustomer ? <View style={styles.selectedCustomer}>
            <Text style={styles.customerName}>{selectedCustomer.name}</Text>
            {selectedCustomer.email ? <Text style={styles.detail}>{selectedCustomer.email}</Text> : null}
            {selectedCustomer.phone ? <Text style={styles.detail}>{selectedCustomer.phone}</Text> : null}
            <TouchableOpacity accessibilityRole="button" style={styles.textButton} onPress={() => setSelectedCustomer(null)}><Text style={styles.link}>Use a new customer</Text></TouchableOpacity>
          </View> : <>
            <Text style={styles.label}>Customer name</Text>
            <TextInput accessibilityLabel="Customer name, required" style={styles.input} placeholder="Name or business" placeholderTextColor={theme.colors.placeholder}
              value={newCustomerName} onChangeText={setNewCustomerName} autoCapitalize="words" />
            <Text style={styles.label}>Email <Text style={styles.optional}>· optional</Text></Text>
            <TextInput accessibilityLabel="Customer email, optional" style={styles.input} placeholder="name@example.com" placeholderTextColor={theme.colors.placeholder}
              value={newCustomerEmail} onChangeText={setNewCustomerEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>Phone <Text style={styles.optional}>· optional</Text></Text>
            <TextInput accessibilityLabel="Customer phone, optional" style={styles.input} placeholder="Phone number" placeholderTextColor={theme.colors.placeholder}
              value={newCustomerPhone} onChangeText={setNewCustomerPhone} keyboardType="phone-pad" />
          </>}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Work & materials</Text>
          {items.map((item, index) => <View key={item.id} style={styles.item}>
            <View style={styles.itemHeader}>
              <Text style={styles.small}>Item {index + 1}</Text>
              {items.length > 1 && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove item ${index + 1}`} style={styles.textButton} onPress={() => removeItem(item.id)}>
                <Text style={styles.removeLabel}>Remove</Text>
              </TouchableOpacity>}
            </View>
            <Text style={styles.label}>Description</Text>
            <TextInput accessibilityLabel={`Item ${index + 1} description`} style={styles.input} placeholder="e.g. Interior painting" placeholderTextColor={theme.colors.placeholder}
              value={item.description} onChangeText={text => updateItem(item.id, 'description', text)} />
            <View style={[styles.fieldRow, stackFields && styles.stacked]}>
              <View style={[styles.field, stackFields && styles.fullWidth]}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput accessibilityLabel={`Item ${index + 1} quantity`} style={styles.input} value={item.quantity} selectTextOnFocus
                  onChangeText={text => updateItem(item.id, 'quantity', text)} keyboardType="decimal-pad" />
              </View>
              <View style={[styles.field, stackFields && styles.fullWidth]}>
                <Text style={styles.label}>Unit price ($)</Text>
                <TextInput accessibilityLabel={`Item ${index + 1} unit price in dollars`} style={styles.input} value={item.unit_price} selectTextOnFocus
                  onChangeText={text => updateItem(item.id, 'unit_price', text)} keyboardType="decimal-pad" />
              </View>
            </View>
            <View style={styles.amountRow}><Text style={styles.small}>Line total</Text>
              <Text style={styles.lineAmount}>{formatCurrency(Math.round(((Number(item.quantity) || 0) * (Number(item.unit_price) || 0) + Number.EPSILON) * 100) / 100)}</Text>
            </View>
          </View>)}
          <TouchableOpacity accessibilityRole="button" style={styles.addItem} onPress={addItem}>
            <AppIcon name="plus" color={theme.colors.primary} size={18} /><Text style={styles.link}>Add another item</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{documentType === 'quote' ? 'Quote valid for' : 'Payment terms'}</Text>
          <Text style={styles.label}>{documentType === 'quote' ? 'Quote date' : 'Invoice date'}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Change invoice date, ${issueDate.toLocaleDateString()}`} style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.detail}>{issueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            <AppIcon name="down" color={theme.colors.textSecondary} size={18} />
          </TouchableOpacity>
          {showDatePicker && <View>
            <DateTimePicker value={issueDate} mode="date" display="default" onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === 'ios'); if (selectedDate) setIssueDate(selectedDate);
            }} />
            {Platform.OS === 'ios' && <TouchableOpacity accessibilityRole="button" style={styles.textButton} onPress={() => setShowDatePicker(false)}><Text style={styles.link}>Done</Text></TouchableOpacity>}
          </View>}
          <Text style={styles.label}>{documentType === 'quote' ? 'Quote expires' : 'Payment due'}</Text>
          <View style={styles.terms}>
            {[['0', documentType === 'quote' ? 'Today' : 'Due now'], ['7', '7 days'], ['15', '15 days'], ['30', '30 days'], ['60', '60 days']].map(([value, label]) => <TouchableOpacity key={value}
              accessibilityRole="radio" accessibilityState={{ checked: daysUntilDue === value }} style={[styles.term, daysUntilDue === value && styles.termActive]} onPress={() => setDaysUntilDue(value)}>
              <Text style={[styles.termLabel, daysUntilDue === value && styles.termLabelActive]}>{label}</Text>
            </TouchableOpacity>)}
          </View>
          <View style={[styles.fieldRow, stackFields && styles.stacked]}>
            <View style={[styles.field, stackFields && styles.fullWidth]}>
              <Text style={styles.label}>{documentType === 'quote' ? 'Days valid' : 'Days until due'}</Text>
              <TextInput accessibilityLabel="Days until due, zero means due now" style={styles.input} value={daysUntilDue} selectTextOnFocus onChangeText={setDaysUntilDue} keyboardType="number-pad" />
            </View>
            <View style={[styles.field, stackFields && styles.fullWidth]}>
              <Text style={styles.label}>Tax rate (%)</Text>
              <TextInput accessibilityLabel="Tax rate, percent" style={styles.input} value={taxRate} selectTextOnFocus onChangeText={setTaxRate} keyboardType="decimal-pad" />
            </View>
          </View>
          <Text style={styles.small}>{paymentTerms(daysUntilDue) === null ? 'Enter a whole number of days between 0 and 3650.' : `${documentType === 'quote' ? 'Valid until' : 'Due'} ${calculateDueDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}</Text>
        </View>

        <View style={styles.section}>
          <JobPhotos photos={photos} onChange={setPhotos} onBusyChange={setPhotoBusy} finished={documentType !== 'quote'} disabled={loading || photoBusy} />
          <Text style={styles.label}>Notes <Text style={styles.optional}>· optional</Text></Text>
          <TextInput accessibilityLabel="Invoice notes, optional" style={[styles.input, styles.notes]} multiline placeholder="Details for your customer" placeholderTextColor={theme.colors.placeholder}
            value={notes} onChangeText={setNotes} />
        </View>
        <View style={styles.totals}>
          <View style={styles.totalRow}><Text style={styles.detail}>Subtotal</Text><Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.detail}>Tax ({taxRate || '0'}%)</Text><Text style={styles.totalValue}>{formatCurrency(tax)}</Text></View>
          <View style={[styles.totalRow, styles.grandTotal]}><Text style={styles.totalTitle}>Total</Text><Text style={styles.totalAmount}>{formatCurrency(invoiceTotal)}</Text></View>
        </View>
        <Text style={styles.saveNote}>Saving a draft does not send it to your customer.</Text>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }, stackFields && styles.stacked]}>
        <TouchableOpacity accessibilityRole="button" style={styles.closeButton} onPress={() => navigation.goBack()} disabled={loading || photoBusy}><Text style={styles.link}>Close</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: loading, busy: loading }} style={[styles.saveButton, loading && styles.disabled, stackFields && styles.fullWidth]} onPress={handleSave} disabled={loading || photoBusy}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveLabel}>{invoiceId ? 'Save changes' : 'Save draft'}</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={showCustomerPicker} animationType="slide" transparent onRequestClose={() => setShowCustomerPicker(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View accessibilityViewIsModal style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <Text accessibilityRole="header" style={styles.modalTitle}>Choose a customer</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close customer list" style={styles.iconButton} onPress={() => setShowCustomerPicker(false)}><AppIcon name="close" color={theme.colors.text} /></TouchableOpacity>
            </View>
            <View style={styles.customerSearch}>
              <AppIcon name="search" size={18} color={theme.colors.textSecondary} />
              <TextInput accessibilityLabel="Search saved customers" style={styles.searchInput} placeholder="Search name, email, or phone" placeholderTextColor={theme.colors.placeholder} value={customerSearch} onChangeText={setCustomerSearch} autoCorrect={false} />
            </View>
            {customerError ? <View style={styles.emptyList}><Text style={styles.detail}>Could not load saved customers.</Text><TouchableOpacity accessibilityRole="button" style={styles.textButton} onPress={loadCustomers}><Text style={styles.link}>Try again</Text></TouchableOpacity></View> : customersLoading ? <ActivityIndicator style={{ padding: 24 }} color={theme.colors.primary} /> : <FlatList data={visibleCustomers} keyboardShouldPersistTaps="handled" keyExtractor={item => item.id}
              renderItem={({ item }) => <View style={styles.customerRow}>
                <TouchableOpacity accessibilityRole="button" style={styles.customerChoice} onPress={() => { setSelectedCustomer(item); setShowCustomerPicker(false); }}>
                  <Text style={styles.customerName}>{item.name}</Text>
                  {item.email ? <Text style={styles.small}>{item.email}</Text> : null}
                  {item.phone ? <Text style={styles.small}>{item.phone}</Text> : null}
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete saved customer ${item.name}`} style={styles.textButton} onPress={() => Alert.alert('Delete customer?', `Remove ${item.name} from your saved customers?`, [
                  { text: 'Keep customer', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => {
                    try { await customerService.deleteCustomer(item.id); if (selectedCustomer?.id === item.id) setSelectedCustomer(null); await loadCustomers(); }
                    catch (error: any) { Alert.alert('Could not delete customer', error.message); }
                  } },
                ])}><Text style={styles.removeLabel}>Delete</Text></TouchableOpacity>
              </View>}
              ListEmptyComponent={<View style={styles.emptyList}><Text style={styles.customerName}>{customerSearch ? 'No matching customers' : 'No saved customers yet'}</Text><Text style={styles.small}>{customerSearch ? 'Try another name, email, or phone number.' : 'Add a customer to your invoice to save them here.'}</Text></View>} />}
            <TouchableOpacity accessibilityRole="button" style={styles.newCustomerButton} onPress={() => { setSelectedCustomer(null); setShowCustomerPicker(false); }}><AppIcon name="plus" size={18} color={theme.colors.primary} /><Text style={styles.link}>Use a new customer</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  draftStatus: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  small: { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, flexShrink: 1 },
  restoreNote: { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, marginBottom: 8 },
  section: { paddingTop: 18, paddingBottom: 22, borderBottomWidth: 1, borderColor: theme.colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  sectionTitle: { fontFamily: theme.fonts.body, fontSize: 19, fontWeight: '600', color: theme.colors.text, marginBottom: 12 },
  label: { fontFamily: theme.fonts.body, fontSize: 13, fontWeight: '500', color: theme.colors.text, marginBottom: 7 },
  optional: { color: theme.colors.textSecondary, fontWeight: '400' },
  input: { minHeight: 48, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 16, fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.text },
  notes: { minHeight: 100, textAlignVertical: 'top', marginBottom: 0 },
  link: { fontFamily: theme.fonts.body, fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  textButton: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center', alignSelf: 'flex-start' },
  selectedCustomer: { borderLeftWidth: 2, borderColor: theme.colors.primary, paddingLeft: 16 },
  customerName: { fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 23, fontWeight: '600', color: theme.colors.text },
  detail: { fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary },
  item: { paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  removeLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  fieldRow: { flexDirection: 'row', gap: 16 },
  field: { flex: 1 },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  fullWidth: { flex: 0, width: '100%' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineAmount: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  addItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.inputBackground, borderRadius: 8, marginBottom: 20 },
  terms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  term: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8 },
  termActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  termLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
  termLabelActive: { color: theme.colors.primary, fontWeight: '600' },
  totals: { paddingVertical: 24, gap: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  totalValue: { fontFamily: theme.fonts.body, fontSize: 15, fontVariant: ['tabular-nums'], color: theme.colors.text },
  grandTotal: { borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 16, marginTop: 4 },
  totalTitle: { fontFamily: theme.fonts.body, fontSize: 19, fontWeight: '600', color: theme.colors.text },
  totalAmount: { fontFamily: theme.fonts.body, fontSize: 26, fontWeight: '600', fontVariant: ['tabular-nums'], color: theme.colors.primary },
  saveNote: { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 24, paddingTop: 12, backgroundColor: theme.colors.card, borderTopWidth: 1, borderColor: theme.colors.border },
  closeButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  saveButton: { flex: 1, minHeight: 48, borderRadius: 8, backgroundColor: '#1B6C53', alignItems: 'center', justifyContent: 'center', padding: 12 },
  saveLabel: { fontFamily: theme.fonts.body, color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalContent: { maxHeight: '85%', backgroundColor: theme.colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12 },
  modalTitle: { flex: 1, fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  customerSearch: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 12, backgroundColor: theme.colors.inputBackground },
  searchInput: { flex: 1, minWidth: 0, fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text, paddingVertical: 12 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: theme.colors.border },
  customerChoice: { flex: 1, paddingVertical: 16, gap: 3 },
  newCustomerButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  emptyList: { paddingVertical: 30, gap: 10 },
});
