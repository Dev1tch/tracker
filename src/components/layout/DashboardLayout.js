'use client';

import React, { useEffect, useRef } from 'react';
import { CheckCircle2, ListTodo, CalendarDays, LineChart, LogOut } from 'lucide-react';
import './Dashboard.css';

export default function DashboardLayout({ children, activeTab, onTabChange, onLogout }) {
  const canvasRef = useRef(null);

  // Subtle background particles for the dashboard
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height, particles;

    function init() {
      const parent = canvas.parentElement;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      
      const particleCount = 100;
      particles = [];

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          radius: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.3 + 0.1
        });
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      });

      requestAnimationFrame(animate);
    }

    const handleResize = () => init();
    window.addEventListener('resize', handleResize);
    
    init();
    animate();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="dashboardContainer">
      <canvas ref={canvasRef} className="dashboardParticles" />

      {/* Subtle Top Branding */}
      <header className="topHeader">
        <div className="brand">
          Life tracker 
          <span style={{ opacity: 0.3, margin: '0 4px', textTransform: 'none' }}>/</span> 
          <span style={{ color: 'var(--text-secondary)' }}>{activeTab}</span>
        </div>
        <button 
          className="logoutFab" 
          onClick={onLogout}
          title="Sign Out"
        >
          <LogOut size={16} strokeWidth={1.5} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="mainContent">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottomNav">
        <div className="navContainer">
          <button 
            className={`navItem ${activeTab === 'habits' ? 'active' : ''}`}
            onClick={() => onTabChange('habits')}
          >
            <CheckCircle2 size={24} strokeWidth={1.5} />
            <span className="navLabel">Habits</span>
          </button>
          <button 
            className={`navItem ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => onTabChange('tasks')}
          >
            <ListTodo size={24} strokeWidth={1.5} />
            <span className="navLabel">Tasks</span>
          </button>
          <button 
            className={`navItem ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => onTabChange('calendar')}
          >
            <CalendarDays size={24} strokeWidth={1.5} />
            <span className="navLabel">Calendar</span>
          </button>
          <button 
            className={`navItem ${activeTab === 'finance' ? 'active' : ''}`}
            onClick={() => onTabChange('finance')}
          >
            <LineChart size={24} strokeWidth={1.5} />
            <span className="navLabel">Finance</span>
          </button>
        </div>
      </nav>



    </div>
  );
}
