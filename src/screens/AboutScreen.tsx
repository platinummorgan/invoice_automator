import React from 'react';
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
  const styles = createStyles(theme);
  const version = Constants.expoConfig?.version || Application.nativeApplicationVersion || 'unknown';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>About Swift Invoice</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
              Swift Invoice is a simple, professional invoicing solution designed for small businesses and freelancers. Create beautiful invoices, manage customers, and get paid faster.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <Text style={styles.bulletPoint}>• Create professional invoices in seconds</Text>
            <Text style={styles.bulletPoint}>• Manage customers and their contact information</Text>
            <Text style={styles.bulletPoint}>• Email invoices using your phone's email app</Text>
            <Text style={styles.bulletPoint}>• Track invoice status (draft, sent, paid, overdue)</Text>
            <Text style={styles.bulletPoint}>• Add payment instructions and methods</Text>
            <Text style={styles.bulletPoint}>• Preview invoices before sending</Text>
            <Text style={styles.bulletPoint}>• Filter and search your invoice history</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Credits</Text>
            <Text style={styles.paragraph}>
              Built with React Native and Expo for cross-platform mobile development.
            </Text>
            <Text style={styles.paragraph}>
              Powered by Supabase for secure data storage and authentication.
            </Text>
            <Text style={styles.paragraph}>
              Uses your device's email app for sending invoices and receipts.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Support</Text>
            <Text style={styles.paragraph}>
              Need help? Have a suggestion? We'd love to hear from you. Contact us through your app store listing or visit our support page.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Legal</Text>
            <Text style={styles.paragraph}>
              By using Swift Invoice, you agree to our Terms of Service and Privacy Policy, accessible from the Settings screen.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2025 Swift Invoice</Text>
            <Text style={styles.footerText}>Made with ❤️ for small businesses</Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
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
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 24,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  version: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
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
    fontSize: 14,
    color: theme.colors.placeholder,
    marginBottom: 4,
  },
  bottomSpacer: {
    height: 40,
  },
});
