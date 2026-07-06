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
  Linking,
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
const IOS_SUBSCRIPTION_MANAGEMENT_URL = 'https://apps.apple.com/account/subscriptions';
const IOS_REFUND_REQUEST_URL = 'https://support.apple.com/en-us/HT204084';
const ANDROID_SUBSCRIPTION_MANAGEMENT_URL =
  'https://play.google.com/store/account/subscriptions?package=com.invoiceautomator.app';
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
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  const handleRestorePurchases = async () => {
    try {
      setRestoringPurchases(true);
      const accountStatus = await subscriptionService.getSubscriptionStatus();

      if (accountStatus.isPro) {
        setSubscriptionStatus(accountStatus);
        Alert.alert(
          'Pro Active',
          'Your Swift Invoice account already has Pro access on this device.'
        );
        return;
      }

      const restored = await subscriptionService.restorePurchases();
      await loadSubscription();
      Alert.alert(
        restored ? 'Purchases Restored' : 'No Purchases Found',
        restored
          ? 'Your active subscription has been restored.'
          : 'No active Swift Invoice subscription was found for this store account.'
      );
    } catch (error: any) {
      Alert.alert(
        'Restore Failed',
        error.message || 'Unable to restore purchases. Please try again.'
      );
    } finally {
      setRestoringPurchases(false);
    }
  };

  const openExternalUrl = async (url: string, fallbackMessage: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        throw new Error('Unable to open URL.');
      }
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Unable to Open Link', fallbackMessage);
    }
  };

  const handleManageSubscription = async () => {
    await openExternalUrl(
      Platform.OS === 'ios'
        ? IOS_SUBSCRIPTION_MANAGEMENT_URL
        : ANDROID_SUBSCRIPTION_MANAGEMENT_URL,
      Platform.OS === 'ios'
        ? 'Open Settings > Apple ID > Subscriptions to manage or cancel your subscription.'
        : 'Open Google Play > Payments & subscriptions > Subscriptions to manage or cancel your subscription.'
    );
  };

  const handleRequestRefund = async () => {
    if (Platform.OS !== 'ios') {
      await openExternalUrl(
        ANDROID_SUBSCRIPTION_MANAGEMENT_URL,
        'Open Google Play > Payments & subscriptions to manage subscription billing.'
      );
      return;
    }

    await openExternalUrl(
      IOS_REFUND_REQUEST_URL,
      'Visit Apple Support and search for "request a refund" to request help with an App Store purchase.'
    );
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account, business profile, customers, invoices, payment records, and uploaded logo. If you have an active App Store or Google Play subscription, deleting your account does not cancel store billing. Cancel it in your store account settings before deleting if you no longer want to be billed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Permanently Delete Account?',
              'Your Swift Invoice account and data will be deleted immediately. Store subscriptions are managed separately by Apple or Google and may continue unless cancelled in your store account.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete Account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setDeletingAccount(true);
                      await authService.deleteAccount();
                    } catch (error: any) {
                      Alert.alert(
                        'Delete Account Failed',
                        error?.message || 'Unable to delete your account. Please contact support.'
                      );
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ]
            );
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
          <Text style={styles.pageIntroKicker}>CONTROL CENTER</Text>
          <Text style={styles.pageIntroTitle}>Business Settings</Text>
          <Text style={styles.pageIntroSubtitle}>
            Tune your brand, billing profile, and account defaults in one place.
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
                  <Text style={styles.subscriptionDisclosure}>
                    Monthly subscription renews automatically unless cancelled in your App Store or Google Play account settings before renewal. You can manage or cancel store billing at any time.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.subscriptionInfo}>
                    Unlimited invoices • All features unlocked
                  </Text>
                  <Text style={styles.subscriptionDisclosure}>
                    Store billing is managed by your App Store or Google Play account. Deleting your Swift Invoice account does not cancel store billing.
                  </Text>
                </>
              )}
              <TouchableOpacity
                style={[styles.restoreButton, restoringPurchases && styles.actionButtonDisabled]}
                onPress={handleRestorePurchases}
                disabled={restoringPurchases}
              >
                {restoringPurchases ? (
                  <ActivityIndicator color={theme.colors.primary} />
                ) : (
                  <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.subscriptionLinkButton}
                onPress={handleManageSubscription}
              >
                <Text style={styles.subscriptionLinkButtonText}>Manage Subscription</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.subscriptionLinkButton}
                onPress={handleRequestRefund}
              >
                <Text style={styles.subscriptionLinkButtonText}>
                  {Platform.OS === 'ios' ? 'Request App Store Refund' : 'Manage Google Play Billing'}
                </Text>
              </TouchableOpacity>
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
          style={[styles.logoutButton, deletingAccount && styles.actionButtonDisabled]}
          onPress={handleLogout}
          disabled={deletingAccount}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteAccountButton, deletingAccount && styles.actionButtonDisabled]}
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? (
            <ActivityIndicator color={theme.colors.error} />
          ) : (
            <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
          )}
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
  },
  pageIntroCard: {
    backgroundColor: theme.colors.cardStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 14,
  },
  pageIntroKicker: {
    color: theme.colors.accent,
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 7,
    fontFamily: theme.fonts.body,
  },
  pageIntroTitle: {
    fontSize: 30,
    color: theme.colors.text,
    marginBottom: 7,
    fontFamily: theme.fonts.headline,
  },
  pageIntroSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    fontFamily: theme.fonts.body,
  },
  section: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
  },
  sectionTitle: {
    fontSize: 22,
    color: theme.colors.text,
    marginBottom: 11,
    fontFamily: theme.fonts.headline,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
    fontFamily: theme.fonts.body,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: theme.colors.text,
    marginBottom: 6,
    fontFamily: theme.fonts.body,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  paymentInput: {
    minHeight: 120,
    fontFamily: theme.fonts.mono,
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
    backgroundColor: theme.colors.cardStrong,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  methodChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  methodChipText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  methodChipTextActive: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.body,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 16,
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
  },
  logoRemoveButton: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  logoRemoveButtonText: {
    color: theme.colors.error,
    fontSize: 14,
    fontFamily: theme.fonts.body,
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
    color: theme.colors.text,
    marginBottom: 4,
    fontFamily: theme.fonts.headline,
  },
  templateTitleActive: {
    color: theme.colors.primary,
  },
  templateSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
  },
  layoutButtonTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
  },
  applyTemplateButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyTemplateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: theme.fonts.body,
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
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FBF7EF',
    fontSize: 15,
    fontFamily: theme.fonts.body,
  },
  logoutButton: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  logoutButtonText: {
    color: theme.colors.error,
    fontSize: 15,
    fontFamily: theme.fonts.body,
  },
  deleteAccountButton: {
    backgroundColor: theme.colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  deleteAccountButtonText: {
    color: theme.colors.error,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: theme.fonts.body,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.cardStrong,
    marginBottom: 10,
  },
  linkText: {
    fontSize: 15,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
  },
  linkArrow: {
    fontSize: 20,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
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
    fontFamily: theme.fonts.body,
  },
  subscriptionCard: {
    backgroundColor: theme.colors.cardStrong,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  subscriptionCardPro: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionTier: {
    fontSize: 20,
    color: theme.colors.text,
    fontFamily: theme.fonts.headline,
  },
  subscriptionActive: {
    fontSize: 12,
    color: theme.colors.success,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontFamily: theme.fonts.body,
  },
  subscriptionInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    fontFamily: theme.fonts.body,
  },
  upgradeButton: {
    backgroundColor: theme.colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeButtonText: {
    color: '#FBF7EF',
    fontSize: 15,
    fontFamily: theme.fonts.body,
  },
  upgradeSubtext: {
    color: '#FBF7EF',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
    fontFamily: theme.fonts.body,
  },
  subscriptionDisclosure: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    fontFamily: theme.fonts.body,
  },
  restoreButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    backgroundColor: theme.colors.card,
  },
  restoreButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.fonts.body,
  },
  subscriptionLinkButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 8,
  },
  subscriptionLinkButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.fonts.body,
  },
  themeOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  themeOption: {
    flex: 1,
    backgroundColor: theme.colors.cardStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 92,
  },
  themeOptionActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  themeOptionEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  themeOptionText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  themeOptionTextActive: {
    color: theme.colors.accent,
    fontFamily: theme.fonts.body,
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
