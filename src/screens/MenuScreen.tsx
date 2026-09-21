import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

export default function MenuScreen({ navigation }: { navigation: any }) {
  const { theme } = useTheme();
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}><ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Swift Invoice</Text>
    <Text accessibilityRole="header" style={{ color: theme.colors.text, fontSize: 32, fontWeight: '700' }}>Your jobs</Text>
    <Text style={{ color: theme.colors.textSecondary }}>Quote → Invoice → Receipt</Text>
    {[
      ['1', 'Quote', 'Price a job, send a quote, then approve and convert.', 'Quotes'],
      ['2', 'Invoice', 'Bill customers, add finished pictures and record payment.', 'Dashboard'],
      ['3', 'Receipt', 'Email or text a PDF receipt for a paid invoice.', 'Receipts'],
    ].map(([number, title, description, screen]) => <TouchableOpacity key={number} accessibilityRole="button" onPress={() => navigation.navigate(screen)} style={{ padding: 22, borderRadius: 16, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
      <View style={{ flexDirection: 'row', gap: 16 }}><Text style={{ color: theme.colors.primary, fontSize: 24 }}>{number}</Text><Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '600' }}>{title}</Text></View>
      <Text style={{ color: theme.colors.textSecondary, marginTop: 12, lineHeight: 22 }}>{description}</Text>
    </TouchableOpacity>)}
  </ScrollView></SafeAreaView>;
}
