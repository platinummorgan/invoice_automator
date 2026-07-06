import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface Theme {
  colors: {
    primary: string;
    primaryLight: string;
    accent: string;
    accentSoft: string;
    background: string;
    card: string;
    cardStrong: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    inputBackground: string;
    inputBorder: string;
    placeholder: string;
    overlay: string;
    shadow: string;
  };
  fonts: {
    headline: string;
    body: string;
    mono: string;
  };
}

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const lightTheme: Theme = {
  colors: {
    primary: '#1B6C53',
    primaryLight: '#D9EFE5',
    accent: '#C96E1A',
    accentSoft: 'rgba(201,110,26,0.14)',
    background: '#F4EFE5',
    card: '#FFFBF4',
    cardStrong: '#F1E8DA',
    text: '#1E1A14',
    textSecondary: '#5F5242',
    border: '#D8CCBB',
    error: '#C84A43',
    success: '#2C8C5E',
    warning: '#B8821A',
    info: '#2F5EA8',
    inputBackground: '#FFFDF8',
    inputBorder: '#BFA98A',
    placeholder: '#8C7C68',
    overlay: 'rgba(18, 14, 10, 0.58)',
    shadow: '#25180E',
  },
  fonts: {
    headline: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string,
    body: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'sans-serif' }) as string,
    mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
  },
};

const darkTheme: Theme = {
  colors: {
    primary: '#5BC9A0',
    primaryLight: 'rgba(91,201,160,0.18)',
    accent: '#E59A4F',
    accentSoft: 'rgba(229,154,79,0.16)',
    background: '#131514',
    card: '#1D211F',
    cardStrong: '#252B27',
    text: '#F1ECE3',
    textSecondary: '#B0A493',
    border: '#383E3A',
    error: '#FF6B61',
    success: '#3CC27F',
    warning: '#E7B24A',
    info: '#7FB5FF',
    inputBackground: '#202523',
    inputBorder: '#4B5951',
    placeholder: '#8D948D',
    overlay: 'rgba(0, 0, 0, 0.72)',
    shadow: '#000000',
  },
  fonts: {
    headline: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string,
    body: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'sans-serif' }) as string,
    mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@swift_invoice_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    loadThemePreference();
  }, []);

  useEffect(() => {
    if (themeMode === 'system') {
      setIsDark(systemColorScheme === 'dark');
    } else {
      setIsDark(themeMode === 'dark');
    }
  }, [themeMode, systemColorScheme]);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, isDark, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
