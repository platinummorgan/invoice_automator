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

interface LoginScreenProps {
  navigation: any;
  onLoginSuccess: () => void;
}

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      onLoginSuccess();
    } catch (error: any) {
      if (error.message !== 'Google sign-in was cancelled or failed') {
        Alert.alert('Google Sign-In Failed', error.message || 'Please try again');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await authService.signIn(email.trim(), password);
      onLoginSuccess();
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.heroSection}>
          <Text style={styles.title}>Swift Invoice</Text>
          <Text style={styles.subtitle}>
            Invoices for the work you do.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign in</Text>
          <Text style={styles.formSubtitle}>Pick up where you left off.</Text>

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
            placeholder="Enter password"
            placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Password"
              value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading && !googleLoading}
          />

          <TouchableOpacity accessibilityRole="button"
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={loading || googleLoading}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity accessibilityRole="button"
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || googleLoading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
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
            onPress={() => navigation.navigate('SignUp')}
            disabled={loading || googleLoading}
          >
            <Text style={styles.linkText}>
              New here? <Text style={styles.linkTextBold}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 30,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: 4,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontFamily: theme.fonts.body,
    fontWeight: '600',
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
});
