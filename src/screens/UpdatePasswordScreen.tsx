import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../services/supabase';
import { authService } from '../services/auth';
import { parseRecoveryLink } from '../utils/recoveryLink';

export default function UpdatePasswordScreen({ link, onDone }: { link: string; onDone: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        if (link !== 'recovery-event') {
          const parsed = parseRecoveryLink(link);
          if (!parsed || parsed.error || !parsed.accessToken || !parsed.refreshToken) throw new Error('Invalid reset link');
          const { error } = await supabase.auth.setSession({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken });
          if (error) throw error;
        }
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error('Invalid recovery session');
        if (active) { setEmail(data.user.email || ''); setReady(true); }
      } catch {
        if (active) setError('This reset link is invalid or expired. Return to sign in and request a new link.');
      } finally { if (active) setChecking(false); }
    };
    verify();
    return () => { active = false; };
  }, [link]);
  const save = async () => {
    if (saving || !ready) return;
    if (password.length < 6) { setError('Use at least 6 characters.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setSaving(true); setError('');
    try { await authService.updatePassword(password); setPassword(''); setConfirm(''); setComplete(true); }
    catch { setError('Your password could not be updated. Try again, or request a new reset link.'); }
    finally { setSaving(false); }
  };
  const cancel = async () => {
    setSaving(true);
    try { await authService.signOut(); onDone(); }
    catch { setError('Unable to sign out. Check your connection and try again.'); }
    finally { setSaving(false); }
  };
  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text style={styles.title}>{complete ? 'Password updated' : 'Choose a new password'}</Text>
      {checking ? <ActivityIndicator accessibilityLabel="Checking reset link" color={theme.colors.primary} /> : <>
        {complete ? <>
          <Text style={styles.copy}>Your new password is ready to use.</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onDone}><Text style={styles.buttonText}>Continue to invoices</Text></TouchableOpacity>
        </> : <>
          {ready && <>
            <Text style={styles.copy}>{email ? `Updating the password for ${email}` : 'Use at least 6 characters.'}</Text>
            <Text style={styles.label}>New password</Text>
            <TextInput accessibilityLabel="New password" autoComplete="new-password" secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!saving} style={styles.input} value={password} onChangeText={setPassword} />
            <Text style={styles.label}>Confirm new password</Text>
            <TextInput accessibilityLabel="Confirm new password" autoComplete="new-password" secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!saving} style={styles.input} value={confirm} onChangeText={setConfirm} />
          </>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {ready && <TouchableOpacity accessibilityRole="button" disabled={saving} style={styles.button} onPress={save}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save new password</Text>}
          </TouchableOpacity>}
          <TouchableOpacity accessibilityRole="button" disabled={saving} style={styles.back} onPress={cancel}><Text style={styles.link}>Back to sign in</Text></TouchableOpacity>
        </>}
      </>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const createStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 24, gap: 16 },
  title: { fontFamily: theme.fonts.body, fontSize: 28, fontWeight: '600', color: theme.colors.text },
  copy: { fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24, color: theme.colors.textSecondary },
  label: { fontFamily: theme.fonts.body, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  input: { fontFamily: theme.fonts.body, minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 6, borderColor: theme.colors.inputBorder, color: theme.colors.text, backgroundColor: theme.colors.inputBackground, fontSize: 16 },
  button: { minHeight: 50, backgroundColor: '#1B6C53', padding: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  buttonText: { fontFamily: theme.fonts.body, color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { fontFamily: theme.fonts.body, color: theme.colors.error, fontSize: 14, lineHeight: 21 },
  back: { minHeight: 48, justifyContent: 'center' },
  link: { fontFamily: theme.fonts.body, color: theme.colors.primary, fontSize: 16 },
});
