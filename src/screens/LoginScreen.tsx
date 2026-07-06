import React, { useEffect, useState } from 'react';
import {
  Animated,
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
import * as AppleAuthentication from 'expo-apple-authentication';
import { authService } from '../services/auth';
import { useTheme } from '../contexts/ThemeContext';
import { GoogleIcon } from '../components/GoogleIcon';

interface LoginScreenProps {
  navigation: any;
  onLoginSuccess: () => void;
}

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(true);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [introAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    setGoogleAvailable(authService.isGoogleSignInAvailable());
    authService.isAppleSignInAvailable().then(setAppleAvailable).catch(() => {
      setAppleAvailable(false);
    });
    Animated.timing(introAnim, {
      toValue: 1,
      duration: 550,
      useNativeDriver: true,
    }).start();
  }, []);

  const showGoogleSignIn = googleAvailable;
  const showAppleSignIn = Platform.OS === 'ios' && appleAvailable;
  const showStoreSignIn = showGoogleSignIn || showAppleSignIn;

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await authService.signInWithGoogle();
      onLoginSuccess();
    } catch (error: any) {
      if (!/cancelled/i.test(error.message || '')) {
        Alert.alert('Google Sign-In Failed', error.message || 'Please try again');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      await authService.signInWithApple();
      onLoginSuccess();
    } catch (error: any) {
      if (!/cancelled/i.test(error.message || '')) {
        Alert.alert('Apple Sign-In Failed', error.message || 'Please try again');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await authService.signIn(email, password);
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
    >
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View
          style={[
            styles.heroSection,
            {
              opacity: introAnim,
              transform: [
                {
                  translateY: introAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.kicker}>FIELD-READY INVOICING</Text>
          <Text style={styles.title}>Swift Invoice</Text>
          <Text style={styles.subtitle}>
            Built for jobsite speed, but polished enough to send in minutes.
          </Text>
          <View style={styles.statRow}>
            <Text style={styles.statChip}>2 free invoices / month</Text>
            <Text style={styles.statChip}>One-tap email drafts</Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.formCard,
            {
              opacity: introAnim,
              transform: [
                {
                  translateY: introAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formSubtitle}>Log in to manage invoices and payment follow-ups.</Text>

          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@business.com"
            placeholderTextColor={theme.colors.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor={theme.colors.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={loading}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || googleLoading || appleLoading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          {showStoreSignIn && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {showAppleSignIn && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={[styles.appleButton, appleLoading && styles.buttonDisabled]}
                  onPress={handleAppleSignIn}
                />
              )}

              {showGoogleSignIn && (
                <TouchableOpacity
                  style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
                  onPress={handleGoogleSignIn}
                  disabled={loading || googleLoading || appleLoading}
                >
                  {googleLoading ? (
                    <ActivityIndicator color={theme.colors.text} />
                  ) : (
                    <>
                      <GoogleIcon size={20} />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('SignUp')}
            disabled={loading || googleLoading || appleLoading}
          >
            <Text style={styles.linkText}>
              New here? <Text style={styles.linkTextBold}>Create an account</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
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
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 30,
  },
  bgOrbTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -90,
    right: -70,
    backgroundColor: theme.colors.primaryLight,
  },
  bgOrbBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    bottom: -140,
    left: -120,
    backgroundColor: theme.colors.accentSoft,
  },
  heroSection: {
    marginBottom: 18,
  },
  kicker: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.cardStrong,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    letterSpacing: 0.9,
    marginBottom: 14,
  },
  title: {
    fontSize: 40,
    fontFamily: theme.fonts.headline,
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
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  statChip: {
    fontSize: 12,
    fontFamily: theme.fonts.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  formCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.11,
    shadowRadius: 14,
    elevation: 3,
  },
  formTitle: {
    fontSize: 26,
    fontFamily: theme.fonts.headline,
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
    fontSize: 11,
    fontFamily: theme.fonts.body,
    letterSpacing: 0.8,
    color: theme.colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    color: theme.colors.text,
    marginBottom: 10,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 12,
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
    marginTop: -2,
    marginBottom: 4,
  },
  forgotPasswordText: {
    color: theme.colors.accent,
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
    color: theme.colors.accent,
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
    fontSize: 11,
    letterSpacing: 0.9,
  },
  googleButton: {
    backgroundColor: theme.colors.cardStrong,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
    marginTop: 10,
  },
  appleButton: {
    width: '100%',
    height: 48,
    marginBottom: 10,
  },
  googleButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    fontWeight: '700',
  },
});
