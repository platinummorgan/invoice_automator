import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../services/supabase';
import {
  DEFAULT_TEMPLATE_SETTINGS,
  TEMPLATE_PRESET_COLORS,
  normalizeHexColor,
  resolveTemplateSettings,
} from '../services/templateSettings';
import { InvoiceTemplate, InvoiceTemplateSettings, Profile } from '../types';

interface InvoiceBrandingScreenProps {
  navigation: any;
}

const LOGO_BUCKET = 'logos';
const INVOICE_TEMPLATE_OPTIONS: Array<{ value: InvoiceTemplate; title: string; subtitle: string }> = [
  { value: 'classic', title: 'Classic', subtitle: 'Balanced and professional' },
  { value: 'painter', title: 'Painter', subtitle: 'Bold layout for service trades' },
  { value: 'minimal', title: 'Minimal', subtitle: 'Clean and compact' },
];

export default function InvoiceBrandingScreen({ navigation }: InvoiceBrandingScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [templateSettings, setTemplateSettings] =
    useState<InvoiceTemplateSettings>(DEFAULT_TEMPLATE_SETTINGS);
  const [accentColorInput, setAccentColorInput] = useState(DEFAULT_TEMPLATE_SETTINGS.accent_color);
  const [profile, setProfile] = useState<Partial<Profile>>({
    business_name: '',
    business_address: '',
    business_phone: '',
    logo_url: '',
    invoice_template: 'classic',
    template_settings: DEFAULT_TEMPLATE_SETTINGS,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'business_name, business_address, business_phone, logo_url, invoice_template, template_settings'
        )
        .eq('id', user.id)
        .single();

      if (error) throw error;

      const resolved = resolveTemplateSettings(data?.template_settings, data?.invoice_template);
      setTemplateSettings(resolved);
      setAccentColorInput(resolved.accent_color);
      setProfile({
        business_name: data?.business_name || '',
        business_address: data?.business_address || '',
        business_phone: data?.business_phone || '',
        logo_url: data?.logo_url || '',
        invoice_template: data?.invoice_template || 'classic',
        template_settings: resolved,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not load branding settings.');
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

      if (result.canceled || !result.assets?.[0]) return;
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

      const { data: publicUrlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(getLogoPath(user.id));
      const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ logo_url: logoUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      setProfile((prev) => ({ ...prev, logo_url: logoUrl }));
      Alert.alert('Success', 'Logo uploaded.');
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

  const handleTemplateToggle = (key: keyof InvoiceTemplateSettings, value: boolean) => {
    updateTemplateSettingsLocal({ [key]: value } as Partial<InvoiceTemplateSettings>);
  };

  const handleHeaderLayoutSelect = (layout: InvoiceTemplateSettings['header_layout']) => {
    updateTemplateSettingsLocal({ header_layout: layout });
  };

  const handleFooterTextChange = (text: string) => {
    updateTemplateSettingsLocal({ footer_text: text });
  };

  const handleSelectTemplate = (template: InvoiceTemplate) => {
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
  };

  const handleApplyAccentColor = () => {
    const normalized = normalizeHexColor(accentColorInput);
    setAccentColorInput(normalized);
    updateTemplateSettingsLocal({ accent_color: normalized });
  };

  const getNormalizedSettings = () =>
    resolveTemplateSettings(
      { ...templateSettings, accent_color: accentColorInput },
      profile.invoice_template
    );

  const handleOpenPreview = () => {
    navigation.navigate('TemplatePreview', {
      businessName: profile.business_name || 'Swift Invoice',
      businessAddress: profile.business_address || '',
      businessPhone: profile.business_phone || '',
      logoUrl: profile.logo_url || '',
      invoiceTemplate: profile.invoice_template || 'classic',
      templateSettings: getNormalizedSettings(),
    });
  };

  const handleSaveBranding = async () => {
    try {
      setSaving(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const normalized = getNormalizedSettings();
      const { error } = await supabase
        .from('profiles')
        .update({
          logo_url: profile.logo_url || null,
          invoice_template: profile.invoice_template || 'classic',
          template_settings: normalized,
        })
        .eq('id', user.id);

      if (error) throw error;

      setTemplateSettings(normalized);
      setAccentColorInput(normalized.accent_color);
      Alert.alert('Success', 'Branding saved.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not save branding settings.');
    } finally {
      setSaving(false);
    }
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Branding</Text>
          <Text style={styles.sectionSubtitle}>
            Configure logo and template settings in one place.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Business Logo</Text>
            {profile.logo_url ? (
              <View style={styles.logoCard}>
                <Image source={{ uri: profile.logo_url }} style={styles.logoPreview} resizeMode="contain" />
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>No logo uploaded</Text>
              </View>
            )}

            <View style={styles.logoActions}>
              <TouchableOpacity
                style={[styles.logoButton, styles.logoUploadButton, uploadingLogo && styles.buttonDisabled]}
                onPress={handleUploadLogo}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.logoButtonText}>
                    {profile.logo_url ? 'Replace Logo' : 'Upload Logo'}
                  </Text>
                )}
              </TouchableOpacity>
              {!!profile.logo_url && (
                <TouchableOpacity style={[styles.logoButton, styles.logoRemoveButton]} onPress={handleRemoveLogo}>
                  <Text style={styles.logoRemoveButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Invoice Template</Text>
            <View style={styles.templateGrid}>
              {INVOICE_TEMPLATE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.templateCard,
                    profile.invoice_template === option.value && styles.templateCardActive,
                  ]}
                  onPress={() => handleSelectTemplate(option.value)}
                >
                  <Text
                    style={[
                      styles.templateTitle,
                      profile.invoice_template === option.value && styles.templateTitleActive,
                    ]}
                  >
                    {option.title}
                  </Text>
                  <Text style={styles.templateSubtitle}>{option.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Accent Color (HEX)</Text>
            <View style={styles.accentColorRow}>
              <TextInput
                style={[styles.input, styles.accentColorInput]}
                value={accentColorInput}
                onChangeText={setAccentColorInput}
                placeholder="#3B82F6"
                placeholderTextColor={theme.colors.placeholder}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.applyAccentButton} onPress={handleApplyAccentColor}>
                <Text style={styles.applyAccentButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.colorPresetRow}>
              {INVOICE_TEMPLATE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={`color-${option.value}`}
                  style={[
                    styles.colorPreset,
                    { backgroundColor: TEMPLATE_PRESET_COLORS[option.value] },
                    normalizeHexColor(templateSettings.accent_color) ===
                      normalizeHexColor(TEMPLATE_PRESET_COLORS[option.value]) &&
                      styles.colorPresetActive,
                  ]}
                  onPress={() => {
                    const preset = TEMPLATE_PRESET_COLORS[option.value];
                    setAccentColorInput(preset);
                    updateTemplateSettingsLocal({ accent_color: preset });
                  }}
                />
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Header Layout</Text>
            <View style={styles.layoutRow}>
              <TouchableOpacity
                style={[
                  styles.layoutButton,
                  templateSettings.header_layout === 'stacked' && styles.layoutButtonActive,
                ]}
                onPress={() => handleHeaderLayoutSelect('stacked')}
              >
                <Text
                  style={[
                    styles.layoutButtonText,
                    templateSettings.header_layout === 'stacked' && styles.layoutButtonTextActive,
                  ]}
                >
                  Stacked
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.layoutButton,
                  templateSettings.header_layout === 'inline' && styles.layoutButtonActive,
                ]}
                onPress={() => handleHeaderLayoutSelect('inline')}
              >
                <Text
                  style={[
                    styles.layoutButtonText,
                    templateSettings.header_layout === 'inline' && styles.layoutButtonTextActive,
                  ]}
                >
                  Inline
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Template Options</Text>
            <View style={styles.templateToggleCard}>
              <View style={styles.templateToggleRow}>
                <Text style={styles.templateToggleText}>Show logo in invoices</Text>
                <Switch
                  value={templateSettings.show_logo}
                  onValueChange={(value) => handleTemplateToggle('show_logo', value)}
                  thumbColor="#fff"
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
              <View style={styles.templateToggleRow}>
                <Text style={styles.templateToggleText}>Show business contact</Text>
                <Switch
                  value={templateSettings.show_business_contact}
                  onValueChange={(value) => handleTemplateToggle('show_business_contact', value)}
                  thumbColor="#fff"
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
              <View style={styles.templateToggleRow}>
                <Text style={styles.templateToggleText}>Show notes section</Text>
                <Switch
                  value={templateSettings.show_notes}
                  onValueChange={(value) => handleTemplateToggle('show_notes', value)}
                  thumbColor="#fff"
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
              <View style={styles.templateToggleRow}>
                <Text style={styles.templateToggleText}>Highlight total amount</Text>
                <Switch
                  value={templateSettings.highlight_totals}
                  onValueChange={(value) => handleTemplateToggle('highlight_totals', value)}
                  thumbColor="#fff"
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Template Footer Text</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={templateSettings.footer_text}
              onChangeText={handleFooterTextChange}
              placeholder="Thank you for your business!"
              placeholderTextColor={theme.colors.placeholder}
              multiline
              numberOfLines={2}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.previewButton} onPress={handleOpenPreview}>
          <Text style={styles.previewButtonText}>Preview Template</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSaveBranding}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Branding</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
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
      paddingBottom: 32,
    },
    section: {
      backgroundColor: theme.colors.card,
      borderRadius: 12,
      padding: 16,
      elevation: 2,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 8,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
    },
    inputGroup: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.colors.inputBackground,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.text,
    },
    multilineInput: {
      minHeight: 80,
      textAlignVertical: 'top',
      paddingTop: 12,
    },
    logoCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
      marginBottom: 10,
    },
    logoPreview: {
      width: '100%',
      height: 100,
    },
    logoPlaceholder: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      minHeight: 100,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    logoPlaceholderText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
    },
    logoActions: {
      flexDirection: 'row',
      gap: 10,
    },
    logoButton: {
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
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
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.error,
      maxWidth: 110,
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
      backgroundColor: theme.colors.inputBackground,
    },
    templateCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    templateTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 2,
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
    },
    applyAccentButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 8,
    },
    applyAccentButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
    colorPresetRow: {
      flexDirection: 'row',
      marginTop: 10,
      gap: 12,
    },
    colorPreset: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorPresetActive: {
      borderColor: theme.colors.text,
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
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.colors.inputBackground,
    },
    layoutButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryLight,
    },
    layoutButtonText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    layoutButtonTextActive: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    templateToggleCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBackground,
      overflow: 'hidden',
    },
    templateToggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    templateToggleText: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
      paddingRight: 12,
    },
    bottomActions: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      gap: 10,
    },
    previewButton: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      borderRadius: 10,
      padding: 15,
      alignItems: 'center',
    },
    previewButtonText: {
      color: theme.colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      padding: 15,
      alignItems: 'center',
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
  });
