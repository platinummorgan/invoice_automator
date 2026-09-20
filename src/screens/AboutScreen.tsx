import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { useTheme } from '../contexts/ThemeContext';

interface AboutScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function AboutScreen({ visible, onClose }: AboutScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const version = Constants.expoConfig?.version || Application.nativeApplicationVersion || 'unknown';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>About Swift Invoice</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close About" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.logoContainer}>
            <Text style={styles.appName}>Swift Invoice</Text>
            <Text style={styles.version}>Version {version}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About This App</Text>
            <Text style={styles.paragraph}>
              Swift Invoice helps small businesses and freelancers prepare invoices, share them with customers, and keep track of payments.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <Text style={styles.bulletPoint}>• Create and edit invoice drafts</Text>
            <Text style={styles.bulletPoint}>• Manage customers and their contact information</Text>
            <Text style={styles.bulletPoint}>• Share PDFs or open an invoice in your email app</Text>
            <Text style={styles.bulletPoint}>• Track invoice status (draft, sent, paid, overdue)</Text>
            <Text style={styles.bulletPoint}>• Add payment instructions and methods</Text>
            <Text style={styles.bulletPoint}>• Preview invoices before sending</Text>
            <Text style={styles.bulletPoint}>• Filter and search your invoice history</Text>
          </View>

<View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <Text style={styles.paragraph}>
              For help, email support@platovalabs.com. You can also send feedback from Settings.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>
            <Text style={styles.paragraph}>
              By using Swift Invoice, you agree to our Terms of Service and Privacy Policy, accessible from the Settings screen.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© {new Date().getFullYear()} Swift Invoice</Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    flex: 1,
    marginRight: 12,
    fontFamily: theme.fonts.body,
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    padding: 8,
  },
  closeButtonText: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 24,
  },
  appName: {
    fontFamily: theme.fonts.body,
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  version: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: theme.fonts.body,
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  paragraph: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 32,
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.placeholder,
    marginBottom: 4,
  },
  bottomSpacer: {
    height: 40,
  },
});
