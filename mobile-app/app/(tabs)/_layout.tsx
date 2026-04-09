import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import {
  CalendarDays,
  CheckCircle2,
  LineChart,
  ListTodo,
} from 'lucide-react-native';

import { useAuth } from '../../src/providers/AuthProvider';
import { theme } from '../../src/theme';

export default function TabLayout() {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.tertiary,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(0, 0, 0, 0.98)',
          borderTopColor: theme.colors.borderDim,
          height: 72,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 8,
          fontWeight: '500',
          letterSpacing: 1.8,
          textTransform: 'uppercase',
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
          tabBarIcon: ({ color }) => (
            <CheckCircle2
              size={24}
              color={color}
              strokeWidth={1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => (
            <ListTodo
              size={24}
              color={color}
              strokeWidth={1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => (
            <CalendarDays
              size={24}
              color={color}
              strokeWidth={1.5}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ color }) => (
            <LineChart
              size={24}
              color={color}
              strokeWidth={1.5}
            />
          ),
        }}
      />
    </Tabs>
  );
}
