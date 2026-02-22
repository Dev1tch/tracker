'use client';

import React, { useState, useEffect } from 'react';
import AuthForm from '@/components/ui/AuthForm';
import { authApi } from '@/lib/api';
import DashboardLayout from '@/components/layout/DashboardLayout';
import HabitTracker from '@/components/habits/HabitTracker';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('habits');

  useEffect(() => {
    const token = authApi.getCurrentToken();
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authApi.logout();
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Initializing...</div>;
  }

  if (!isAuthenticated) {
    return <AuthForm onLoginSuccess={handleLoginSuccess} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'habits':
        return <HabitTracker />;
      case 'tasks':
        return (
          <div style={{ padding: '40px 60px', color: 'var(--text-primary)', position: 'relative', zIndex: 1 }}>
            <h1 className="pageTitle">Tasks</h1>
            <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>Task management coming soon.</p>
          </div>
        );
      case 'finance':
        return (
          <div style={{ padding: '40px 60px', color: 'var(--text-primary)', position: 'relative', zIndex: 1 }}>
            <h1 className="pageTitle">Finance</h1>
            <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>Finance tracking coming soon.</p>
          </div>
        );
      default:
        return <HabitTracker />;
    }
  };

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      onLogout={handleLogout}
    >
      {renderContent()}
    </DashboardLayout>
  );
}
