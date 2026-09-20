import PrivacyPolicyScreen from './PrivacyPolicyScreen';
import TermsScreen from './TermsScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { authService } from '../services/auth';
import { useTheme } from '../contexts/ThemeContext';
import { GoogleIcon } from '../components/GoogleIcon';

interface SignUpScreenProps {
  navigation: any;
  onSignUpSuccess: () => void;
}

export default function SignUpScreen({ navigation, onSignUpSuccess }: SignUpScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(true);

  useEffect(() => {
    setGoogleAvailable(authService.isGoogleSignInAvailable());
  }, []);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await authService.signInWithGoogle();
      onSignUpSuccess();
    } catch (error: any) {
      if (error.message !== 'Google sign-in was cancelled or failed') {
        Alert.alert('Google Sign-In Failed', error.message || 'Please try again');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !fullName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Sign up the user
      await authService.signUp(email.trim(), password, fullName.trim());
      
      // Automatically sign in the user after successful registration
      await authService.signIn(email.trim(), password);
      
      // Show success message and navigate to app
      Alert.alert(
        'Welcome!',
        'Account created successfully. You are now logged in.',
        [{ text: 'OK', onPress: onSignUpSuccess }]
      );
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + 44}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.heroSection}>
            <Text style={styles.title}>Create an account</Text>
            <Text style={styles.subtitle}>Keep your customers and invoices together.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Your details</Text>
            <Text style={styles.formSubtitle}>You can finish business details later in Settings.</Text>

            <Text style={styles.fieldLabel}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Alex Contractor"
              placeholderTextColor={theme.colors.placeholder}
              accessibilityLabel="Full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              editable={!loading && !googleLoading}
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@business.com"
              placeholderTextColor={theme.colors.placeholder}
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading && !googleLoading}
            />

            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 characters"
              placeholderTextColor={theme.colors.placeholder}
              accessibilityLabel="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading && !googleLoading}
            />

            <Text style={styles.fieldLabel}>Confirm password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor={theme.colors.placeholder}
              accessibilityLabel="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading && !googleLoading}
            />

            <TouchableOpacity accessibilityRole="button"
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create an account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity accessibilityRole="button"
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading || googleLoading || !googleAvailable}
            >
              {googleLoading ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <>
                  <GoogleIcon size={20} />
                  <Text style={styles.googleButtonText}>
                    {googleAvailable ? 'Continue with Google' : 'Google sign-in unavailable'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button"
              onPress={() => navigation.goBack()}
              disabled={loading || googleLoading}
            >
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkTextBold}>Sign in</Text>
              </Text>
            </TouchableOpacity>

            <View style={styles.terms}>
              <Text style={styles.termsText}>
                By signing up, you agree to our{' '}
                <Text accessibilityRole="link" onPress={() => setShowTerms(true)} style={styles.linkTextBold}>Terms of Service</Text>{' '}and{' '}
                <Text accessibilityRole="link" onPress={() => setShowPrivacy(true)} style={styles.linkTextBold}>Privacy Policy</Text>.
                {'\n\n'}
                Free tier: 2 invoices/month
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <PrivacyPolicyScreen visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsScreen visible={showTerms} onClose={() => setShowTerms(false)} />
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 30,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    marginBottom: 18,
  },
  title: {
    fontSize: 32,
    fontFamily: theme.fonts.body,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    lineHeight: 23,
    maxWidth: '94%',
  },
  formCard: { paddingVertical: 24, borderTopWidth: 1, borderTopColor: theme.colors.border },
  formTitle: {
    fontSize: 26,
    fontFamily: theme.fonts.body,
    color: theme.colors.text,
    marginBottom: 2,
  },
  formSubtitle: {
    fontSize: 13,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 6,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    color: theme.colors.text,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#1B6C53',
    padding: 15,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: theme.fonts.body,
    fontWeight: '700',
  },
  linkText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    marginTop: 16,
    fontSize: 13,
  },
  linkTextBold: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    marginHorizontal: 10,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    letterSpacing: 0.9,
  },
  googleButton: {
    backgroundColor: theme.colors.cardStrong,
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  googleButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    fontWeight: '700',
  },
  terms: {
    marginTop: 16,
    padding: 16,
    backgroundColor: theme.colors.cardStrong,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  termsText: {
    fontSize: 12,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
