import React, { useState, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calendarDate } from '../utils/invoiceValues';
import { invoiceService } from '../services/invoice';
import { subscriptionService } from '../services/subscription';
import { supabase } from '../services/supabase';
import { Invoice } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import InvoiceHome, { InvoiceFilter, InvoicePeriod } from '../components/InvoiceHome';

export default function DashboardScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof invoiceService.getDashboardStats>> | null>(null);
  const [filter, setFilter] = useState<InvoiceFilter>('all');
  const [period, setPeriod] = useState<InvoicePeriod>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localDraftName, setLocalDraftName] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const request = useRef(0);

  const loadData = useCallback(async (refresh = false) => {
    const current = ++request.current;
    setError(null);
    if (refresh) setRefreshing(true); else { setLoading(true); setSummary(null); }
    const now = new Date();
    let start: string | undefined;
    let end: string | undefined;
    if (period !== 'all') {
      end = calendarDate(now);
      if (period === 'month') start = calendarDate(new Date(now.getFullYear(), now.getMonth(), 1));
      if (period === 'lastMonth') {
        start = calendarDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        end = calendarDate(new Date(now.getFullYear(), now.getMonth(), 0));
      }
      if (period === 'year') start = calendarDate(new Date(now.getFullYear(), 0, 1));
    }
    try {
      const [rows, stats] = await Promise.all([
        invoiceService.getInvoices(filter === 'all' ? undefined : filter, start, end),
        invoiceService.getDashboardStats(start, end),
      ]);
      if (request.current !== current) return;
      setInvoices(rows); setSummary(stats);
    } catch {
      if (request.current === current) {
        setInvoices([]); setSummary(null);
        setError('Could not load your invoices. Check your connection and try again.');
      }
    } finally {
      if (request.current === current) { setLoading(false); setRefreshing(false); }
    }
  }, [filter, period]);

  useFocusEffect(useCallback(() => {
    loadData();
    return () => { request.current++; };
  }, [loadData]));

  useFocusEffect(useCallback(() => {
    let active = true;
    const loadExtras = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const stored = session ? await AsyncStorage.getItem(`invoice-draft:v1:${session.user.id}:new`) : null;
        const draft = stored ? JSON.parse(stored) : null;
        const hasContent = draft && (draft.selectedCustomer || draft.newCustomerName?.trim() || draft.items?.some((item: { description?: string }) => item.description?.trim()));
        if (active) setLocalDraftName(hasContent ? draft.selectedCustomer?.name || draft.newCustomerName || '' : null);
      } catch { if (active) setLocalDraftName(null); }
      try {
        const status = await subscriptionService.getSubscriptionStatus();
        if (active) setLimitReached(!status.isPro && status.remainingInvoices === 0);
      } catch { /* Invoice access must not depend on the plan hint. */ }
    };
    loadExtras();
    return () => { active = false; };
  }, []));

  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <InvoiceHome theme={theme} invoices={invoices} summary={summary} filter={filter} period={period}
      loading={loading} refreshing={refreshing} error={error} localDraftName={localDraftName} limitReached={limitReached}
      onFilter={setFilter} onPeriod={setPeriod} onRefresh={() => loadData(true)}
      onCreate={() => navigation.navigate('NewInvoice')}
      onOpen={invoiceId => navigation.navigate('InvoiceDetail', { invoiceId })}
      onPlans={() => navigation.navigate('Settings', { focusPlan: true })} />
  </SafeAreaView>;
}
