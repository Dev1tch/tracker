import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../src/providers/AuthProvider';
import { ToastProvider } from '../src/providers/ToastProvider';
import { DialogProvider } from '../src/providers/DialogProvider';
import { FinanceVaultProvider } from '../src/features/finance/hooks/useVault';
import { ThemeProvider, useThemeControls, isLightTheme } from '../src/theme';

function ThemedStatusBar() {
  const { theme } = useThemeControls();
  return <StatusBar style={isLightTheme(theme) ? 'dark' : 'light'} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <DialogProvider>
              <AuthProvider>
                <FinanceVaultProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="auth" />
                    <Stack.Screen name="privacy" />
                    <Stack.Screen name="terms" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="oauth/google" />
                  </Stack>
                  <ThemedStatusBar />
                </FinanceVaultProvider>
              </AuthProvider>
            </DialogProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
