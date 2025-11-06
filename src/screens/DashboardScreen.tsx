import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { invoiceService } from '../services/invoice';
import { subscriptionService } from '../services/subscription';
import { Invoice } from '../types';

interface DashboardScreenProps {
  navigation: any;
}

export default function DashboardScreen({ navigation }: DashboardScreenProps) {
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
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [filter, dateRange]);

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
      style={styles.invoiceCard}
      onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}
    >
      <View style={styles.invoiceHeader}>
        <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status).toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.customerName}>
        {item.customer?.name || item.customer_name || 'No customer'}
      </Text>

      <View style={styles.invoiceFooter}>
        <Text style={styles.invoiceDate}>Due: {formatDate(item.due_date)}</Text>
        <Text style={styles.invoiceAmount}>{formatCurrency(item.total)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Invoices</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Paid</Text>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>
            {formatCurrency(stats.paidAmount)}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Unpaid</Text>
          <Text style={[styles.statValue, { color: '#F44336' }]}>
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
      <View style={styles.dateRangeContainer}>
        <TouchableOpacity
          style={[styles.dateRangeButton, dateRange === 'all' && styles.dateRangeButtonActive]}
          onPress={() => setDateRange('all')}
        >
          <Text style={[styles.dateRangeText, dateRange === 'all' && styles.dateRangeTextActive]}>
            All Time
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateRangeButton, dateRange === 'month' && styles.dateRangeButtonActive]}
          onPress={() => setDateRange('month')}
        >
          <Text style={[styles.dateRangeText, dateRange === 'month' && styles.dateRangeTextActive]}>
            This Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateRangeButton, dateRange === 'lastMonth' && styles.dateRangeButtonActive]}
          onPress={() => setDateRange('lastMonth')}
        >
          <Text style={[styles.dateRangeText, dateRange === 'lastMonth' && styles.dateRangeTextActive]}>
            Last Month
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateRangeButton, dateRange === 'year' && styles.dateRangeButtonActive]}
          onPress={() => setDateRange('year')}
        >
          <Text style={[styles.dateRangeText, dateRange === 'year' && styles.dateRangeTextActive]}>
            This Year
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
          <Text style={[styles.filterCount, filter === 'all' && styles.filterCountActive]}>
            ({stats.total})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'paid' && styles.filterTabActive]}
          onPress={() => setFilter('paid')}
        >
          <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>
            Paid
          </Text>
          <Text style={[styles.filterCount, filter === 'paid' && styles.filterCountActive]}>
            ({stats.paid})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unpaid' && styles.filterTabActive]}
          onPress={() => setFilter('unpaid')}
        >
          <Text style={[styles.filterText, filter === 'unpaid' && styles.filterTextActive]}>
            Unpaid
          </Text>
          <Text style={[styles.filterCount, filter === 'unpaid' && styles.filterCountActive]}>
            ({stats.unpaid})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'voided' && styles.filterTabActive]}
          onPress={() => setFilter('voided')}
        >
          <Text style={[styles.filterText, filter === 'voided' && styles.filterTextActive]}>
            Voided
          </Text>
          <Text style={[styles.filterCount, filter === 'voided' && styles.filterCountActive]}>
            ({stats.voided})
          </Text>
        </TouchableOpacity>
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
            <Text style={styles.emptyText}>No invoices yet</Text>
            <Text style={styles.emptySubtext}>Create your first invoice to get started</Text>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateRangeButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
  },
  dateRangeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  dateRangeTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  filterCount: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
    marginTop: 4,
  },
  filterCountActive: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  customerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: 12,
    color: '#999',
  },
  invoiceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
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
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
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
