import React from 'react';
import { Redirect } from 'expo-router';

import LoadingScreen from '../src/components/LoadingScreen';
import { useAuth } from '../src/providers/AuthProvider';

export default function IndexScreen() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) {
    return <LoadingScreen message="Loading mobile workspace…" />;
  }

  return <Redirect href={isAuthenticated ? '/(tabs)/habits' : '/auth'} />;
}
