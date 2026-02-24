'use client';

import React, { useCallback, useState, useSyncExternalStore } from 'react';
import AuthForm from '@/components/ui/AuthForm';
import { authApi } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import HabitTracker from '@/components/habits/HabitTracker';
import TasksBoard from '@/features/tasks';
import { ToastProvider } from '@/components/ui/ToastProvider';

export default function Home() {
  const [, setAuthTick] = useState(0);
  const [activeTab, setActiveTab] = useState('habits');
  const subscribeAuth = useCallback(() => () => {}, []);
  const isAuthenticated = useSyncExternalStore(
    subscribeAuth,
    () => Boolean(authApi.getCurrentToken()),
    () => false
  );

  const handleLoginSuccess = () => {
    setAuthTick((value) => value + 1);
  };

  const handleLogout = () => {
    authApi.logout();
    setAuthTick((value) => value + 1);
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <AuthForm onLoginSuccess={handleLoginSuccess} />
      </ToastProvider>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'habits':
        return <HabitTracker />;
      case 'tasks':
        return <TasksBoard />;
      case 'finance':
        return (
          <div style={{ padding: '40px 60px', color: 'var(--text-primary)', position: 'relative', zIndex: 1 }}>
            {/* <h1 className="pageTitle">Finance</h1> */}
            <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>Finance tracking coming soon.</p>
          </div>
        );
      default:
        return <HabitTracker />;
    }
  };

  return (
    <ToastProvider>
      <DashboardLayout 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      >
        {renderContent()}
      </DashboardLayout>
    </ToastProvider>
  );
}
