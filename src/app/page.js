'use client';

import React, { useCallback, useEffect, useSyncExternalStore } from 'react';
import AuthForm from '@/components/ui/AuthForm';
import { authApi, AUTH_CHANGE_EVENT } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import HabitTracker from '@/features/habits/HabitTracker';
import TasksBoard from '@/features/tasks';
import Calendar from '@/features/calendar/Calendar';
import Finance from '@/features/finance/Finance';
import Board from '@/features/board/Board';
import Notes from '@/features/notes';
import { FinanceVaultProvider } from '@/features/finance/hooks/useVault';
import { ToastProvider } from '@/components/ui/ToastProvider';

const DEFAULT_TAB = 'habits';
const ACTIVE_TAB_STORAGE_KEY = 'life_tracker.active_tab';
const ACTIVE_TAB_CHANGE_EVENT = 'life-tracker:active-tab-change';
const VALID_TABS = new Set(['habits', 'tasks', 'projects', 'calendar', 'finance', 'board', 'notes']);

function normalizeTab(tab) {
  return VALID_TABS.has(tab) ? tab : DEFAULT_TAB;
}

function getActiveTabSnapshot() {
  if (typeof window === 'undefined') return DEFAULT_TAB;

  const params = new URLSearchParams(window.location.search);
  const tabFromUrl = params.get('tab');
  if (VALID_TABS.has(tabFromUrl)) {
    return tabFromUrl;
  }

  return normalizeTab(window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY));
}

function subscribeToActiveTab(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event) => {
    if (event.type === 'storage' && event.key && event.key !== ACTIVE_TAB_STORAGE_KEY) {
      return;
    }

    callback();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener('popstate', callback);
  window.addEventListener(ACTIVE_TAB_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('popstate', callback);
    window.removeEventListener(ACTIVE_TAB_CHANGE_EVENT, callback);
  };
}

function persistActiveTab(tab, { updateUrl } = { updateUrl: false }) {
  if (typeof window === 'undefined') return;

  const normalizedTab = normalizeTab(tab);
  window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, normalizedTab);

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', normalizedTab);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  window.dispatchEvent(new Event(ACTIVE_TAB_CHANGE_EVENT));
}

function getAuthSnapshot() {
  if (typeof window === 'undefined') return null;
  return Boolean(authApi.getCurrentToken());
}

function subscribeToAuth(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleStorage = (event) => {
    if (event.key && event.key !== 'token') {
      return;
    }

    callback();
  };

  window.addEventListener('storage', handleStorage);
  window.addEventListener(AUTH_CHANGE_EVENT, callback);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(AUTH_CHANGE_EVENT, callback);
  };
}

export default function Home() {
  const isAuthenticated = useSyncExternalStore(
    subscribeToAuth,
    getAuthSnapshot,
    () => null
  );
  const activeTab = useSyncExternalStore(
    subscribeToActiveTab,
    getActiveTabSnapshot,
    () => DEFAULT_TAB
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    persistActiveTab(getActiveTabSnapshot());
  }, []);

  const handleLoginSuccess = useCallback(() => {}, []);

  const handleLogout = useCallback(() => {
    authApi.logout();
  }, []);

  if (isAuthenticated === null) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <AuthForm onLoginSuccess={handleLoginSuccess} />
      </ToastProvider>
    );
  }

  const handleTabChange = (tab) => {
    persistActiveTab(tab, { updateUrl: true });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'habits':
        return <HabitTracker />;
      case 'tasks':
        return <TasksBoard mode="personal" />;
      case 'projects':
        return <TasksBoard mode="projects" />;
      case 'calendar':
        return <Calendar />;
      case 'finance':
        return <Finance />;
      case 'board':
        return <Board />;
      case 'notes':
        return <Notes />;
      default:
        return <HabitTracker />;
    }
  };

  return (
    <ToastProvider>
      <FinanceVaultProvider>
        <DashboardLayout
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
        >
          {renderContent()}
        </DashboardLayout>
      </FinanceVaultProvider>
    </ToastProvider>
  );
}
