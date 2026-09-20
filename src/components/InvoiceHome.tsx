import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Modal, Pressable, useWindowDimensions } from 'react-native';
import type { Invoice } from '../types';
import type { useTheme } from '../contexts/ThemeContext';
import { calendarDate, parseDisplayDate, isOutstanding } from '../utils/invoiceValues';
import AppIcon from './AppIcon';

type Theme = ReturnType<typeof useTheme>['theme'];
export type InvoiceFilter = 'all' | 'draft' | 'unpaid' | 'paid' | 'voided';
export type InvoicePeriod = 'all' | 'month' | 'lastMonth' | 'year';
const periods: { key: InvoicePeriod; label: string }[] = [
  { key: 'all', label: 'All time' }, { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' }, { key: 'year', label: 'This year' },
];
const filters: { key: InvoiceFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'draft', label: 'Drafts' },
  { key: 'unpaid', label: 'Outstanding' }, { key: 'paid', label: 'Paid' }, { key: 'voided', label: 'Voided' },
];
const money = (amount: number) => Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const date = (value: string) => parseDisplayDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export interface InvoiceHomeProps {
  theme: Theme;
  invoices: Invoice[];
  summary: { unpaidAmount: number; paidAmount: number; overdueAmount: number } | null;
  filter: InvoiceFilter;
  period: InvoicePeriod;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  localDraftName: string | null;
  limitReached: boolean;
  onFilter: (value: InvoiceFilter) => void;
  onPeriod: (value: InvoicePeriod) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onPlans: () => void;
}

export default function InvoiceHome(props: InvoiceHomeProps) {
  const { theme, invoices, summary, filter, period, loading, refreshing, error, localDraftName } = props;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width, fontScale } = useWindowDimensions();
  const narrow = width < 360 || fontScale > 1.2;
  const stackSummary = narrow || (summary !== null && Math.max(summary.unpaidAmount, summary.overdueAmount, summary.paidAmount) >= 100000);
  const [query, setQuery] = useState('');
  const [showPeriods, setShowPeriods] = useState(false);
  const visible = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return invoices.filter(invoice => !text || `${invoice.customer_name || invoice.customer?.name || ''} ${invoice.invoice_number}`.toLocaleLowerCase().includes(text));
  }, [invoices, query]);
  const filtered = filter !== 'all' || period !== 'all' || !!query.trim();
  const today = calendarDate(new Date());

  const header = <View>
    <View style={[styles.heading, narrow && styles.stacked]}>
      <View style={[styles.headingText, narrow && styles.fullWidth]}>
        <Text style={styles.brand}>Swift Invoice</Text>
        <Text accessibilityRole="header" style={styles.title}>Invoices</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" style={styles.createButton} onPress={props.onCreate}>
        <AppIcon name="plus" color="#FFFFFF" size={18} />
        <Text style={styles.createLabel}>New invoice</Text>
      </TouchableOpacity>
    </View>

    <View style={styles.periodRow}>
      <Text style={styles.small}>By invoice date</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Invoice date range: ${periods.find(p => p.key === period)?.label}`} onPress={() => setShowPeriods(true)} style={styles.periodButton}>
        <Text style={styles.periodLabel}>{periods.find(p => p.key === period)?.label}</Text>
        <AppIcon name="down" color={theme.colors.textSecondary} size={16} />
      </TouchableOpacity>
    </View>
    <View style={[styles.summary, stackSummary && styles.stacked]}>
      {[
        { label: 'Outstanding', value: summary?.unpaidAmount, color: theme.colors.text },
        { label: 'Overdue', value: summary?.overdueAmount, color: summary?.overdueAmount ? theme.colors.error : theme.colors.text },
        { label: 'Paid', value: summary?.paidAmount, color: theme.colors.primary },
      ].map((stat, index) => <View key={stat.label} style={[styles.stat, index > 0 && !stackSummary && styles.statDivider, stackSummary && styles.statHorizontal]}>
        <Text style={styles.small}>{stat.label}</Text>
        <Text style={[styles.statValue, { color: stat.color }]}>{stat.value === undefined ? '—' : money(stat.value)}</Text>
      </View>)}
    </View>

    {localDraftName !== null && <TouchableOpacity style={styles.draft} accessibilityRole="button" onPress={props.onCreate}>
      <AppIcon name="invoice" color={theme.colors.primary} size={21} />
      <View style={styles.draftText}>
        <Text style={styles.draftTitle}>Continue draft</Text>
        <Text numberOfLines={1} style={styles.small}>{localDraftName || 'Your unfinished invoice'}</Text>
      </View>
      <AppIcon name="chevron" color={theme.colors.primary} size={18} />
    </TouchableOpacity>}

    <View style={styles.search}>
      <AppIcon name="search" color={theme.colors.textSecondary} size={19} />
      <TextInput accessibilityLabel="Search invoices by customer or invoice number" placeholder="Search customer or invoice number" placeholderTextColor={theme.colors.textSecondary}
        style={styles.searchInput} value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
      {query.length > 0 && <TouchableOpacity accessibilityLabel="Clear search" accessibilityRole="button" style={styles.clear} onPress={() => setQuery('')}>
        <AppIcon name="close" color={theme.colors.textSecondary} size={17} />
      </TouchableOpacity>}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} keyboardShouldPersistTaps="handled">
      {filters.map(option => <TouchableOpacity key={option.key} accessibilityRole="tab" accessibilityState={{ selected: filter === option.key }} onPress={() => props.onFilter(option.key)} style={[styles.filter, filter === option.key && styles.filterActive]}>
        <Text style={[styles.filterLabel, filter === option.key && styles.filterLabelActive]}>{option.label}</Text>
      </TouchableOpacity>)}
    </ScrollView>
    <View style={styles.listHeading}>
      <Text style={styles.small}>{loading ? 'Loading invoices…' : `${visible.length} invoice${visible.length === 1 ? '' : 's'}`}</Text>
      <Text style={styles.small}>Newest first</Text>
    </View>
    {error && <View accessibilityRole="alert" style={styles.error}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={props.onRefresh} style={styles.retry}><Text style={styles.link}>Try again</Text></TouchableOpacity>
    </View>}
  </View>;

  return <View style={styles.container}>
    <FlatList data={loading ? [] : visible} keyExtractor={item => item.id} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={props.onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
      renderItem={({ item }) => {
        const overdue = isOutstanding(item.status) && item.due_date < today;
        const label = overdue ? 'Overdue' : ({ draft: 'Draft', sent: 'Sent', paid: 'Paid', overdue: 'Overdue', void: 'Voided', cancelled: 'Cancelled' }[item.status]);
        const color = overdue || item.status === 'overdue' ? theme.colors.error : item.status === 'paid' ? theme.colors.primary : theme.colors.textSecondary;
        const customer = item.customer_name || item.customer?.name || 'Customer not recorded';
        const timing = item.status === 'paid' ? `Paid${item.paid_at ? ` ${date(item.paid_at)}` : ''}` : item.status === 'draft' ? `Created ${date(item.issue_date)}` : ['void', 'cancelled'].includes(item.status) ? `Issued ${date(item.issue_date)}` : `Due ${date(item.due_date)}`;
        return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${customer}, ${money(item.total)}, ${label}, ${timing}, ${item.invoice_number}`} onPress={() => props.onOpen(item.id)} style={styles.invoiceRow} activeOpacity={0.65}>
          <View style={[styles.rowTop, narrow && styles.stacked]}>
            <Text style={[styles.customer, narrow && styles.fullWidth]} numberOfLines={2}>{customer}</Text>
            <Text style={styles.amount}>{money(item.total)}</Text>
          </View>
          <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
          <View style={styles.rowBottom}>
            <View style={styles.status}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={[styles.statusLabel, { color }]}>{label}</Text></View>
            <Text style={[styles.small, overdue && { color }]}>{timing}</Text>
          </View>
        </TouchableOpacity>;
      }}
      ListEmptyComponent={loading ? <ActivityIndicator style={styles.loader} color={theme.colors.primary} /> : !error ? <View style={styles.empty}>
        <AppIcon name={filtered ? 'search' : 'invoice'} color={theme.colors.textSecondary} size={30} />
        <Text style={styles.emptyTitle}>{filtered ? 'No matching invoices' : 'Your first invoice starts here'}</Text>
        <Text style={styles.emptyCopy}>{filtered ? 'Try another customer, date range, or status.' : 'Add a customer and the work you did. You can save a draft before sending.'}</Text>
        {filtered && <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => { setQuery(''); props.onFilter('all'); props.onPeriod('all'); }}><Text style={styles.link}>Clear filters</Text></TouchableOpacity>}
      </View> : null}
      ListFooterComponent={props.limitReached ? <TouchableOpacity accessibilityRole="button" onPress={props.onPlans} style={styles.limit}>
        <Text style={styles.small}>You've used this month's free invoices.</Text><Text style={styles.link}>View plans</Text>
      </TouchableOpacity> : null}
    />
    <Modal visible={showPeriods} transparent animationType="fade" onRequestClose={() => setShowPeriods(false)}>
      <View style={styles.modal}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close date range options" style={StyleSheet.absoluteFill} onPress={() => setShowPeriods(false)} />
        <View accessibilityViewIsModal style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.sheetTitle}>Invoice date</Text>
          {periods.map(option => <TouchableOpacity accessibilityRole="radio" accessibilityState={{ checked: period === option.key }} key={option.key} style={styles.option} onPress={() => { props.onPeriod(option.key); setShowPeriods(false); }}>
            <Text style={styles.optionLabel}>{option.label}</Text><View style={[styles.radio, period === option.key && styles.radioSelected]} />
          </TouchableOpacity>)}
          <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => setShowPeriods(false)}><Text style={styles.link}>Close</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 22 },
  headingText: { flex: 1 },
  brand: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginBottom: 6 },
  title: { fontFamily: theme.fonts.body, fontSize: 32, fontWeight: '700', letterSpacing: -0.9, color: theme.colors.text },
  createButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 46, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#1B6C53' },
  createLabel: { fontFamily: theme.fonts.body, fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodButton: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 5, paddingLeft: 12 },
  periodLabel: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, fontWeight: '600' },
  small: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  summary: { flexDirection: 'row', paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border, marginBottom: 24 },
  stat: { flex: 1, gap: 7 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: theme.colors.border, paddingLeft: 12 },
  statValue: { fontFamily: theme.fonts.body, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  statHorizontal: { flex: 0, flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center' },
  fullWidth: { flex: 0, width: '100%' },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 12 },
  draft: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: theme.colors.card, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border },
  draftText: { flex: 1, gap: 2 },
  draftTitle: { fontFamily: theme.fonts.body, color: theme.colors.primary, fontSize: 14, fontWeight: '600' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingLeft: 12, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.text, paddingVertical: 12, paddingRight: 10 },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 22, paddingTop: 12 },
  filter: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterActive: { borderBottomColor: theme.colors.primary },
  filterLabel: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary },
  filterLabelActive: { color: theme.colors.primary, fontWeight: '600' },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  invoiceRow: { paddingVertical: 19, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowTop: { flexDirection: 'row', gap: 16, justifyContent: 'space-between', alignItems: 'baseline' },
  customer: { flex: 1, fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 23, fontWeight: '600', color: theme.colors.text },
  amount: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: theme.colors.text, fontVariant: ['tabular-nums'] },
  invoiceNumber: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontFamily: theme.fonts.body, fontSize: 12 },
  loader: { marginVertical: 50 },
  empty: { paddingVertical: 44, alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: theme.fonts.body, fontSize: 18, fontWeight: '600', color: theme.colors.text, textAlign: 'center' },
  emptyCopy: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 22, textAlign: 'center', maxWidth: 290 },
  link: { fontFamily: theme.fonts.body, color: theme.colors.primary, fontSize: 14, fontWeight: '600' },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  error: { paddingVertical: 16 },
  errorText: { color: theme.colors.error, fontSize: 14, fontFamily: theme.fonts.body },
  limit: { paddingTop: 24, gap: 8, minHeight: 70 },
  modal: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: theme.colors.card, borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, alignSelf: 'center' },
  sheetTitle: { fontFamily: theme.fonts.body, color: theme.colors.text, fontSize: 20, fontWeight: '600', marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  optionLabel: { fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.text },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: theme.colors.textSecondary },
  radioSelected: { borderWidth: 5, borderColor: theme.colors.primary },
});
