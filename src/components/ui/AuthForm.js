'use client';

import React, { useState, useEffect, useRef } from 'react';
import './AuthForm.css';
import { authApi } from '@/lib/api';

export default function AuthForm({ onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const canvasRef = useRef(null);

  useEffect(() => {
    // Particle system
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width, height, particles, mouse;

    function init() {
      width = canvas.width = window.innerWidth * 2;
      height = canvas.height = window.innerHeight * 2;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      
      mouse = { x: -1000, y: -1000 };
      
      const particleCount = 1200;
      particles = [];

      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
          x: x,
          y: y,
          originX: x,
          originY: y,
          vx: 0,
          vy: 0,
          radius: Math.random() * 2 + 1,
          baseRadius: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.1
        });
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p, i) => {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 400;

        if (dist < maxDist && dist > 0) {
          const force = Math.pow((maxDist - dist) / maxDist, 2);
          p.vx += (dx / dist) * force * 0.15;
          p.vy += (dy / dist) * force * 0.15;
          p.radius += (p.baseRadius + force * 2 - p.radius) * 0.05;
        } else {
          p.radius += (p.baseRadius - p.radius) * 0.02;
        }

        const homeX = p.originX - p.x;
        const homeY = p.originY - p.y;
        p.vx += homeX * 0.002;
        p.vy += homeY * 0.002;

        p.x += p.vx;
        p.y += p.vy;

        p.vx *= 0.97;
        p.vy *= 0.97;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < 70) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * (1 - dist2 / 70)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      });

      requestAnimationFrame(animate);
    }

    const handleMouseMove = (e) => {
      mouse.x = e.clientX * 2;
      mouse.y = e.clientY * 2;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth * 2;
      height = canvas.height = window.innerHeight * 2;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    
    init();
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await authApi.login(formData.email, formData.password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await authApi.signup({
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName
      });
      // Automatically login after signup
      await authApi.login(formData.email, formData.password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="authBody">
      <canvas ref={canvasRef} className="particleCanvas"></canvas>

      <div className="rightPanel">
        <div className="authContainer">
          <div className="authLogo">Life tracker</div>
          
          <div className="authTabs">
            <button 
              className={`authTab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => setActiveTab('login')}
            >
              Sign in
            </button>
            <button 
              className={`authTab ${activeTab === 'signup' ? 'active' : ''}`}
              onClick={() => setActiveTab('signup')}
            >
              Register
            </button>
          </div>

          <div className="authFormFade">
            {activeTab === 'login' ? (
              <form onSubmit={handleLogin}>
                <div className="authInputGroup">
                  <input 
                    type="email" 
                    name="email"
                    className="authInput" 
                    placeholder="Email address"
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="authInputGroup">
                  <input 
                    type="password" 
                    name="password"
                    className="authInput" 
                    placeholder="Password" 
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                {error && <div className="authError">{error}</div>}
                <button type="submit" className="authSubmitBtn" disabled={isLoading}>
                  <span>{isLoading ? 'Verifying...' : 'Initialize'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="authInputGroup" style={{ flex: 1 }}>
                    <input 
                      type="text" 
                      name="firstName"
                      className="authInput" 
                      placeholder="First name" 
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="authInputGroup" style={{ flex: 1 }}>
                    <input 
                      type="text" 
                      name="lastName"
                      className="authInput" 
                      placeholder="Last name" 
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="authInputGroup">
                  <input 
                    type="email" 
                    name="email"
                    className="authInput" 
                    placeholder="Email address" 
                    required
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="authInputGroup">
                  <input 
                    type="password" 
                    name="password"
                    className="authInput" 
                    placeholder="Create password" 
                    required
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
                {error && <div className="authError">{error}</div>}
                <button type="submit" className="authSubmitBtn" disabled={isLoading}>
                  <span>{isLoading ? 'Processing...' : 'Create identity'}</span>
                </button>
              </form>
            )}
          </div>

          <div className="authFooter">
            {/* <a>Have Fun</a>  */}
          </div>
        </div>
      </div>
    </div>
  );
}
