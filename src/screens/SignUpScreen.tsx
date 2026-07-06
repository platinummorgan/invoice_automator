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
import { authService } from '../services/auth';
import { useTheme } from '../contexts/ThemeContext';
import { GoogleIcon } from '../components/GoogleIcon';

interface SignUpScreenProps {
  navigation: any;
  onSignUpSuccess: () => void;
}

export default function SignUpScreen({ navigation, onSignUpSuccess }: SignUpScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(true);
  const [introAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    setGoogleAvailable(authService.isGoogleSignInAvailable());
    Animated.timing(introAnim, {
      toValue: 1,
      duration: 550,
      useNativeDriver: true,
    }).start();
  }, []);

  const showGoogleSignIn = Platform.OS !== 'ios' && googleAvailable;

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
    if (!email || !password || !fullName) {
      Alert.alert('Error', 'Please fill in all fields');
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
      await authService.signUp(email, password, fullName);
      
      // Automatically sign in the user after successful registration
      await authService.signIn(email, password);
      
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
    >
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.content,
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
          <View style={styles.heroSection}>
            <Text style={styles.kicker}>FAST ONBOARDING</Text>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Set up once. Send polished invoices from anywhere.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Business Profile</Text>
            <Text style={styles.formSubtitle}>You can finish business details later in Settings.</Text>

            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Alex Contractor"
              placeholderTextColor={theme.colors.placeholder}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              editable={!loading}
            />

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
              placeholder="Minimum 6 characters"
              placeholderTextColor={theme.colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />

            <Text style={styles.fieldLabel}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor={theme.colors.placeholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading || googleLoading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {showGoogleSignIn && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
                  onPress={handleGoogleSignIn}
                  disabled={loading || googleLoading}
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
              </>
            )}

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={loading || googleLoading}
            >
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkTextBold}>Login</Text>
              </Text>
            </TouchableOpacity>

            <View style={styles.terms}>
              <Text style={styles.termsText}>
                By signing up, you agree to our Terms of Service and Privacy Policy.
                {'\n\n'}
                Free tier: 2 invoices/month
              </Text>
            </View>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 30,
  },
  content: {
    flex: 1,
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
    fontSize: 38,
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
    borderRadius: 12,
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
