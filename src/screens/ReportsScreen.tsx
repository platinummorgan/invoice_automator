import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { invoiceService } from '../services/invoice';
import { useTheme } from '../contexts/ThemeContext';

const { width } = Dimensions.get('window');

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
  const { theme } = useTheme();
  const styles = createStyles(theme);
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

  const getInsights = () => {
    const totals = calculateYearTotals();
    const collectionRate = totals.totalInvoices > 0 
      ? (totals.paidCount / totals.totalInvoices * 100).toFixed(0)
      : 0;
    const avgInvoiceValue = totals.paidCount > 0 
      ? totals.paidAmount / totals.paidCount
      : 0;
    
    // Find best month
    const bestMonth = monthlyReports.reduce((best, current) => 
      current.paidAmount > (best?.paidAmount || 0) ? current : best
    , monthlyReports[0]);

    return {
      collectionRate,
      avgInvoiceValue,
      bestMonth,
      totalRevenue: totals.paidAmount,
      outstandingAmount: totals.unpaidAmount,
    };
  };

  const renderMiniBarChart = () => {
    if (monthlyReports.length === 0) return null;
    
    const maxAmount = Math.max(...monthlyReports.map(r => r.paidAmount));
    const chartWidth = width - 64;
    const barWidth = (chartWidth / monthlyReports.length) - 8;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Monthly Revenue Trend</Text>
        <View style={styles.chartBars}>
          {monthlyReports.map((report, index) => {
            const height = maxAmount > 0 ? (report.paidAmount / maxAmount) * 100 : 0;
            return (
              <View key={index} style={styles.barWrapper}>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      { 
                        height: `${height}%`,
                        width: barWidth,
                        backgroundColor: report.paidAmount > 0 ? theme.colors.primary : theme.colors.border,
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.barLabel}>{getMonthName(report.month)}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const yearTotals = calculateYearTotals();
  const insights = getInsights();
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pageIntroCard}>
          <Text style={styles.pageIntroKicker}>ANALYTICS</Text>
          <Text style={styles.pageIntroTitle}>Cashflow Snapshot</Text>
          <Text style={styles.pageIntroSubtitle}>
            Track revenue momentum, unpaid risk, and month-over-month performance.
          </Text>
        </View>

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

        {monthlyReports.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No invoices for {yearFilter}</Text>
            <Text style={styles.emptySubtext}>Create your first invoice to see analytics</Text>
          </View>
        ) : (
          <>
            {/* Key Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: '#4CAF50' + '15' }]}>
                <Text style={styles.metricIcon}>💰</Text>
                <Text style={styles.metricValue}>{formatCurrency(insights.totalRevenue)}</Text>
                <Text style={styles.metricLabel}>Total Revenue</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#F44336' + '15' }]}>
                <Text style={styles.metricIcon}>⏳</Text>
                <Text style={styles.metricValue}>{formatCurrency(insights.outstandingAmount)}</Text>
                <Text style={styles.metricLabel}>Outstanding</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: theme.colors.primary + '15' }]}>
                <Text style={styles.metricIcon}>📈</Text>
                <Text style={styles.metricValue}>{insights.collectionRate}%</Text>
                <Text style={styles.metricLabel}>Collection Rate</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#FFC107' + '15' }]}>
                <Text style={styles.metricIcon}>🎯</Text>
                <Text style={styles.metricValue}>{formatCurrency(insights.avgInvoiceValue)}</Text>
                <Text style={styles.metricLabel}>Avg Invoice</Text>
              </View>
            </View>

            {/* Chart */}
            {renderMiniBarChart()}

            {/* Insights Section */}
            <View style={styles.insightsContainer}>
              <Text style={styles.sectionTitle}>💡 Insights</Text>
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  ⭐ <Text style={styles.insightBold}>Best Month:</Text> {insights.bestMonth ? getMonthName(insights.bestMonth.month) : 'N/A'} with {insights.bestMonth ? formatCurrency(insights.bestMonth.paidAmount) : '$0.00'} revenue
                </Text>
              </View>
              <View style={styles.insightCard}>
                <Text style={styles.insightText}>
                  📊 <Text style={styles.insightBold}>Invoice Performance:</Text> {yearTotals.paidCount} of {yearTotals.totalInvoices} invoices paid ({insights.collectionRate}%)
                </Text>
              </View>
              {yearTotals.unpaidCount > 0 && (
                <View style={[styles.insightCard, { backgroundColor: '#FFC107' + '15', borderLeftColor: '#FFC107' }]}>
                  <Text style={styles.insightText}>
                    ⚠️ <Text style={styles.insightBold}>Action Needed:</Text> {yearTotals.unpaidCount} unpaid invoice{yearTotals.unpaidCount > 1 ? 's' : ''} totaling {formatCurrency(yearTotals.unpaidAmount)}
                  </Text>
                </View>
              )}
            </View>

            {/* Monthly Breakdown Table */}
            <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
            <View style={styles.tableContainer}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.monthColumn]}>Month</Text>
                <Text style={[styles.tableHeaderText, styles.invoicesColumn]}>#</Text>
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
                  Total
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
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingTop: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageIntroCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: theme.colors.cardStrong,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 2,
  },
  pageIntroKicker: {
    color: theme.colors.accent,
    fontSize: 11,
    letterSpacing: 1.5,
    fontFamily: theme.fonts.body,
    marginBottom: 8,
  },
  pageIntroTitle: {
    color: theme.colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: theme.fonts.headline,
    marginBottom: 8,
  },
  pageIntroSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: theme.fonts.body,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  yearLabel: {
    fontSize: 14,
    color: theme.colors.text,
    marginRight: 12,
    fontFamily: theme.fonts.body,
  },
  yearScroll: {
    flex: 1,
  },
  yearButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
    marginRight: 8,
  },
  yearButtonActive: {
    backgroundColor: theme.colors.accent,
  },
  yearButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  yearButtonTextActive: {
    color: '#FBF7EF',
    fontFamily: theme.fonts.body,
  },
  sectionTitle: {
    fontSize: 20,
    color: theme.colors.text,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    fontFamily: theme.fonts.headline,
  },
  tableContainer: {
    backgroundColor: theme.colors.cardStrong,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeaderText: {
    fontSize: 13,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableRowAlt: {
    backgroundColor: theme.colors.background,
  },
  totalRow: {
    backgroundColor: theme.colors.accentSoft,
    borderBottomWidth: 0,
  },
  tableCellText: {
    fontSize: 13,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
  },
  totalText: {
    fontFamily: theme.fonts.headline,
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
    color: theme.colors.placeholder,
    fontFamily: theme.fonts.body,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    marginHorizontal: 16,
    backgroundColor: theme.colors.cardStrong,
    borderRadius: 16,
    marginTop: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 8,
    fontFamily: theme.fonts.headline,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.placeholder,
    fontFamily: theme.fonts.body,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  metricIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    color: theme.colors.text,
    marginBottom: 4,
    fontFamily: theme.fonts.headline,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: theme.fonts.body,
  },
  chartContainer: {
    backgroundColor: theme.colors.cardStrong,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chartTitle: {
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 16,
    fontFamily: theme.fonts.headline,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    gap: 4,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '80%',
    borderRadius: 4,
    minHeight: 2,
  },
  barLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    fontFamily: theme.fonts.body,
  },
  insightsContainer: {
    marginHorizontal: 16,
    marginBottom: 14,
  },
  insightCard: {
    backgroundColor: theme.colors.cardStrong,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  insightText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    fontFamily: theme.fonts.body,
  },
  insightBold: {
    color: theme.colors.text,
    fontFamily: theme.fonts.headline,
  },
  bottomSpacer: {
    height: 32,
  },
});
