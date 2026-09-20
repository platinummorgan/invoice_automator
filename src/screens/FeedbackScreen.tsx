import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useMemo } from 'react';
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
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../services/supabase';

const FEEDBACK_CATEGORIES = [
  { id: 'bug', label: 'Report a problem' },
  { id: 'feature', label: 'Request a feature' },
  { id: 'improvement', label: 'Suggest a change' },
  { id: 'other', label: 'Something else' },
];

const RATING_OPTIONS = [1, 2, 3, 4, 5];

interface FeedbackScreenProps {
  navigation: any;
}

export default function FeedbackScreen({ navigation }: FeedbackScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [category, setCategory] = useState('');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Required', 'Please select a feedback category');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Required', 'Please enter your feedback message');
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address or leave it blank');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get user's email if not manually entered
      let userEmail = email.trim();
      if (!userEmail && user?.email) {
        userEmail = user.email;
      }

      // Send feedback via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('send-feedback', {
        body: {
          category,
          rating: rating || null,
          message: message.trim(),
          email: userEmail,
          userId: user?.id || 'Anonymous',
        },
      });

      if (error) {
        console.error('Feedback API error:', error);
        throw error;
      }

      // Check if the response indicates an error (even with 200 status)
      if (data?.error) {
        throw new Error(data.error);
      }

      Alert.alert(
        'Feedback sent',
        'Thank you for helping us improve Swift Invoice.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

      // Reset form
      setCategory('');
      setRating(0);
      setMessage('');
      setEmail('');
    } catch (error: any) {
      console.error('Feedback submission error:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to submit feedback. Please try again or contact support@platovalabs.com directly.';

      if (error.message?.includes('Email service not configured') ||
          error.message?.includes('domain not properly configured')) {
        errorMessage = 'Email service configuration issue. We could not confirm delivery of your feedback. Please contact support@platovalabs.com directly with your feedback.';
      } else if (error.message) {
        errorMessage = `${error.message}\n\nPlease contact support@platovalabs.com if this persists.`;
      }

      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
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
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.header}>What could work better?</Text>
          <Text style={styles.subtitle}>
            Tell us what happened or what you would like to be able to do.
          </Text>

          {/* Category Selection */}
          <Text style={styles.label}>What type of feedback?</Text>
          <View style={styles.categoryContainer}>
            {FEEDBACK_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: category === cat.id }}
                disabled={loading}
                style={[
                  styles.categoryButton,
                  category === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat.id)}
              >

                <Text
                  style={[
                    styles.categoryLabel,
                    category === cat.id && styles.categoryLabelActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rating */}
          <Text style={styles.label}>How would you rate your experience? (Optional)</Text>
          <View style={styles.ratingContainer}>
            {RATING_OPTIONS.map((star) => (
              <TouchableOpacity
                key={star}
                accessibilityRole="radio"
                accessibilityLabel={`${star} out of 5`}
                accessibilityState={{ checked: rating === star }}
                disabled={loading}
                onPress={() => setRating(rating === star ? 0 : star)}
                style={[styles.starButton, rating === star && styles.categoryButtonActive]}
              >
                <Text style={styles.star}>
                  {star}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Message */}
          <Text style={styles.label}>Message</Text>
          <TextInput
            accessibilityLabel="Feedback message"
            editable={!loading}
            style={styles.messageInput}
            placeholder="Tell us what's on your mind..."
            placeholderTextColor={theme.colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={{ fontSize: 12, color: theme.colors.placeholder, textAlign: 'right', marginTop: 4 }}>
            {message.length}/1000
          </Text>

          {/* Email (optional) */}
          <Text style={styles.label}>Reply email (optional)</Text>
          <TextInput
            accessibilityLabel="Reply email"
            editable={!loading}
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            accessibilityRole="button"
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Send feedback</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            Leave the reply email blank to use your account email. Rating: 1 is poor, 5 is excellent. Tap a selected rating to clear it.
          </Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    fontFamily: theme.fonts.body,
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  categoryButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  categoryEmoji: {
    fontFamily: theme.fonts.body,
    fontSize: 20,
    marginRight: 8,
  },
  categoryLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  categoryLabelActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  starButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
  },
  star: {
    fontFamily: theme.fonts.body,
    fontSize: 18,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 16,
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    marginBottom: 16,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 6,
    padding: 16,
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    minHeight: 120,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#1B6C53',
    borderRadius: 6,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontFamily: theme.fonts.body,
    fontSize: 16,
    fontWeight: '600',
  },
  footerNote: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
});
