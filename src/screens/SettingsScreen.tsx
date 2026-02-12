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
  Image,
  Switch,
} from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { supabase } from '../services/supabase';
import { authService } from '../services/auth';
import { subscriptionService } from '../services/subscription';
import * as ImagePicker from 'expo-image-picker';
import {
  BusinessPaymentMethod,
  InvoiceTemplate,
  InvoiceTemplateSettings,
  PaymentMethodType,
  Profile,
} from '../types';
import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import TermsScreen from './TermsScreen';
import AboutScreen from './AboutScreen';
import { useTheme } from '../contexts/ThemeContext';
import {
  DEFAULT_TEMPLATE_SETTINGS,
  TEMPLATE_PRESET_COLORS,
  normalizeHexColor,
  resolveTemplateSettings,
} from '../services/templateSettings';

interface SettingsScreenProps {
  navigation: any;
}

const LOGO_BUCKET = 'logos';
const INVOICE_TEMPLATE_OPTIONS: Array<{ value: InvoiceTemplate; title: string; subtitle: string }> = [
  { value: 'classic', title: 'Classic', subtitle: 'Balanced and professional' },
  { value: 'painter', title: 'Painter', subtitle: 'Bold layout for service trades' },
  { value: 'minimal', title: 'Minimal', subtitle: 'Clean and compact' },
];

const PAYMENT_METHOD_OPTIONS: Array<{
  type: PaymentMethodType;
  label: string;
  placeholder: string;
}> = [
  { type: 'paypal', label: 'PayPal', placeholder: 'https://paypal.me/yourname' },
  { type: 'venmo', label: 'Venmo', placeholder: 'https://venmo.com/u/yourname' },
  { type: 'cash_app', label: 'Cash App', placeholder: 'https://cash.app/$yourname' },
  { type: 'zelle', label: 'Zelle', placeholder: 'name@email.com or +1 555-123-4567' },
  { type: 'stripe', label: 'Stripe', placeholder: 'https://buy.stripe.com/your-link' },
  { type: 'bank_transfer', label: 'Bank Transfer', placeholder: 'Routing/Account instructions or secure payment URL' },
  { type: 'other', label: 'Other', placeholder: 'Custom payment link or instructions' },
];

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { theme, themeMode, setThemeMode } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [templateSettings, setTemplateSettings] =
    useState<InvoiceTemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const [accentColorInput, setAccentColorInput] = useState(DEFAULT_TEMPLATE_SETTINGS.accent_color);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<BusinessPaymentMethod[]>([]);
  const [profile, setProfile] = useState<Partial<Profile>>({
    business_name: '',
    business_address: '',
    business_phone: '',
    payment_instructions: '',
    logo_url: '',
    invoice_template: 'classic',
    template_settings: DEFAULT_TEMPLATE_SETTINGS,
  });
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);

  useEffect(() => {
    loadProfile();
    loadSubscription();
  }, []);

  const getAppVersionLabel = () => {
    const expoVersion = Constants.expoConfig?.version;
    const androidVersionCode = Constants.expoConfig?.android?.versionCode;
    const iosBuildNumber = Constants.expoConfig?.ios?.buildNumber;

    // In Expo Go, nativeApplicationVersion is Expo Go's version, so prefer expoConfig.version.
    const version = expoVersion || Application.nativeApplicationVersion || 'unknown';

    if (Platform.OS === 'android') {
      const code = androidVersionCode ?? Application.nativeBuildVersion;
      return code ? `Version ${version} (${code})` : `Version ${version}`;
    }

    const build = iosBuildNumber ?? Application.nativeBuildVersion;
    return build ? `Version ${version} (${build})` : `Version ${version}`;
  };

  const formatBusinessPhone = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '');
    const normalizedDigits =
      digitsOnly.length === 11 && digitsOnly.startsWith('1')
        ? digitsOnly.slice(1)
        : digitsOnly.slice(0, 10);

    if (normalizedDigits.length === 0) return '';
    if (normalizedDigits.length < 4) return `(${normalizedDigits}`;
    if (normalizedDigits.length < 7) {
      return `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3)}`;
    }
    return `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(3, 6)}-${normalizedDigits.slice(6)}`;
  };

  const normalizePaymentMethods = (raw: unknown): BusinessPaymentMethod[] => {
    if (!Array.isArray(raw)) return [];

    const allowedTypes = new Set(PAYMENT_METHOD_OPTIONS.map((option) => option.type));

    return raw
      .map((entry) => {
        const type = String((entry as any)?.type || '').trim() as PaymentMethodType;
        const label = String((entry as any)?.label || '').trim();
        const value = String((entry as any)?.value || '').trim();
        if (!type || !label || !allowedTypes.has(type)) return null;
        return { type, label, value };
      })
      .filter((entry): entry is BusinessPaymentMethod => !!entry);
  };

  const getMethodOption = (type: PaymentMethodType) =>
    PAYMENT_METHOD_OPTIONS.find((option) => option.type === type);

  const isMethodSelected = (type: PaymentMethodType) =>
    paymentMethods.some((method) => method.type === type);

  const togglePaymentMethod = (type: PaymentMethodType) => {
    setPaymentMethods((prev) => {
      if (prev.some((method) => method.type === type)) {
        return prev.filter((method) => method.type !== type);
      }

      const option = getMethodOption(type);
      if (!option) return prev;
      return [...prev, { type: option.type, label: option.label, value: '' }];
    });
  };

  const updatePaymentMethodValue = (type: PaymentMethodType, value: string) => {
    setPaymentMethods((prev) =>
      prev.map((method) =>
        method.type === type ? { ...method, value } : method
      )
    );
  };

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
        const resolvedTemplateSettings = resolveTemplateSettings(
          data.template_settings,
          data.invoice_template
        );
        const normalizedPaymentMethods = normalizePaymentMethods(data.payment_methods);

        setTemplateSettings(resolvedTemplateSettings);
        setAccentColorInput(resolvedTemplateSettings.accent_color);
        setPaymentMethods(normalizedPaymentMethods);

        setProfile({
          business_name: data.business_name || '',
          business_address: data.business_address || '',
          business_phone: formatBusinessPhone(data.business_phone || ''),
          payment_instructions: data.payment_instructions || '',
          logo_url: data.logo_url || '',
          invoice_template: data.invoice_template || 'classic',
          template_settings: resolvedTemplateSettings,
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
      // Ignore "no rows" errors (user doesn't have subscription)
      if (error?.code !== 'PGRST116') {
        console.error('Error loading subscription:', error);
      }
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

  const getLogoPath = (userId: string) => `${userId}/logo`;

  const handleUploadLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow photo library access to upload your logo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const maxLogoSizeBytes = 2 * 1024 * 1024;
      if (asset.fileSize && asset.fileSize > maxLogoSizeBytes) {
        Alert.alert('Logo Too Large', 'Please choose an image smaller than 2 MB.');
        return;
      }

      setUploadingLogo(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileResponse = await fetch(asset.uri);
      const arrayBuffer = await fileResponse.arrayBuffer();
      const contentType = asset.mimeType || 'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(getLogoPath(user.id), arrayBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(LOGO_BUCKET)
        .getPublicUrl(getLogoPath(user.id));

      const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ logo_url: logoUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((prev) => ({ ...prev, logo_url: logoUrl }));
      Alert.alert('Success', 'Logo uploaded and applied to your invoices.');
    } catch (error: any) {
      Alert.alert('Logo Upload Failed', error.message || 'Could not upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.storage.from(LOGO_BUCKET).remove([getLogoPath(user.id)]);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ logo_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile((prev) => ({ ...prev, logo_url: '' }));
      Alert.alert('Success', 'Logo removed.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not remove logo.');
    }
  };

  const updateTemplateSettingsLocal = (updates: Partial<InvoiceTemplateSettings>) => {
    setTemplateSettings((prev) => {
      const next = resolveTemplateSettings({ ...prev, ...updates }, profile.invoice_template);
      setProfile((profilePrev) => ({ ...profilePrev, template_settings: next }));
      return next;
    });
  };

  const handleApplyAccentColor = () => {
    const normalized = normalizeHexColor(accentColorInput);
    setAccentColorInput(normalized);
    updateTemplateSettingsLocal({ accent_color: normalized });
  };

  const persistTemplateBuilder = async (
    nextTemplate: InvoiceTemplate,
    nextSettings: InvoiceTemplateSettings,
    successMessage: string
  ) => {
    try {
      setApplyingTemplate(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          invoice_template: nextTemplate,
          template_settings: nextSettings,
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev) => ({
        ...prev,
        invoice_template: nextTemplate,
        template_settings: nextSettings,
      }));
      Alert.alert('Success', successMessage);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update template.');
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleSelectTemplate = async (template: InvoiceTemplate) => {
    const currentTemplate = (profile.invoice_template || 'classic') as InvoiceTemplate;
    const currentAccent = normalizeHexColor(templateSettings.accent_color);
    const shouldSwitchAccent = currentAccent === TEMPLATE_PRESET_COLORS[currentTemplate];

    const nextSettings = resolveTemplateSettings(
      {
        ...templateSettings,
        accent_color: shouldSwitchAccent
          ? TEMPLATE_PRESET_COLORS[template]
          : templateSettings.accent_color,
      },
      template
    );

    setTemplateSettings(nextSettings);
    setAccentColorInput(nextSettings.accent_color);
    setProfile((prev) => ({
      ...prev,
      invoice_template: template,
      template_settings: nextSettings,
    }));

    await persistTemplateBuilder(template, nextSettings, 'Template style updated.');
  };

  const handleApplyTemplateBuilder = async () => {
    const template = (profile.invoice_template || 'classic') as InvoiceTemplate;
    const normalizedSettings = resolveTemplateSettings(
      { ...templateSettings, accent_color: accentColorInput },
      template
    );

    setTemplateSettings(normalizedSettings);
    setAccentColorInput(normalizedSettings.accent_color);

    await persistTemplateBuilder(
      template,
      normalizedSettings,
      'Template builder settings applied.'
    );
  };

  const handleTemplateToggle = (key: keyof InvoiceTemplateSettings, value: boolean) => {
    updateTemplateSettingsLocal({ [key]: value } as Partial<InvoiceTemplateSettings>);
  };

  const handleHeaderLayoutSelect = (layout: InvoiceTemplateSettings['header_layout']) => {
    updateTemplateSettingsLocal({ header_layout: layout });
  };

  const handleFooterTextChange = (text: string) => {
    updateTemplateSettingsLocal({ footer_text: text });
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const methodsForSave = paymentMethods
        .map((method) => ({
          ...method,
          value: method.value.trim(),
        }))
        .filter((method) => method.value.length > 0);

      const { error } = await supabase
        .from('profiles')
        .update({
          business_name: profile.business_name || null,
          business_address: profile.business_address || null,
          business_phone: profile.business_phone || null,
          payment_instructions: profile.payment_instructions || null,
          payment_methods: methodsForSave,
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

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut();
              // Navigation will be handled by App.tsx auth state change
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.pageIntroCard}>
          <Text style={styles.pageIntroTitle}>Business Settings</Text>
          <Text style={styles.pageIntroSubtitle}>
            Manage branding, payment methods, and account preferences in one place.
          </Text>
        </View>

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
              placeholderTextColor={theme.colors.placeholder}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Address</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={profile.business_address}
              onChangeText={(text) => setProfile({ ...profile, business_address: text })}
              placeholder="Enter your business address"
              placeholderTextColor={theme.colors.placeholder}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Phone</Text>
            <TextInput
              style={styles.input}
              value={profile.business_phone}
              onChangeText={(text) =>
                setProfile({ ...profile, business_phone: formatBusinessPhone(text) })
              }
              placeholder="Enter your phone number"
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Invoice Branding Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Branding</Text>
          <Text style={styles.sectionSubtitle}>
            Open the dedicated branding area to manage logo, template builder, and template preview.
          </Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('InvoiceBranding')}
          >
            <View style={styles.linkContent}>
              <Text style={styles.linkEmoji}>🎨</Text>
              <Text style={styles.linkText}>Open Invoice Branding</Text>
            </View>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Methods Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <Text style={styles.sectionSubtitle}>
            Select one or more methods, then add your own links or payment details. These appear on invoice emails.
          </Text>

          <View style={styles.methodChipWrap}>
            {PAYMENT_METHOD_OPTIONS.map((option) => {
              const active = isMethodSelected(option.type);
              return (
                <TouchableOpacity
                  key={option.type}
                  style={[styles.methodChip, active && styles.methodChipActive]}
                  onPress={() => togglePaymentMethod(option.type)}
                >
                  <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {paymentMethods.length === 0 && (
            <Text style={styles.helperText}>No payment methods selected yet.</Text>
          )}

          {paymentMethods.map((method) => {
            const option = getMethodOption(method.type);
            return (
              <View key={method.type} style={styles.inputGroup}>
                <Text style={styles.label}>{method.label}</Text>
                <TextInput
                  style={styles.input}
                  value={method.value}
                  onChangeText={(text) => updatePaymentMethodValue(method.type, text)}
                  placeholder={option?.placeholder || 'Enter payment link or details'}
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="none"
                />
              </View>
            );
          })}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Additional Payment Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput, styles.paymentInput]}
              value={profile.payment_instructions}
              onChangeText={(text) => setProfile({ ...profile, payment_instructions: text })}
              placeholder={'Examples:\n• Include invoice number in memo\n• Payment due within 7 days'}
              placeholderTextColor={theme.colors.placeholder}
              multiline
              numberOfLines={4}
            />
            <Text style={styles.helperText}>
              Use this for extra payment instructions that apply to all methods.
            </Text>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <Text style={styles.sectionSubtitle}>Choose your preferred color theme</Text>
          
          <View style={styles.themeOptions}>
            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'light' && styles.themeOptionActive,
              ]}
              onPress={() => setThemeMode('light')}
            >
              <Text style={styles.themeOptionEmoji}>☀️</Text>
              <Text style={[
                styles.themeOptionText,
                themeMode === 'light' && styles.themeOptionTextActive,
              ]}>Light</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'dark' && styles.themeOptionActive,
              ]}
              onPress={() => setThemeMode('dark')}
            >
              <Text style={styles.themeOptionEmoji}>🌙</Text>
              <Text style={[
                styles.themeOptionText,
                themeMode === 'dark' && styles.themeOptionTextActive,
              ]}>Dark</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themeMode === 'system' && styles.themeOptionActive,
              ]}
              onPress={() => setThemeMode('system')}
            >
              <Text style={styles.themeOptionEmoji}>⚙️</Text>
              <Text style={[
                styles.themeOptionText,
                themeMode === 'system' && styles.themeOptionTextActive,
              ]}>Auto</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feedback & Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feedback & Support</Text>
          
          <TouchableOpacity 
            style={styles.linkRow}
            onPress={() => navigation.navigate('HelpSupport')}
          >
            <View style={styles.linkContent}>
              <Text style={styles.linkEmoji}>❓</Text>
              <Text style={styles.linkText}>Help & Support</Text>
            </View>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkRow}
            onPress={() => navigation.navigate('Feedback')}
          >
            <View style={styles.linkContent}>
              <Text style={styles.linkEmoji}>💬</Text>
              <Text style={styles.linkText}>Send Feedback</Text>
            </View>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
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
            <Text style={styles.versionText}>{getAppVersionLabel()}</Text>
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

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  pageIntroCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  pageIntroTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  pageIntroSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  section: {
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text,
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
  methodChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  methodChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '14',
  },
  methodChipText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  methodChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 16,
  },
  logoCard: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  logoPreview: {
    width: '100%',
    maxWidth: 240,
    height: 100,
  },
  logoPlaceholder: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
  },
  logoPlaceholderText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  logoActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  logoButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoUploadButton: {
    backgroundColor: theme.colors.primary,
  },
  logoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logoRemoveButton: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  logoRemoveButtonText: {
    color: theme.colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  templateGrid: {
    gap: 10,
  },
  templateCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.colors.background,
  },
  templateCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '12',
  },
  templateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  templateTitleActive: {
    color: theme.colors.primary,
  },
  templateSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  accentColorRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  accentColorInput: {
    flex: 1,
    marginBottom: 0,
    textTransform: 'uppercase',
  },
  applyAccentButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  applyAccentButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  colorPresetRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  colorPreset: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  colorPresetActive: {
    borderColor: theme.colors.text,
    borderWidth: 2,
  },
  layoutRow: {
    flexDirection: 'row',
    gap: 10,
  },
  layoutButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  layoutButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '12',
  },
  layoutButtonText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  layoutButtonTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  templateToggleCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
  },
  templateToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  templateToggleText: {
    color: theme.colors.text,
    fontSize: 14,
    flex: 1,
    paddingRight: 8,
  },
  applyTemplateButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyTemplateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  bottomActions: {
    padding: 16,
    paddingBottom: 48,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 10,
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
  logoutButton: {
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  logoutButtonText: {
    color: theme.colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    marginBottom: 10,
  },
  linkText: {
    fontSize: 15,
    color: theme.colors.text,
  },
  linkArrow: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  versionRow: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 8,
  },
  versionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  subscriptionCard: {
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subscriptionCardPro: {
    backgroundColor: theme.colors.background,
    borderColor: '#FFD700',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionTier: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subscriptionActive: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.success,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  subscriptionInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 10,
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
  themeOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  themeOption: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 92,
  },
  themeOptionActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.inputBackground,
  },
  themeOptionEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  themeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  themeOptionTextActive: {
    color: theme.colors.primary,
  },
  linkContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
});
