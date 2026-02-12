import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { invoiceService } from '../services/invoice';
import { subscriptionService } from '../services/subscription';
import { Invoice } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardScreenProps {
  navigation: any;
}

const DATE_RANGE_OPTIONS: Array<{ key: 'all' | 'month' | 'lastMonth' | 'year'; label: string }> = [
  { key: 'all', label: 'All Time' },
  { key: 'month', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'year', label: 'This Year' },
];

const STATUS_FILTER_OPTIONS: Array<{ key: 'all' | 'paid' | 'unpaid' | 'voided'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'paid', label: 'Paid' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'voided', label: 'Voided' },
];

const withOpacity = (hexColor: string, opacity: string) => `${hexColor}${opacity}`;

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    unpaid: 0,
    voided: 0,
    totalAmount: 0,
    paidAmount: 0,
    unpaidAmount: 0,
  });
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'voided'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'lastMonth' | 'year'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  const loadData = async () => {
    try {
      // Calculate date range
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (dateRange !== 'all') {
        const now = new Date();
        endDate = now.toISOString();
        
        if (dateRange === 'month') {
          // This month: first day of current month to now
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        } else if (dateRange === 'lastMonth') {
          // Last month: first day to last day of previous month
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          startDate = lastMonth.toISOString();
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
        } else if (dateRange === 'year') {
          // This year: Jan 1 to now
          startDate = new Date(now.getFullYear(), 0, 1).toISOString();
        }
      }

      const [invoicesData, statsData] = await Promise.all([
        invoiceService.getInvoices(filter === 'all' ? undefined : filter, startDate, endDate),
        invoiceService.getDashboardStats(startDate, endDate),
      ]);
      setInvoices(invoicesData);
      setStats(statsData);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
      loadSubscription();
    });
    
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [filter, dateRange]);

  const loadSubscription = async () => {
    try {
      const status = await subscriptionService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (error: any) {
      // Ignore "no rows" errors (user doesn't have subscription)
      if (error?.code !== 'PGRST116') {
        console.error('Error loading subscription:', error);
      }
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [filter, dateRange]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return theme.colors.success;
      case 'sent':
        return theme.colors.info;
      case 'overdue':
        return theme.colors.error;
      case 'void':
      case 'cancelled':
        return theme.colors.textSecondary;
      case 'draft':
        return theme.colors.warning;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'draft' ? 'open' : status;
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderInvoiceItem = ({ item }: { item: Invoice }) => (
    <TouchableOpacity
      style={[
        styles.invoiceCard,
        {
          borderLeftColor: getStatusColor(item.status),
        },
      ]}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
    >
      <View style={styles.invoiceHeader}>
        <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: withOpacity(getStatusColor(item.status), '1A'),
              borderColor: withOpacity(getStatusColor(item.status), '55'),
            },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status).toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.customerName}>
        {item.customer?.name || item.customer_name || 'No customer'}
      </Text>

      <View style={styles.invoiceFooter}>
        <Text style={styles.invoiceDate}>Due {formatDate(item.due_date)}</Text>
        <Text style={styles.invoiceAmount}>{formatCurrency(item.total)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBlock}>
        <Text style={styles.headerTitle}>Invoice Overview</Text>
        <Text style={styles.headerSubtitle}>
          {invoices.length} invoice{invoices.length === 1 ? '' : 's'} in this view
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Invoices</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
        <View style={[styles.statCard, styles.statCardHighlighted]}>
          <Text style={styles.statLabel}>Collected</Text>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {formatCurrency(stats.paidAmount)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Outstanding</Text>
          <Text style={[styles.statValue, { color: theme.colors.error }]}>
            {formatCurrency(stats.unpaidAmount)}
          </Text>
        </View>
      </View>

      {/* Pro Upgrade Banner (for free users) */}
      {subscriptionStatus && !subscriptionStatus.isPro && (
        <TouchableOpacity 
          style={styles.proBanner}
          onPress={() => navigation.navigate('Settings')}
        >
          <View style={styles.proBannerContent}>
            <Text style={styles.proBannerEmoji}>⭐</Text>
            <View style={styles.proBannerText}>
              <Text style={styles.proBannerTitle}>Upgrade to Pro</Text>
              <Text style={styles.proBannerSubtitle}>
                {subscriptionStatus.remainingInvoices} of {subscriptionStatus.invoiceLimit} free invoices left • Unlimited for $3.99/mo
              </Text>
            </View>
            <Text style={styles.proBannerArrow}>›</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Date Range Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Date range</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {DATE_RANGE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.dateRangeButton,
                dateRange === option.key && styles.dateRangeButtonActive,
              ]}
              onPress={() => setDateRange(option.key)}
            >
              <Text
                style={[
                  styles.dateRangeText,
                  dateRange === option.key && styles.dateRangeTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.filterContainer}>
          {STATUS_FILTER_OPTIONS.map((option) => {
            const countMap = {
              all: stats.total,
              paid: stats.paid,
              unpaid: stats.unpaid,
              voided: stats.voided,
            } as const;

            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.filterTab, filter === option.key && styles.filterTabActive]}
                onPress={() => setFilter(option.key)}
              >
                <Text style={[styles.filterText, filter === option.key && styles.filterTextActive]}>
                  {option.label}
                </Text>
                <Text
                  style={[styles.filterCount, filter === option.key && styles.filterCountActive]}
                >
                  ({countMap[option.key]})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Invoice List */}
      <FlatList
        data={invoices}
        renderItem={renderInvoiceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No invoices yet</Text>
            <Text style={styles.emptySubtext}>Create your first invoice to get started.</Text>
          </View>
        }
      />

      {/* Create Invoice Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewInvoice')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  statCardHighlighted: {
    borderColor: withOpacity(theme.colors.success, '55'),
    backgroundColor: withOpacity(theme.colors.success, theme.colors.background === '#000000' ? '1F' : '12'),
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  filterScrollContent: {
    paddingRight: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 8,
  },
  dateRangeButton: {
    minWidth: 94,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: 8,
  },
  dateRangeButtonActive: {
    backgroundColor: withOpacity(theme.colors.primary, theme.colors.background === '#000000' ? '33' : '14'),
    borderColor: theme.colors.primary,
  },
  dateRangeText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  dateRangeTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  filterCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '400',
    marginTop: 4,
  },
  filterCountActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    paddingTop: 6,
    paddingBottom: 96,
  },
  invoiceCard: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  customerName: {
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 10,
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  invoiceAmount: {
    fontSize: 19,
    fontWeight: '700',
    color: theme.colors.text,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '300',
  },
  proBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.primary, 'AA'),
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
  },
  proBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proBannerEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  proBannerText: {
    flex: 1,
  },
  proBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  proBannerSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
  },
  proBannerArrow: {
    fontSize: 24,
    color: '#fff',
    marginLeft: 8,
  },
});
