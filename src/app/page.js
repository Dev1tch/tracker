'use client';

import React, { useState, useEffect } from 'react';
import AuthForm from '@/components/ui/AuthForm';
import { authApi } from '@/lib/api';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

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

  return (
    <main style={{ padding: '40px', background: '#000', minHeight: '100vh', color: '#fff' }}>
      <h1>Welcome to Life tracker</h1>
      <p>Hello! You are now authenticated.</p>
      <button 
        onClick={handleLogout}
        style={{ 
          background: 'transparent', 
          border: '1px solid rgba(255,255,255,0.2)', 
          color: '#fff', 
          padding: '10px 20px', 
          cursor: 'pointer',
          marginTop: '20px'
        }}
      >
        Sign out
      </button>
    </main>
  );
}
