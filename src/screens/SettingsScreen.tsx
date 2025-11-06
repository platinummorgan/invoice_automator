import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../services/supabase';
import { subscriptionService } from '../services/subscription';
import { Profile } from '../types';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import TermsScreen from './TermsScreen';
import AboutScreen from './AboutScreen';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Partial<Profile>>({
    business_name: '',
    business_address: '',
    business_phone: '',
    payment_instructions: '',
  });
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  useEffect(() => {
    loadProfile();
    loadSubscription();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          business_name: data.business_name || '',
          business_address: data.business_address || '',
          business_phone: data.business_phone || '',
          payment_instructions: data.payment_instructions || '',
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      const status = await subscriptionService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (error: any) {
      console.error('Error loading subscription:', error);
    }
  };

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      await subscriptionService.upgradeToPro();
      // Success will be handled by the purchase listener
      // Reload subscription status after purchase
      setTimeout(() => loadSubscription(), 2000);
    } catch (error: any) {
      Alert.alert(
        'Upgrade Error',
        error.message || 'Unable to process upgrade. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          business_name: profile.business_name || null,
          business_address: profile.business_address || null,
          business_phone: profile.business_phone || null,
          payment_instructions: profile.payment_instructions || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      Alert.alert('Success', 'Settings saved successfully');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Subscription Section */}
        {subscriptionStatus && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription</Text>
            
            <View style={[styles.subscriptionCard, subscriptionStatus.isPro && styles.subscriptionCardPro]}>
              <View style={styles.subscriptionHeader}>
                <Text style={styles.subscriptionTier}>
                  {subscriptionStatus.isPro ? '⭐ Pro' : '🆓 Free'}
                </Text>
                {subscriptionStatus.isPro && (
                  <Text style={styles.subscriptionActive}>Active</Text>
                )}
              </View>

              {!subscriptionStatus.isPro ? (
                <>
                  <Text style={styles.subscriptionInfo}>
                    {subscriptionStatus.remainingInvoices} of {subscriptionStatus.invoiceLimit} free invoices remaining this month
                  </Text>
                  <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
                    <Text style={styles.upgradeButtonText}>Upgrade to Pro - $3.99/month</Text>
                    <Text style={styles.upgradeSubtext}>Unlimited invoices • Priority support</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.subscriptionInfo}>
                  Unlimited invoices • All features unlocked
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Business Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Name</Text>
            <TextInput
              style={styles.input}
              value={profile.business_name}
              onChangeText={(text) => setProfile({ ...profile, business_name: text })}
              placeholder="Enter your business name"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Address</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={profile.business_address}
              onChangeText={(text) => setProfile({ ...profile, business_address: text })}
              placeholder="Enter your business address"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Phone</Text>
            <TextInput
              style={styles.input}
              value={profile.business_phone}
              onChangeText={(text) => setProfile({ ...profile, business_phone: text })}
              placeholder="Enter your phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Payment Methods Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <Text style={styles.sectionSubtitle}>
            Specify how customers can pay you. This will be included in invoice emails.
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payment Instructions</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, styles.paymentInput]}
              value={profile.payment_instructions}
              onChangeText={(text) => setProfile({ ...profile, payment_instructions: text })}
              placeholder={'Examples:\n• Venmo: @username\n• Zelle: 555-1234\n• Cash App: $username\n• PayPal: email@example.com'}
              placeholderTextColor="#999"
              multiline
              numberOfLines={6}
            />
            <Text style={styles.helperText}>
              Enter your payment methods line by line. These will be shown to customers in invoice emails.
            </Text>
          </View>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          
          <TouchableOpacity 
            style={styles.linkRow}
            onPress={() => setShowPrivacy(true)}
          >
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkRow}
            onPress={() => setShowTerms(true)}
          >
            <Text style={styles.linkText}>Terms of Service</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkRow}
            onPress={() => setShowAbout(true)}
          >
            <Text style={styles.linkText}>About Swift Invoice</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.versionRow}>
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <PrivacyPolicyScreen visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsScreen visible={showTerms} onClose={() => setShowTerms(false)} />
      <AboutScreen visible={showAbout} onClose={() => setShowAbout(false)} />

      {/* Save Button */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Settings</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  paymentInput: {
    minHeight: 120,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    lineHeight: 16,
  },
  bottomActions: {
    padding: 16,
    paddingBottom: 48, // Android nav bar clearance
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  linkText: {
    fontSize: 16,
    color: '#333',
  },
  linkArrow: {
    fontSize: 20,
    color: '#999',
  },
  versionRow: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  subscriptionCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  subscriptionCardPro: {
    backgroundColor: '#fff9e6',
    borderColor: '#FFD700',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionTier: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  subscriptionActive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  subscriptionInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  upgradeSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
  },
});
