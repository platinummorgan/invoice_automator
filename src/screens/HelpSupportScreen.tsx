import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface HelpSupportScreenProps {
  navigation: any;
}

const FAQ_ITEMS = [
  {
    id: 1,
    question: 'How do I create my first invoice?',
    answer: 'Tap the "New Invoice" button on the Dashboard. Fill in your client details, add line items with descriptions and prices, and tap "Save Invoice". You can then share it via email or PDF.',
  },
  {
    id: 2,
    question: 'How do I upgrade to Pro?',
    answer: 'Go to Settings and tap "Upgrade to Pro" in the subscription section. You\'ll get unlimited invoices, advanced features, and priority support for just $3.99/month.',
  },
  {
    id: 3,
    question: 'Can I customize my invoice template?',
    answer: 'Yes. Go to Settings > Invoice Branding to upload your logo and choose a template style. Your selected branding is used in invoice previews and email invoices.',
  },
  {
    id: 4,
    question: 'How do I track payments?',
    answer: 'When viewing an invoice, you can mark it as paid by tapping the payment status button. Invoices show as Pending, Paid, or Overdue based on their status and due date.',
  },
  {
    id: 5,
    question: 'Can I export invoices to PDF?',
    answer: 'Yes! When viewing an invoice, tap the share button to export it as a PDF. You can then send it via email, messaging apps, or save it to your device.',
  },
  {
    id: 6,
    question: 'What payment methods can I accept?',
    answer: 'You can add your preferred payment instructions in Settings (bank transfer, PayPal, Venmo, etc.). These instructions will appear on all your invoices.',
  },
  {
    id: 7,
    question: 'How do I delete an invoice?',
    answer: 'Open the invoice you want to delete, then tap the delete button. Note: Deleted invoices cannot be recovered, so make sure to export them first if needed.',
  },
  {
    id: 8,
    question: 'What happens when my free invoices run out?',
    answer: 'The free tier allows 2 invoices per month. When you reach this limit, you\'ll need to upgrade to Pro for unlimited invoices. Existing invoices remain accessible.',
  },
];

const SUPPORT_OPTIONS = [
  {
    id: 'email',
    icon: '📧',
    title: 'Email Support',
    description: 'Get help via email',
    action: 'mailto:support@platovalabs.com',
  },
  {
    id: 'feedback',
    icon: '💬',
    title: 'Send Feedback',
    description: 'Share your thoughts or report issues',
    isNavigation: true,
  },
];

export default function HelpSupportScreen({ navigation }: HelpSupportScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const handleSupportAction = (option: any) => {
    if (option.isNavigation) {
      navigation.navigate('Feedback');
    } else if (option.action) {
      Linking.openURL(option.action);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>How can we help?</Text>
        <Text style={styles.headerSubtitle}>
          Find answers to common questions or get in touch with our support team
        </Text>
      </View>

      {/* Support Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Get Support</Text>
        {SUPPORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.supportCard}
            onPress={() => handleSupportAction(option)}
          >
            <View style={styles.supportIcon}>
              <Text style={styles.supportEmoji}>{option.icon}</Text>
            </View>
            <View style={styles.supportContent}>
              <Text style={styles.supportTitle}>{option.title}</Text>
              <Text style={styles.supportDescription}>{option.description}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FAQ Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {FAQ_ITEMS.map((item) => (
          <View key={item.id} style={styles.faqCard}>
            <Text style={styles.faqQuestion}>{item.question}</Text>
            <Text style={styles.faqAnswer}>{item.answer}</Text>
          </View>
        ))}
      </View>

      {/* Additional Resources */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Tips</Text>
        <View style={styles.tipCard}>
          <Text style={styles.tipEmoji}>💡</Text>
          <Text style={styles.tipText}>
            <Text style={styles.tipBold}>Pro Tip:</Text> Set up your business information in Settings before creating your first invoice to save time!
          </Text>
        </View>
        <View style={styles.tipCard}>
          <Text style={styles.tipEmoji}>⚡</Text>
          <Text style={styles.tipText}>
            <Text style={styles.tipBold}>Quick Action:</Text> Use the Reports tab to see your income trends and outstanding invoices at a glance.
          </Text>
        </View>
        <View style={styles.tipCard}>
          <Text style={styles.tipEmoji}>🎯</Text>
          <Text style={styles.tipText}>
            <Text style={styles.tipBold}>Best Practice:</Text> Include clear payment instructions and due dates on every invoice to get paid faster.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Still need help? Our support team is here for you!
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 24,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supportEmoji: {
    fontSize: 24,
  },
  supportContent: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  supportDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  arrow: {
    fontSize: 24,
    color: theme.colors.textSecondary,
    marginLeft: 8,
  },
  faqCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  tipEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  tipBold: {
    fontWeight: '600',
    color: theme.colors.primary,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
