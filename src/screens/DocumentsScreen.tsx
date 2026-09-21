import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { invoiceService } from '../services/invoice';
import { Invoice } from '../types';
import { useTheme } from '../contexts/ThemeContext';

export default function DocumentsScreen({ navigation, route }: { navigation: any; route: any }) {
  const quotes = route.name === 'Quotes';
  const { theme } = useTheme();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    invoiceService.getInvoices(quotes ? undefined : 'paid', undefined, undefined, quotes ? 'quote' : 'invoice')
      .then(data => { if (active) setRows(data); })
      .catch(() => { if (active) setError('Could not load documents. Tap to retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [quotes, revision]));
  return <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: 20 }}>
    <Text style={{ color: theme.colors.textSecondary, marginBottom: 16 }}>{quotes ? 'Approve a quote to turn it into an invoice with the same details and pictures.' : 'Receipts become available when an invoice is marked paid. Share the PDF through your messaging app.'}</Text>
    {quotes && <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('NewInvoice', { documentType: 'quote' })} style={{ backgroundColor: theme.colors.primary, padding: 16, borderRadius: 10, marginBottom: 16 }}><Text style={{ color: 'white', fontWeight: '600' }}>New quote / resume draft</Text></TouchableOpacity>}
    {loading ? <ActivityIndicator /> : error ? <TouchableOpacity accessibilityRole="button" onPress={() => setRevision(v => v + 1)}><Text style={{ color: theme.colors.error }}>{error}</Text></TouchableOpacity> : <FlatList data={rows} keyExtractor={item => item.id} refreshing={loading} onRefresh={() => setRevision(v => v + 1)}
      ListEmptyComponent={<Text style={{ color: theme.colors.textSecondary }}>{quotes ? 'No quotes yet. Create your first quote above.' : 'No paid invoices yet.'}</Text>}
      renderItem={({ item }) => <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })} style={{ paddingVertical: 20, borderBottomWidth: 1, borderColor: theme.colors.border }}>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '600' }}>{item.customer_name || item.customer?.name}</Text>
        <Text style={{ color: theme.colors.textSecondary, marginTop: 6 }}>{item.invoice_number} · {item.status} · ${Number(item.total).toFixed(2)}</Text>
      </TouchableOpacity>} />}
  </View>;
}
