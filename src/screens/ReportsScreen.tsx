import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { invoiceService } from '../services/invoice';
import { useTheme } from '../contexts/ThemeContext';

interface MonthlyReport {
  month: string; year: number; totalInvoices: number;
  paidAmount: number; unpaidAmount: number; paidCount: number; unpaidCount: number;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReportsScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 360 || fontScale > 1.3;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(false);
    invoiceService.getMonthlyReports(year)
      .then(data => { if (active) setReports(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [year, retry]));

  const totals = reports.reduce((sum, row) => ({
    count: sum.count + row.totalInvoices,
    paid: sum.paid + row.paidAmount, unpaid: sum.unpaid + row.unpaidAmount,
    paidCount: sum.paidCount + row.paidCount, unpaidCount: sum.unpaidCount + row.unpaidCount,
  }), { count: 0, paid: 0, unpaid: 0, paidCount: 0, unpaidCount: 0 });
  const invoiceCount = (n: number) => `${n} invoice${n === 1 ? '' : 's'}`;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.description}>See what’s paid and what’s still outstanding.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.years}>
      {Array.from({ length: 5 }, (_, i) => currentYear - i).map(value =>
        <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: year === value }}
          accessibilityLabel={`Show reports for ${value}`} onPress={() => setYear(value)}
          style={[styles.year, year === value && styles.selectedYear]}>
          <Text style={[styles.yearText, year === value && styles.selectedText]}>{value}</Text>
        </TouchableOpacity>)}
    </ScrollView>
    {loading ? <View style={styles.message}><ActivityIndicator accessibilityLabel="Loading reports" color={theme.colors.primary} /></View>
      : error ? <View style={styles.message}>
        <Text style={styles.heading}>Reports couldn’t load</Text>
        <Text style={styles.description}>Check your connection and try again.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => setRetry(n => n + 1)}><Text style={styles.buttonText}>Try again</Text></TouchableOpacity>
      </View> : totals.count === 0 ? <View style={styles.message}>
        <Text style={styles.heading}>No invoices for {year}</Text>
        <Text style={styles.description}>Your totals will appear here once you add an invoice.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => navigation.navigate('NewInvoice')}><Text style={styles.buttonText}>New invoice</Text></TouchableOpacity>
      </View> : <>
        <View style={[styles.summary, compact && styles.stacked]}>
          <View style={styles.metric}><Text style={styles.label}>Paid</Text><Text style={styles.amount}>{money(totals.paid)}</Text><Text style={styles.description}>{invoiceCount(totals.paidCount)}</Text></View>
          <View style={styles.metric}><Text style={styles.label}>Outstanding</Text><Text style={styles.amount}>{money(totals.unpaid)}</Text><Text style={styles.description}>{invoiceCount(totals.unpaidCount)}</Text></View>
        </View>
        <Text style={styles.note}>Grouped by invoice date, not payment date. Drafts and voided invoices are excluded from amounts.</Text>
        <View style={styles.sectionHeader}><Text style={styles.heading}>By month</Text><Text style={styles.description}>{year}</Text></View>
        {MONTHS.map((month, index) => {
          const report = reports.find(row => Number(row.month) === index + 1);
          return <View key={month} style={styles.month}>
            <View style={styles.monthHeading}><Text style={styles.monthName}>{month}</Text><Text style={styles.description}>{report ? invoiceCount(report.totalInvoices) : 'No invoices'}</Text></View>
            {report && <View style={[styles.monthAmounts, compact && styles.stacked]}>
              <View style={styles.metric}><Text style={styles.description}>Paid</Text><Text style={styles.value}>{money(report.paidAmount)}</Text></View>
              <View style={styles.metric}><Text style={styles.description}>Outstanding</Text><Text style={styles.value}>{money(report.unpaidAmount)}</Text></View>
            </View>}
          </View>;
        })}
      </>}
  </ScrollView>;
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, paddingTop: 8, paddingBottom: 40 },
  description: { fontFamily: theme.fonts.body, color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  years: { gap: 8, paddingVertical: 22 },
  year: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border },
  selectedYear: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  yearText: { fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.text },
  selectedText: { color: theme.colors.background, fontWeight: '600' },
  summary: { flexDirection: 'row', gap: 24, paddingVertical: 18 },
  stacked: { flexDirection: 'column' },
  metric: { flex: 1, minWidth: 0, gap: 5 },
  label: { fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.text },
  amount: { fontFamily: theme.fonts.body, fontSize: 27, fontWeight: '600', color: theme.colors.primary, fontVariant: ['tabular-nums'] },
  note: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary, marginTop: 8, marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingBottom: 14 },
  heading: { fontFamily: theme.fonts.body, fontSize: 21, fontWeight: '600', color: theme.colors.text },
  month: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingVertical: 18, gap: 14 },
  monthHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  monthName: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: theme.colors.text },
  monthAmounts: { flexDirection: 'row', gap: 24 },
  value: { fontFamily: theme.fonts.body, fontSize: 18, color: theme.colors.text, fontVariant: ['tabular-nums'] },
  message: { paddingVertical: 50, gap: 16 },
  button: { backgroundColor: '#1B6C53', borderRadius: 6, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 12 },
  buttonText: { color: '#fff', fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600' },
});
