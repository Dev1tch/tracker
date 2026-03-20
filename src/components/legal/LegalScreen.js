'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import './LegalScreen.css';

export default function LegalScreen({ title, updatedAt, side = 'right', switchHref, switchLabel, children }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');

    let width;
    let height;
    let particles;
    let mouse;
    let frameId;

    function init() {
      width = canvas.width = window.innerWidth * 2;
      height = canvas.height = window.innerHeight * 2;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      mouse = { x: -1000, y: -1000 };
      const particleCount = 1200;
      particles = [];

      for (let i = 0; i < particleCount; i += 1) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
          x,
          y,
          originX: x,
          originY: y,
          vx: 0,
          vy: 0,
          radius: Math.random() * 2 + 1,
          baseRadius: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.1,
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
          const force = ((maxDist - dist) / maxDist) ** 2;
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

        for (let j = i + 1; j < particles.length; j += 1) {
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

      frameId = requestAnimationFrame(animate);
    }

    const handleMouseMove = (event) => {
      mouse.x = event.clientX * 2;
      mouse.y = event.clientY * 2;
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    init();
    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="legalBody">
      <canvas ref={canvasRef} className="legalParticleCanvas" />

      <div className={`legalPanel ${side === 'left' ? 'left' : 'right'}`}>
        <div className="legalContainer">
          <div className="legalLogo">Life tracker</div>

          <div className="legalTopLinks">
            <Link href="/" className="legalTopLink">
              Back
            </Link>
            {switchHref && switchLabel ? (
              <Link href={switchHref} className="legalTopLink">
                {switchLabel}
              </Link>
            ) : null}
          </div>

          <h1 className="legalTitle">{title}</h1>
          <p className="legalUpdated">Last updated: {updatedAt}</p>

          <div className="legalContent">{children}</div>
        </div>
      </div>
    </div>
  );
}
