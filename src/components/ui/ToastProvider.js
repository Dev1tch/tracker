import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';
import './Toast.css';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 2000) => {
    const id = Date.now().toString() + Math.random().toString();
    const newToast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => 
      prev.map(toast => toast.id === id ? { ...toast, isClosing: true } : toast)
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300); // Matches the 0.3s CSS animation duration
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toastContainer">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toastItem ${toast.type} ${toast.isClosing ? 'closing' : ''}`}>
            <div className="toastIcon">
              {toast.type === 'success' ? (
                <CheckCircle size={18} />
              ) : toast.type === 'warning' ? (
                <AlertTriangle size={18} />
              ) : (
                <XCircle size={18} />
              )}
            </div>
            <div className="toastMessage">{toast.message}</div>
            <button className="toastClose" onClick={() => removeToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
