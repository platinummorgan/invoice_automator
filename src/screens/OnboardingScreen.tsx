import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import AppIcon, { IconName } from '../components/AppIcon';

const steps: { icon: IconName; title: string; description: string }[] = [
  { icon: 'invoice', title: 'Start with a draft', description: 'Add your customer, the work and your prices. Review it before sharing.' },
  { icon: 'plus', title: 'Share your way', description: 'Send a PDF through an app on your phone, or open an email draft.' },
  { icon: 'reports', title: 'Keep track of payments', description: 'Record when an invoice is paid and see what is still outstanding.' },
];

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>Swift Invoice</Text>
      <Text style={styles.title}>From finished work to a clear invoice.</Text>
      <Text style={styles.description}>A few essentials to get you started.</Text>
      <View style={styles.steps}>{steps.map(step => <View key={step.title} style={styles.step}>
        <AppIcon name={step.icon} color={theme.colors.primary} />
        <View style={styles.stepBody}><Text style={styles.heading}>{step.title}</Text><Text style={styles.description}>{step.description}</Text></View>
      </View>)}</View>
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onComplete}><Text style={styles.buttonText}>Go to my invoices</Text></TouchableOpacity>
      <Text style={styles.note}>You can add your business details and logo in Settings.</Text>
    </ScrollView>
  </SafeAreaView>;
}
const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, padding: 24, paddingTop: 36, maxWidth: 600, width: '100%', alignSelf: 'center' },
  brand: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: theme.colors.primary, marginBottom: 32 },
  title: { fontFamily: theme.fonts.body, fontSize: 32, fontWeight: '600', lineHeight: 40, color: theme.colors.text, marginBottom: 12 },
  description: { fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24, color: theme.colors.textSecondary },
  steps: { marginVertical: 32 },
  step: { flexDirection: 'row', gap: 16, paddingVertical: 20, borderTopWidth: 1, borderTopColor: theme.colors.border },
  stepBody: { flex: 1, gap: 6 },
  heading: { fontFamily: theme.fonts.body, fontSize: 18, fontWeight: '600', color: theme.colors.text },
  button: { backgroundColor: '#1B6C53', minHeight: 50, padding: 14, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: '#fff' },
  note: { fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary, marginTop: 16, marginBottom: 16 },
});
