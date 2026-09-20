import AppIcon from '../components/AppIcon';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Text, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';

import LoginScreen from '../screens/LoginScreen';
import SignUpScreen from '../screens/SignUpScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import DashboardScreen from '../screens/DashboardScreen';
import NewInvoiceScreen from '../screens/NewInvoiceScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import InvoiceBrandingScreen from '../screens/InvoiceBrandingScreen';
import ReportsScreen from '../screens/ReportsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import FeedbackScreen from '../screens/FeedbackScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import TemplatePreviewScreen from '../screens/TemplatePreviewScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

interface AppNavigatorProps {
  isAuthenticated: boolean;
  onLoginSuccess: () => void;
}

function MainTabs() {
  const { theme, isDark } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          fontSize: 22,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.body,
          fontSize: 12,
          letterSpacing: 0.4,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Invoices',
          headerShown: false,
          headerTitleAlign: 'left',
          headerRight: () => null,
          tabBarIcon: ({ color }) => (
            <AppIcon name="invoice" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          title: 'Reports',
          headerTitle: 'Reports',
          headerTitleAlign: 'left',
          tabBarIcon: ({ color }) => (
            <AppIcon name="reports" color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
          headerTitleAlign: 'left',
          headerRight: () => null,
          tabBarIcon: ({ color }) => (
            <AppIcon name="settings" color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator({ isAuthenticated, onLoginSuccess }: AppNavigatorProps) {
  const { theme, isDark } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const checkOnboardingStatus = useCallback(async () => {
    if (isAuthenticated) {
      try {
        const completed = await AsyncStorage.getItem('onboarding_completed');
        setShowOnboarding(!completed);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setShowOnboarding(false);
      }
    } else {
      setShowOnboarding(false);
    }
    setCheckingOnboarding(false);
  }, [isAuthenticated]);

  useEffect(() => {
    checkOnboardingStatus();
  }, [checkOnboardingStatus]);

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
      setShowOnboarding(false);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      setShowOnboarding(false);
    }
  };

  const navigationTheme = useMemo(() => ({
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.card,
      text: theme.colors.text,
      border: theme.colors.border,
    },
  }), [isDark, theme]);

  if (checkingOnboarding && isAuthenticated) {
    return (
      <View style={navStyles.splash}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.colors.background,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: theme.colors.text,
          headerTitleStyle: {
            color: theme.colors.text,
            fontFamily: theme.fonts.headline,
            fontSize: 21,
            letterSpacing: 0.3,
          },
          headerShadowVisible: false,
        }}
      >
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {(props) => <LoginScreen {...props} onLoginSuccess={onLoginSuccess} />}
            </Stack.Screen>
            <Stack.Screen name="SignUp" options={{ title: 'Create an account', headerTitleStyle: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text } }}>
              {(props) => <SignUpScreen {...props} onSignUpSuccess={onLoginSuccess} />}
            </Stack.Screen>
            <Stack.Screen 
              name="ForgotPassword" 
              component={ForgotPasswordScreen}
              options={{ title: 'Reset password', headerTitleStyle: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text } }}
            />
          </>
        ) : showOnboarding ? (
          <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
            {() => <OnboardingScreen onComplete={handleOnboardingComplete} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="NewInvoice"
              component={NewInvoiceScreen}
              options={({ route }) => ({ title: (route.params as { invoiceId?: string } | undefined)?.invoiceId ? 'Edit draft' : 'New invoice', headerTitleStyle: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text } })}
            />
            <Stack.Screen
              name="InvoiceDetail"
              component={InvoiceDetailScreen}
              options={{ title: 'Invoice', headerTitleStyle: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text } }}
            />
            <Stack.Screen
              name="Feedback"
              component={FeedbackScreen}
              options={{ title: 'Send feedback', headerTitleStyle: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text } }}
            />
            <Stack.Screen
              name="HelpSupport"
              component={HelpSupportScreen}
              options={{ title: 'Help & support', headerTitleStyle: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text } }}
            />
            <Stack.Screen
              name="InvoiceBranding"
              component={InvoiceBrandingScreen}
              options={{ title: 'Invoice design', headerTitleStyle: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text } }}
            />
            <Stack.Screen
              name="TemplatePreview"
              component={TemplatePreviewScreen}
              options={{ title: 'Invoice preview', headerTitleStyle: { fontFamily: theme.fonts.body, fontSize: 20, fontWeight: '600', color: theme.colors.text } }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const navStyles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
