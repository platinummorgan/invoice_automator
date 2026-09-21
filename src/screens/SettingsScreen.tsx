import AppIcon from '../components/AppIcon';
import { preparePaymentMethods } from '../utils/paymentMethods';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Linking,
  AppState,
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
  route: any;
}

const LOGO_BUCKET = 'logos';

function formatBusinessPhone(value: string) {
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
}

function getLogoPath(userId: string) {
  return `${userId}/logo`;
}

function normalizePaymentMethods(raw: unknown): BusinessPaymentMethod[] {
  if (!Array.isArray(raw)) return [];
  const allowedTypes = new Set(PAYMENT_METHOD_OPTIONS.map((o) => o.type));
  return raw
    .map((entry) => {
      const type = String((entry as any)?.type || '').trim() as PaymentMethodType;
      const label = String((entry as any)?.label || '').trim();
      const value = String((entry as any)?.value || '').trim();
      if (!type || !label || !allowedTypes.has(type)) return null;
      return { type, label, value };
    })
    .filter((entry): entry is BusinessPaymentMethod => !!entry);
}
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

export default function SettingsScreen({ navigation, route }: SettingsScreenProps) {
  const { theme, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const insets = useSafeAreaInsets();
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
  const scrollRef = useRef<ScrollView>(null);
  const [planSectionY, setPlanSectionY] = useState<number | null>(null);

  useEffect(() => {
    if (!route.params?.focusPlan || loading || planSectionY === null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, planSectionY - 16), animated: true });
      navigation.setParams({ focusPlan: undefined });
    });
  }, [loading, navigation, planSectionY, route.params?.focusPlan]);

  useEffect(() => {
    loadProfile();
    loadSubscription();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') loadSubscription(); });
    const unsubscribe = subscriptionService.onBillingChange((error) => {
      loadSubscription();
      if (error) Alert.alert('Subscription update', error);
    });
    return () => { foreground.remove(); unsubscribe(); };
  }, []);

  const getAppVersionLabel = () => {
    const expoVersion = Constants.expoConfig?.version;
    const androidVersionCode = Constants.expoConfig?.android?.versionCode;
    const iosBuildNumber = Constants.expoConfig?.ios?.buildNumber;

    // In Expo Go, nativeApplicationVersion is Expo Go's version, so prefer expoConfig.version.
    const version = expoVersion || Application.nativeApplicationVersion || 'unknown';

    if (Platform.OS === 'android') {
      const code = Application.nativeBuildVersion ?? androidVersionCode;
      return code ? `Version ${version} (${code})` : `Version ${version}`;
    }

    const build = Application.nativeBuildVersion ?? iosBuildNumber;
    return build ? `Version ${version} (${build})` : `Version ${version}`;
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
    setLoading(true);
    setProfileError(false);
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
      setProfileError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      const status = await subscriptionService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (error: any) {
      setSubscriptionStatus(null);
      // Ignore "no rows" errors (user doesn't have subscription)
      if (error?.code !== 'PGRST116') {
        console.error('Error loading subscription:', error);
      }
    }
  };

  const handleManageSubscription = async () => {
    try {
      await Linking.openURL('https://play.google.com/store/account/subscriptions');
    } catch {
      Alert.alert('Open Google Play', 'Open Play Store → Payments & subscriptions → Subscriptions to manage Swift Invoice.');
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await subscriptionService.restorePurchases();
      await loadSubscription();
      Alert.alert(restored ? 'Purchase verified' : 'No active subscription found', restored ? 'Your remaining Pro access has been verified with Google Play. Restoring does not restart a canceled subscription.' : 'Check that Google Play is using the account you purchased with.');
    } catch { Alert.alert('Restore unavailable', 'Your purchase could not be verified. Try again later or contact support.'); }
    finally { setRestoring(false); }
  };

  const handleUpgrade = async () => {
    try {
      setUpgrading(true);
      await subscriptionService.upgradeToPro();
      // Success will be handled by the purchase listener
      // Reload subscription status after purchase
      await loadSubscription();
    } catch (error: any) {
      Alert.alert(
        'Upgrade Error',
        error.message || 'Unable to process upgrade. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setUpgrading(false);
    }
  };

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
      const contentType = asset.mimeType || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        Alert.alert('Invalid File', 'Please select an image file (JPEG, PNG, or WebP).');
        return;
      }

      setUploadingLogo(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileResponse = await fetch(asset.uri);
      const arrayBuffer = await fileResponse.arrayBuffer();

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
      const methodsForSave = preparePaymentMethods(paymentMethods);

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

      setPaymentMethods(methodsForSave);
      Alert.alert('Saved', 'Your business details and payment instructions have been saved.');
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
      'Delete account?',
      'This permanently deletes your Swift Invoice account, business profile, customers, quotes, invoices, payments, logo, and job pictures. Store billing is managed separately and is not canceled automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Permanently delete everything?',
              'This cannot be undone. Save any documents you need before continuing.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      setDeletingAccount(true);
                      await authService.deleteAccount();
                    } catch (error: any) {
                      Alert.alert(
                        'Delete account failed',
                        error?.message || 'Unable to delete your account. Please contact support@platovalabs.com.'
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

  const link = (label: string, onPress: () => void, detail?: string) => (
    <TouchableOpacity accessibilityRole="button" style={styles.link} onPress={onPress}>
      <View style={styles.linkBody}><Text style={styles.linkText}>{label}</Text>{detail && <Text style={styles.description}>{detail}</Text>}</View>
      <AppIcon name="chevron" color={theme.colors.textSecondary} size={20} />
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.loading}><ActivityIndicator color={theme.colors.primary} accessibilityLabel="Loading settings" /></View>;

  if (profileError) return <View style={[styles.loading, { padding: 24, gap: 16 }]}>
    <Text style={styles.heading}>Settings couldn’t load</Text>
    <Text style={styles.description}>Check your connection and try again.</Text>
    <TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={loadProfile}><Text style={styles.secondaryText}>Try again</Text></TouchableOpacity>
  </View>;

  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 44}>
    <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.heading}>Business details</Text>
        <Text style={styles.description}>The details your customers see on your invoices.</Text>
        <View style={styles.field}><Text style={styles.label}>Business name</Text>
          <TextInput accessibilityLabel="Business name" style={styles.input} value={profile.business_name} editable={!saving}
            onChangeText={text => setProfile({ ...profile, business_name: text })} placeholder="Your business name" placeholderTextColor={theme.colors.placeholder} />
        </View>
        <View style={styles.field}><Text style={styles.label}>Business address</Text>
          <TextInput accessibilityLabel="Business address" style={[styles.input, styles.multiline]} value={profile.business_address} editable={!saving}
            onChangeText={text => setProfile({ ...profile, business_address: text })} placeholder="Street, city, state and ZIP code" placeholderTextColor={theme.colors.placeholder} multiline />
        </View>
        <View style={styles.field}><Text style={styles.label}>Business phone</Text>
          <TextInput accessibilityLabel="Business phone" style={styles.input} value={profile.business_phone} editable={!saving}
            onChangeText={text => setProfile({ ...profile, business_phone: formatBusinessPhone(text) })} placeholder="(555) 123-4567" placeholderTextColor={theme.colors.placeholder} keyboardType="phone-pad" />
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>Getting paid</Text>
        <Text style={styles.description}>Choose how customers can pay, then enter your payment link or instructions. Saved links are clickable in invoice PDFs and emails.</Text>
        <View style={styles.options}>
          {PAYMENT_METHOD_OPTIONS.map(option => {
            const active = isMethodSelected(option.type);
            return <TouchableOpacity key={option.type} accessibilityRole="checkbox" accessibilityState={{ checked: active, disabled: saving }} disabled={saving}
              style={[styles.option, active && styles.optionActive]} onPress={() => togglePaymentMethod(option.type)}>
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
            </TouchableOpacity>;
          })}
        </View>
        {paymentMethods.map(method => <View key={method.type} style={styles.field}>
          <Text style={styles.label}>{method.label} details</Text>
          <TextInput accessibilityLabel={`${method.label} details`} style={styles.input} value={method.value} editable={!saving}
            onChangeText={text => updatePaymentMethodValue(method.type, text)} placeholder={getMethodOption(method.type)?.placeholder}
            placeholderTextColor={theme.colors.placeholder} autoCapitalize="none" autoCorrect={false} />
        </View>)}
        <View style={styles.field}><Text style={styles.label}>Payment notes (optional)</Text>
          <TextInput accessibilityLabel="Payment notes" style={[styles.input, styles.multiline]} value={profile.payment_instructions} editable={!saving}
            onChangeText={text => setProfile({ ...profile, payment_instructions: text })} placeholder="Please include the invoice number with your payment."
            placeholderTextColor={theme.colors.placeholder} multiline />
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving}
          style={[styles.save, saving && styles.disabled]} onPress={handleSave}>
          {saving ? <ActivityIndicator color="#fff" accessibilityLabel="Saving business details" /> : <Text style={styles.saveText}>Save business details</Text>}
        </TouchableOpacity>
        <Text style={styles.description}>Saves your business details and payment instructions.</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>Appearance</Text>
        {link('Invoice design', () => navigation.navigate('InvoiceBranding'), 'Your logo, colors and invoice layout')}
        <Text style={styles.label}>App theme</Text>
        <View style={styles.options}>
          {(['light', 'dark', 'system'] as const).map(mode => <TouchableOpacity key={mode} accessibilityRole="radio" accessibilityState={{ checked: themeMode === mode }}
            style={[styles.option, themeMode === mode && styles.optionActive]} onPress={() => setThemeMode(mode)}>
            <Text style={[styles.optionText, themeMode === mode && styles.optionTextActive]}>{mode === 'system' ? 'Use device setting' : mode === 'light' ? 'Light' : 'Dark'}</Text>
          </TouchableOpacity>)}
        </View>
      </View>
      <View style={styles.section} onLayout={event => setPlanSectionY(event.nativeEvent.layout.y)}>
        <Text style={styles.heading}>Your plan</Text>
        {Platform.OS === 'android' && link('Manage subscription in Google Play', handleManageSubscription)}
        {Platform.OS === 'android' && <TouchableOpacity accessibilityRole="button" disabled={restoring || upgrading} style={styles.link} onPress={handleRestore}>
          <Text style={styles.linkText}>{restoring ? 'Checking Google Play…' : 'Restore purchases'}</Text>
        </TouchableOpacity>}
        {subscriptionStatus ? <>
          <Text style={styles.linkText}>{subscriptionStatus.isPro ? 'Swift Invoice Pro' : 'Free plan'}</Text>
          <Text style={styles.description}>{subscriptionStatus.isPro ? 'Unlimited invoices' : `${subscriptionStatus.remainingInvoices} of ${subscriptionStatus.invoiceLimit} free invoices remaining this month`}</Text>
          {subscriptionStatus.isPro && subscriptionStatus.status === 'cancelled' && subscriptionStatus.expiresAt && <Text style={styles.description}>Canceled. Pro access ends {new Date(subscriptionStatus.expiresAt).toLocaleString()}. You will not be charged again unless you resubscribe.</Text>}
          {!subscriptionStatus.isPro && Platform.OS === 'android' && <>
            <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: upgrading, busy: upgrading }} disabled={upgrading} style={styles.secondary} onPress={handleUpgrade}>
              {upgrading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.secondaryText}>Upgrade to Pro</Text>}
            </TouchableOpacity>
            <Text style={styles.description}>The store shows the price and billing terms before you confirm.</Text>
          </>}
          {!subscriptionStatus.isPro && Platform.OS === 'ios' &&
            <Text style={styles.description}>The first iPhone release uses the free plan. Pro purchases remain available through Google Play on Android.</Text>}
        </> : <>
          <Text style={styles.description}>Plan details are unavailable.</Text>
          {link('Reload plan details', loadSubscription)}
        </>}
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>Help & information</Text>
        {link('Help & support', () => navigation.navigate('HelpSupport'))}
        {link('Account and data deletion help', () => { Linking.openURL('https://platinummorgan.github.io/invoice_automator/delete-account.html').catch(() => Alert.alert('Account deletion help', 'Email support@platovalabs.com from your Swift Invoice account email for help with account or selected-data deletion.')); })}
        {link('Send feedback', () => navigation.navigate('Feedback'))}
        {link('Privacy policy', () => setShowPrivacy(true))}
        {link('Terms of service', () => setShowTerms(true))}
        {link('About Swift Invoice', () => setShowAbout(true))}
        <Text style={styles.description}>{getAppVersionLabel()}</Text>
      </View>
      <TouchableOpacity accessibilityRole="button" disabled={deletingAccount} style={[styles.signOut, deletingAccount && styles.disabled]} onPress={handleLogout}><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: deletingAccount, busy: deletingAccount }} disabled={deletingAccount}
        style={[styles.deleteAccount, deletingAccount && styles.disabled]} onPress={handleDeleteAccount}>
        {deletingAccount ? <ActivityIndicator color={theme.colors.error} /> : <Text style={styles.deleteAccountText}>Delete account</Text>}
      </TouchableOpacity>
    </ScrollView>
    <PrivacyPolicyScreen visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
    <TermsScreen visible={showTerms} onClose={() => setShowTerms(false)} />
    <AboutScreen visible={showAbout} onClose={() => setShowAbout(false)} />
  </KeyboardAvoidingView>;
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 36 },
  section: { paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12 },
  heading: { fontFamily: theme.fonts.body, fontSize: 21, fontWeight: '600', color: theme.colors.text },
  description: { fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary },
  field: { gap: 8, marginTop: 6 },
  label: { fontFamily: theme.fonts.body, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  input: { fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.text, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.inputBorder, borderRadius: 6, padding: 12, minHeight: 48 },
  multiline: { minHeight: 92, textAlignVertical: 'top' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  option: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  optionActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  optionText: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary },
  optionTextActive: { color: theme.colors.primary, fontWeight: '600' },
  save: { minHeight: 50, alignItems: 'center', justifyContent: 'center', padding: 12, marginTop: 8, borderRadius: 6, backgroundColor: '#1B6C53' },
  saveText: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: '#fff' },
  disabled: { opacity: 0.6 },
  secondary: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.primary, borderRadius: 6, alignItems: 'center', justifyContent: 'center', padding: 12 },
  secondaryText: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: theme.colors.primary },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 48, paddingVertical: 8 },
  linkBody: { flex: 1, gap: 5 },
  linkText: { fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.text },
  signOut: { minHeight: 48, paddingVertical: 20, alignItems: 'flex-start' },
  signOutText: { fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.error },
  deleteAccount: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.error, borderRadius: 6, alignItems: 'center', justifyContent: 'center', padding: 12, marginBottom: 16 },
  deleteAccountText: { fontFamily: theme.fonts.body, fontSize: 16, fontWeight: '600', color: theme.colors.error },
});
