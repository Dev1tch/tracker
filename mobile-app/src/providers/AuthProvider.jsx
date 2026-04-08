import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authApi } from '../shared/api';
import { initializeSharedRuntime } from '../shared/runtime';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState(null);
  const [webAppUrl, setWebAppUrl] = useState('');

  useEffect(() => {
    let isMounted = true;

    initializeSharedRuntime({
      onAuthChange: (nextToken) => {
        if (isMounted) {
          setToken(nextToken || null);
        }
      },
      onUnauthorized: () => {
        if (isMounted) {
          setToken(null);
        }
      },
    })
      .then((runtime) => {
        if (!isMounted) return;
        setToken(runtime.token);
        setWebAppUrl(runtime.webAppUrl);
        setIsReady(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await authApi.login(email, password);
    setToken(authApi.getCurrentToken());
    return response;
  }, []);

  const signup = useCallback(async (payload) => {
    await authApi.signup(payload);
    const response = await authApi.login(payload.email, payload.password);
    setToken(authApi.getCurrentToken());
    return response;
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setToken(null);
  }, []);

  const value = useMemo(() => ({
    isReady,
    isAuthenticated: Boolean(token),
    token,
    webAppUrl,
    login,
    signup,
    logout,
  }), [isReady, token, webAppUrl, login, signup, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
