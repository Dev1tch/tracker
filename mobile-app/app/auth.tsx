import React from 'react';
import { Redirect } from 'expo-router';

import AuthScreen from '../src/features/auth/AuthScreen';
import { useAuth } from '../src/providers/AuthProvider';

export default function AuthRoute() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/habits" />;
  }

  return <AuthScreen />;
}
