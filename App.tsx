import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { authService } from './src/services/auth';
import { subscriptionService } from './src/services/subscription';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';

function AppContent({ isAuthenticated, onLoginSuccess }: { isAuthenticated: boolean; onLoginSuccess: () => void }) {
  const { isDark } = useTheme();
  
  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator
        isAuthenticated={isAuthenticated}
        onLoginSuccess={onLoginSuccess}
      />
    </SafeAreaProvider>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const restoredPurchaseUserIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    subscriptionService.initialize().catch((error) => {
      console.warn('Error initializing IAP services:', error);
    });

    checkAuth();

    const { data: authListener } = authService.onAuthStateChange(
      (event, session) => {
        setIsAuthenticated(!!session);
        if (!session) {
          restoredPurchaseUserIdsRef.current.clear();
          return;
        }
        restorePurchasesForSession(session).catch((error) => {
          console.warn('Error restoring purchases after auth change:', error);
        });
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
      subscriptionService.cleanup().catch((error) => {
        console.warn('Error cleaning up IAP services:', error);
      });
    };
  }, []);

  const checkAuth = async () => {
    try {
      const session = await authService.getSession();
      setIsAuthenticated(!!session);
      restorePurchasesForSession(session).catch((error) => {
        console.warn('Error restoring purchases during auth check:', error);
      });
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const restorePurchasesForSession = async (session: any) => {
    const userId = session?.user?.id;
    if (!userId || !subscriptionService.isIapAvailable()) return;

    if (restoredPurchaseUserIdsRef.current.has(userId)) return;
    restoredPurchaseUserIdsRef.current.add(userId);

    try {
      await subscriptionService.restorePurchases();
    } catch (error) {
      restoredPurchaseUserIdsRef.current.delete(userId);
      throw error;
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppContent
        isAuthenticated={isAuthenticated}
        onLoginSuccess={handleLoginSuccess}
      />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
