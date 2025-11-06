import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';

interface TermsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export default function TermsScreen({ visible, onClose }: TermsScreenProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Terms of Service</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.lastUpdated}>Last Updated: November 6, 2025</Text>

          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing and using Swift Invoice, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use our service.
          </Text>

          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            Swift Invoice provides a mobile application that allows you to create, manage, and send invoices to your customers. The service includes invoice creation, customer management, email delivery, and basic payment tracking features.
          </Text>

          <Text style={styles.sectionTitle}>3. User Accounts</Text>
          <Text style={styles.paragraph}>
            You are responsible for:
          </Text>
          <Text style={styles.bulletPoint}>• Maintaining the confidentiality of your account credentials</Text>
          <Text style={styles.bulletPoint}>• All activities that occur under your account</Text>
          <Text style={styles.bulletPoint}>• Notifying us immediately of any unauthorized access</Text>
          <Text style={styles.bulletPoint}>• Ensuring your account information is accurate and current</Text>

          <Text style={styles.sectionTitle}>4. Acceptable Use</Text>
          <Text style={styles.paragraph}>
            You agree not to use Swift Invoice to:
          </Text>
          <Text style={styles.bulletPoint}>• Send spam or unsolicited emails</Text>
          <Text style={styles.bulletPoint}>• Create fraudulent or deceptive invoices</Text>
          <Text style={styles.bulletPoint}>• Violate any applicable laws or regulations</Text>
          <Text style={styles.bulletPoint}>• Infringe on intellectual property rights</Text>
          <Text style={styles.bulletPoint}>• Transmit malware or harmful code</Text>
          <Text style={styles.bulletPoint}>• Attempt to gain unauthorized access to our systems</Text>

          <Text style={styles.sectionTitle}>5. Your Content</Text>
          <Text style={styles.paragraph}>
            You retain all rights to the content you create using Swift Invoice, including your business information, customer data, and invoice details. You grant us permission to store and transmit this data solely for the purpose of providing our services.
          </Text>

          <Text style={styles.sectionTitle}>6. Payment and Fees</Text>
          <Text style={styles.paragraph}>
            Swift Invoice is currently provided free of charge. We reserve the right to introduce paid features or subscription plans in the future, with advance notice to users.
          </Text>

          <Text style={styles.sectionTitle}>7. Email Delivery</Text>
          <Text style={styles.paragraph}>
            While we strive to ensure reliable email delivery, we cannot guarantee that all invoice emails will be successfully delivered or received. Factors such as spam filters, email server issues, and recipient settings may affect delivery.
          </Text>

          <Text style={styles.sectionTitle}>8. Service Availability</Text>
          <Text style={styles.paragraph}>
            We aim to provide reliable service but do not guarantee uninterrupted access. We may suspend or discontinue service for maintenance, updates, or other reasons with or without notice.
          </Text>

          <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            Swift Invoice is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service, including but not limited to lost revenue, data loss, or business interruption.
          </Text>

          <Text style={styles.sectionTitle}>10. Data Backup</Text>
          <Text style={styles.paragraph}>
            While we implement data backup procedures, you are responsible for maintaining your own backups of critical business data. We recommend regularly exporting your invoice data.
          </Text>

          <Text style={styles.sectionTitle}>11. Termination</Text>
          <Text style={styles.paragraph}>
            You may terminate your account at any time by deleting it through the app. We reserve the right to suspend or terminate accounts that violate these terms or engage in abusive behavior.
          </Text>

          <Text style={styles.sectionTitle}>12. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may modify these terms at any time. Continued use of Swift Invoice after changes constitutes acceptance of the modified terms. We will notify users of significant changes through the app or email.
          </Text>

          <Text style={styles.sectionTitle}>13. Governing Law</Text>
          <Text style={styles.paragraph}>
            These terms are governed by and construed in accordance with applicable laws. Any disputes arising from these terms or your use of Swift Invoice shall be resolved through appropriate legal channels.
          </Text>

          <Text style={styles.sectionTitle}>14. Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have questions about these Terms of Service, please contact us through the app settings or at the contact information provided in your app store listing.
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
