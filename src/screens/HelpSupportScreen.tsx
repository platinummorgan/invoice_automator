import React, { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import AppIcon from '../components/AppIcon';

const FAQ_ITEMS = [
  ['How do I create an invoice?', 'On the Invoices tab, tap New invoice. Choose a customer, add your work and prices, then tap Save draft. Open Preview & share when you are ready to send it.'],
  ['Can I share an invoice without an email address?', 'Yes. Open the invoice and choose Share / save PDF. You can save the file or send it using an app on your device. A customer email address is optional.'],
  ['How do I record a payment?', 'Open the invoice and choose Record full payment after the customer has paid. This records the payment in Swift Invoice; it does not charge the customer.'],
  ['How do I correct an invoice?', 'Open a draft and choose Edit draft. For an issued invoice, use Void invoice and create a corrected invoice. Paid invoices cannot be voided.'],
  ['How do I change my invoice design?', 'Go to Settings, then Invoice design. Add a logo and choose your layout and colors. Preview your changes, then tap Save design. Logo uploads and removals are saved immediately.'],
  ['Where do I add payment instructions?', 'In Settings, under Getting paid, choose your payment methods and enter the details. Tap Save business details to include them on your invoices.'],
  ['What do the report totals mean?', 'Reports groups invoices by their invoice date. Paid shows the value of paid invoices; Outstanding shows unpaid issued invoices. These are not totals grouped by the date money reached your account.'],
  ['What happens when I reach my free invoice limit?', 'Settings shows your current plan and remaining monthly allowance. Existing invoices remain accessible. Choose Upgrade to Pro for unlimited invoices; the store shows the price and terms before you confirm.'],
];

export default function HelpSupportScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const openEmail = async () => {
    try { await Linking.openURL('mailto:support@platovalabs.com'); }
    catch { Alert.alert('Email app unavailable', 'You can email support@platovalabs.com from your preferred email app.'); }
  };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>How can we help?</Text>
    <Text style={styles.description}>Find an answer below, or get in touch.</Text>
    <View style={styles.contact}>
      <TouchableOpacity accessibilityRole="button" style={styles.row} onPress={openEmail}>
        <View style={styles.rowBody}><Text style={styles.label}>Email support</Text><Text style={styles.description}>support@platovalabs.com</Text></View>
        <AppIcon name="chevron" color={theme.colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" style={styles.row} onPress={() => navigation.navigate('Feedback')}>
        <Text style={[styles.label, styles.rowBody]}>Send feedback</Text><AppIcon name="chevron" color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
    <Text style={styles.heading}>Using Swift Invoice</Text>
    {FAQ_ITEMS.map(([question, answer], index) => <View key={question} style={styles.faq}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: expanded === index }}
        style={styles.row} onPress={() => setExpanded(expanded === index ? null : index)}>
        <Text style={[styles.label, styles.rowBody]}>{question}</Text>
        <AppIcon name={expanded === index ? 'down' : 'chevron'} color={theme.colors.textSecondary} size={20} />
      </TouchableOpacity>
      {expanded === index && <Text style={styles.answer}>{answer}</Text>}
    </View>)}
  </ScrollView>;
}
const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontFamily: theme.fonts.body, fontSize: 28, fontWeight: '600', color: theme.colors.text, marginBottom: 8 },
  description: { fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary },
  heading: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text, marginBottom: 16 },
  contact: { marginVertical: 28, gap: 12 },
  row: { flexDirection: 'row', gap: 16, alignItems: 'center', minHeight: 48, paddingVertical: 12 },
  rowBody: { flex: 1, gap: 4 },
  label: { fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 23, color: theme.colors.text },
  faq: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  answer: { fontFamily: theme.fonts.body, fontSize: 15, lineHeight: 24, color: theme.colors.textSecondary, paddingBottom: 20 },
});
