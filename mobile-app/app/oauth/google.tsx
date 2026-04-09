import React from 'react';
import { Redirect } from 'expo-router';

import LoadingScreen from '../../src/components/LoadingScreen';
import { useAuth } from '../../src/providers/AuthProvider';

export default function GoogleOAuthRoute() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoadingScreen message="Returning from Google…" />;
  }

  return <Redirect href="/(tabs)/calendar" />;
}
