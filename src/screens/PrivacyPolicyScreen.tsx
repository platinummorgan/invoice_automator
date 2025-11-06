import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';

interface PrivacyPolicyScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyScreen({ visible, onClose }: PrivacyPolicyScreenProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.lastUpdated}>Last Updated: November 6, 2025</Text>

          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.paragraph}>
            Swift Invoice ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
          </Text>

          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We collect information that you provide directly to us, including:
          </Text>
          <Text style={styles.bulletPoint}>• Account information (name, email address)</Text>
          <Text style={styles.bulletPoint}>• Business information (business name, contact details)</Text>
          <Text style={styles.bulletPoint}>• Customer information (names, email addresses)</Text>
          <Text style={styles.bulletPoint}>• Invoice data (amounts, descriptions, dates)</Text>
          <Text style={styles.bulletPoint}>• Payment method instructions</Text>

          <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use the information we collect to:
          </Text>
          <Text style={styles.bulletPoint}>• Provide, maintain, and improve our services</Text>
          <Text style={styles.bulletPoint}>• Create and manage your invoices</Text>
          <Text style={styles.bulletPoint}>• Send invoice emails to your customers</Text>
          <Text style={styles.bulletPoint}>• Authenticate your account and ensure security</Text>
          <Text style={styles.bulletPoint}>• Respond to your comments and questions</Text>

          <Text style={styles.sectionTitle}>4. Data Storage and Security</Text>
          <Text style={styles.paragraph}>
            Your data is stored securely using Supabase, a secure cloud database platform. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
          </Text>

          <Text style={styles.sectionTitle}>5. Email Services</Text>
          <Text style={styles.paragraph}>
            We use Resend, a third-party email service provider, to send invoice emails on your behalf. When you send an invoice, your customer's email address and invoice details are transmitted to Resend for delivery.
          </Text>

          <Text style={styles.sectionTitle}>6. Data Retention</Text>
          <Text style={styles.paragraph}>
            We retain your information for as long as your account is active or as needed to provide you services. You may delete your data at any time by deleting your account or individual records within the app.
          </Text>

          <Text style={styles.sectionTitle}>7. Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to:
          </Text>
          <Text style={styles.bulletPoint}>• Access your personal data</Text>
          <Text style={styles.bulletPoint}>• Correct inaccurate data</Text>
          <Text style={styles.bulletPoint}>• Delete your data</Text>
          <Text style={styles.bulletPoint}>• Export your data</Text>
          <Text style={styles.bulletPoint}>• Withdraw consent at any time</Text>

          <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
          <Text style={styles.paragraph}>
            Our service is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13.
          </Text>

          <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date at the top of this policy.
          </Text>

          <Text style={styles.sectionTitle}>10. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy, please contact us through the app settings or at the contact information provided in your app store listing.
          </Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
