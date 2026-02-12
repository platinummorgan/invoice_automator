import React, { useState } from 'react';
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
  { id: 'bug', label: '🐛 Bug Report', emoji: '🐛' },
  { id: 'feature', label: '💡 Feature Request', emoji: '💡' },
  { id: 'improvement', label: '✨ Improvement', emoji: '✨' },
  { id: 'other', label: '💬 General Feedback', emoji: '💬' },
];

const RATING_OPTIONS = [1, 2, 3, 4, 5];

interface FeedbackScreenProps {
  navigation: any;
}

export default function FeedbackScreen({ navigation }: FeedbackScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
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
        'Thank You! 🎉',
        'Your feedback has been submitted successfully. We appreciate you helping us improve Swift Invoice!',
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
        errorMessage = 'Email service configuration issue. Your feedback was recorded but could not be emailed. Please contact support@platovalabs.com directly with your feedback.';
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
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.header}>We'd Love Your Feedback!</Text>
          <Text style={styles.subtitle}>
            Help us improve Swift Invoice by sharing your thoughts, reporting bugs, or suggesting new features.
          </Text>

          {/* Category Selection */}
          <Text style={styles.label}>What type of feedback?</Text>
          <View style={styles.categoryContainer}>
            {FEEDBACK_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryButton,
                  category === cat.id && styles.categoryButtonActive,
                ]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    category === cat.id && styles.categoryLabelActive,
                  ]}
                >
                  {cat.label.replace(/^..\s/, '')}
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
                onPress={() => setRating(star)}
                style={styles.starButton}
              >
                <Text style={styles.star}>
                  {star <= rating ? '⭐' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Message */}
          <Text style={styles.label}>Your Feedback</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Tell us what's on your mind..."
            placeholderTextColor={theme.colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />

          {/* Email (optional) */}
          <Text style={styles.label}>Email (Optional)</Text>
          <TextInput
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
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            We read every piece of feedback and use it to make Swift Invoice better for everyone.
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
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 32,
    lineHeight: 22,
  },
  label: {
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
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    minWidth: '47%',
  },
  categoryButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '15',
  },
  categoryEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryLabel: {
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
    padding: 4,
  },
  star: {
    fontSize: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    marginBottom: 16,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    minHeight: 120,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
