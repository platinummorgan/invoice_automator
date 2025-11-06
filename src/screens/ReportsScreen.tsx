import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { invoiceService } from '../services/invoice';

interface MonthlyReport {
  month: string;
  year: number;
  totalInvoices: number;
  paidAmount: number;
  unpaidAmount: number;
  paidCount: number;
  unpaidCount: number;
}

interface ReportsScreenProps {
  navigation: any;
}

export default function ReportsScreen({ navigation }: ReportsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([]);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());

  useEffect(() => {
    loadReports();
  }, [yearFilter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const reports = await invoiceService.getMonthlyReports(yearFilter);
      setMonthlyReports(reports);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getMonthName = (monthNum: string) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(monthNum) - 1] || monthNum;
  };

  const calculateYearTotals = () => {
    return monthlyReports.reduce(
      (acc, report) => ({
        totalInvoices: acc.totalInvoices + report.totalInvoices,
        paidAmount: acc.paidAmount + report.paidAmount,
        unpaidAmount: acc.unpaidAmount + report.unpaidAmount,
        paidCount: acc.paidCount + report.paidCount,
        unpaidCount: acc.unpaidCount + report.unpaidCount,
      }),
      { totalInvoices: 0, paidAmount: 0, unpaidAmount: 0, paidCount: 0, unpaidCount: 0 }
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const yearTotals = calculateYearTotals();
  const years = [2026, 2025];

  return (
    <View style={styles.container}>
      {/* Year Selector */}
      <View style={styles.yearSelector}>
        <Text style={styles.yearLabel}>Year:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll}>
          {years.map((year) => (
            <TouchableOpacity
              key={year}
              style={[styles.yearButton, yearFilter === year && styles.yearButtonActive]}
              onPress={() => setYearFilter(year)}
            >
              <Text style={[styles.yearButtonText, yearFilter === year && styles.yearButtonTextActive]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Year Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
            {formatCurrency(yearTotals.paidAmount)}
          </Text>
          <Text style={styles.summarySubtext}>{yearTotals.paidCount} paid</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Outstanding</Text>
          <Text style={[styles.summaryValue, { color: '#F44336' }]}>
            {formatCurrency(yearTotals.unpaidAmount)}
          </Text>
          <Text style={styles.summarySubtext}>{yearTotals.unpaidCount} unpaid</Text>
        </View>
      </View>

      {/* Monthly Breakdown */}
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
        
        {monthlyReports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No invoices for {yearFilter}</Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.monthColumn]}>Month</Text>
              <Text style={[styles.tableHeaderText, styles.invoicesColumn]}>Invoices</Text>
              <Text style={[styles.tableHeaderText, styles.paidColumn]}>Paid</Text>
              <Text style={[styles.tableHeaderText, styles.unpaidColumn]}>Unpaid</Text>
            </View>

            {/* Table Rows */}
            {monthlyReports.map((report, index) => (
              <View 
                key={`${report.year}-${report.month}`} 
                style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
              >
                <Text style={[styles.tableCellText, styles.monthColumn]}>
                  {getMonthName(report.month)}
                </Text>
                <Text style={[styles.tableCellText, styles.invoicesColumn]}>
                  {report.totalInvoices}
                </Text>
                <Text style={[styles.tableCellText, styles.paidColumn, { color: '#4CAF50' }]}>
                  {formatCurrency(report.paidAmount)}
                  {'\n'}
                  <Text style={styles.countText}>({report.paidCount})</Text>
                </Text>
                <Text style={[styles.tableCellText, styles.unpaidColumn, { color: '#F44336' }]}>
                  {formatCurrency(report.unpaidAmount)}
                  {'\n'}
                  <Text style={styles.countText}>({report.unpaidCount})</Text>
                </Text>
              </View>
            ))}

            {/* Year Total Row */}
            <View style={[styles.tableRow, styles.totalRow]}>
              <Text style={[styles.tableCellText, styles.monthColumn, styles.totalText]}>
                Total {yearFilter}
              </Text>
              <Text style={[styles.tableCellText, styles.invoicesColumn, styles.totalText]}>
                {yearTotals.totalInvoices}
              </Text>
              <Text style={[styles.tableCellText, styles.paidColumn, styles.totalText, { color: '#4CAF50' }]}>
                {formatCurrency(yearTotals.paidAmount)}
                {'\n'}
                <Text style={styles.countText}>({yearTotals.paidCount})</Text>
              </Text>
              <Text style={[styles.tableCellText, styles.unpaidColumn, styles.totalText, { color: '#F44336' }]}>
                {formatCurrency(yearTotals.unpaidAmount)}
                {'\n'}
                <Text style={styles.countText}>({yearTotals.unpaidCount})</Text>
              </Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  yearLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  yearScroll: {
    flex: 1,
  },
  yearButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  yearButtonActive: {
    backgroundColor: '#007AFF',
  },
  yearButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  yearButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  summarySubtext: {
    fontSize: 12,
    color: '#999',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  tableContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  totalRow: {
    backgroundColor: '#e3f2fd',
    borderBottomWidth: 0,
  },
  tableCellText: {
    fontSize: 13,
    color: '#333',
  },
  totalText: {
    fontWeight: '600',
  },
  monthColumn: {
    width: 60,
  },
  invoicesColumn: {
    width: 60,
    textAlign: 'center',
  },
  paidColumn: {
    flex: 1,
    textAlign: 'right',
  },
  unpaidColumn: {
    flex: 1,
    textAlign: 'right',
  },
  countText: {
    fontSize: 11,
    color: '#999',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  bottomSpacer: {
    height: 32,
  },
});
