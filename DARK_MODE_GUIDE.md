# Dark Mode Implementation Guide

## Overview
Dark mode has been implemented using a ThemeContext that provides:
- Light theme
- Dark theme  
- System theme (follows device settings)

## How It Works

### 1. Theme Provider
The app is wrapped in `ThemeProvider` in `App.tsx`, making theme available throughout the app.

### 2. Theme Context
Located at `src/contexts/ThemeContext.tsx`, provides:
```typescript
{
  theme: Theme,           // Current theme colors
  themeMode: ThemeMode,   // 'light' | 'dark' | 'system'
  isDark: boolean,        // Current theme is dark
  setThemeMode: (mode) => void  // Change theme
}
```

### 3. Color Palette

**Light Theme:**
- Primary: #007AFF
- Background: #FFFFFF
- Card: #F9F9F9
- Text: #333333
- Text Secondary: #666666
- Border: #E0E0E0

**Dark Theme:**
- Primary: #0A84FF (iOS blue for dark mode)
- Background: #000000
- Card: #1C1C1E
- Text: #FFFFFF
- Text Secondary: #A0A0A0
- Border: #38383A

### 4. Settings Control
Users can select theme in Settings → Appearance:
- ☀️ Light
- 🌙 Dark
- ⚙️ Auto (follows system)

## How to Update Existing Screens

### Step 1: Import useTheme
```typescript
import { useTheme } from '../contexts/ThemeContext';
```

### Step 2: Get theme in component
```typescript
export default function MyScreen() {
  const { theme } = useTheme();
  
  // Use theme.colors instead of hardcoded colors
}
```

### Step 3: Update StyleSheet
Replace hardcoded colors with theme colors:

**Before:**
```typescript
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  text: {
    color: '#333',
  },
});
```

**After:**
```typescript
// Create dynamic styles function
const createStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
  },
  text: {
    color: theme.colors.text,
  },
});

// Use in component
export default function MyScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello</Text>
    </View>
  );
}
```

## Available Theme Colors

```typescript
theme.colors.primary          // Primary brand color
theme.colors.background       // Main background
theme.colors.card             // Card/elevated surfaces
theme.colors.text             // Primary text
theme.colors.textSecondary    // Secondary/muted text
theme.colors.border           // Borders and dividers
theme.colors.error            // Error states (#F44336 / #FF453A)
theme.colors.success          // Success states (#4CAF50 / #32D74B)
theme.colors.warning          // Warning states (#FFC107 / #FFD60A)
theme.colors.info             // Info states (#2196F3 / #64D2FF)
theme.colors.inputBackground  // Input field backgrounds
theme.colors.inputBorder      // Input field borders
theme.colors.placeholder      // Placeholder text
theme.colors.overlay          // Modal/overlay backgrounds
theme.colors.shadow           // Shadow colors
```

## Priority Update List

High priority screens (user-facing):
1. ✅ SettingsScreen (theme selector implemented)
2. ⏳ LoginScreen
3. ⏳ SignUpScreen
4. ⏳ ForgotPasswordScreen
5. ⏳ DashboardScreen
6. ⏳ NewInvoiceScreen
7. ⏳ InvoiceDetailScreen
8. ⏳ CustomerListScreen
9. ⏳ ReportsScreen

Lower priority (modal/info screens):
- PrivacyPolicyScreen
- TermsScreen
- AboutScreen

## Example: Converting LoginScreen

```typescript
import { useTheme } from '../contexts/ThemeContext';

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  
  // ... rest of component
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 48,
    textAlign: 'center',
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 2,
    borderColor: theme.colors.inputBorder,
    color: theme.colors.text,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.textSecondary,
  },
  linkTextBold: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
```

## Testing Dark Mode

1. Open app
2. Navigate to Settings
3. Tap "Appearance" section
4. Select Dark mode
5. Navigate through app to see dark theme
6. Select Auto to follow system settings

## Persistence

Theme preference is saved using AsyncStorage and persists across app restarts.

## StatusBar

The StatusBar in `App.tsx` automatically adjusts:
- Light theme → dark StatusBar text
- Dark theme → light StatusBar text
