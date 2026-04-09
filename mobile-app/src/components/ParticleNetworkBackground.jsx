import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

const MIN_PARTICLES = 110;
const MAX_PARTICLES = 170;
const PARTICLE_AREA = 2200;
const LINK_DISTANCE = 35;
const INTERACTION_DISTANCE = 200;
const FRAME_INTERVAL = 32;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createParticles(width, height, count) {
  return Array.from({ length: count }, () => {
    const radius = Math.random() + 0.5;

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      originX: Math.random() * width,
      originY: Math.random() * height,
      vx: 0,
      vy: 0,
      radius,
      baseRadius: radius,
      opacity: Math.random() * 0.5 + 0.1,
    };
  }).map((particle) => ({
    ...particle,
    originX: particle.x,
    originY: particle.y,
  }));
}

function buildScene(particles, target) {
  const lines = [];
  const circles = [];

  particles.forEach((particle, index) => {
    const dx = target.x - particle.x;
    const dy = target.y - particle.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < INTERACTION_DISTANCE && distance > 0) {
      const force = ((INTERACTION_DISTANCE - distance) / INTERACTION_DISTANCE) ** 2;
      particle.vx += (dx / distance) * force * 0.15;
      particle.vy += (dy / distance) * force * 0.15;
      particle.radius += (particle.baseRadius + force * 2 - particle.radius) * 0.05;
    } else {
      particle.radius += (particle.baseRadius - particle.radius) * 0.02;
    }

    const homeX = particle.originX - particle.x;
    const homeY = particle.originY - particle.y;

    particle.vx += homeX * 0.002;
    particle.vy += homeY * 0.002;

    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.97;
    particle.vy *= 0.97;

    circles.push({
      x: particle.x,
      y: particle.y,
      radius: particle.radius,
      opacity: particle.opacity,
    });

    for (let nextIndex = index + 1; nextIndex < particles.length; nextIndex += 1) {
      const other = particles[nextIndex];
      const otherDx = particle.x - other.x;
      const otherDy = particle.y - other.y;
      const otherDistance = Math.sqrt(otherDx * otherDx + otherDy * otherDy);

      if (otherDistance < LINK_DISTANCE) {
        lines.push({
          x1: particle.x,
          y1: particle.y,
          x2: other.x,
          y2: other.y,
          opacity: 0.5 * (1 - otherDistance / LINK_DISTANCE),
        });
      }
    }
  });

  return {
    circles,
    lines,
  };
}

export default function ParticleNetworkBackground({ interactionPoint = null }) {
  const { width, height } = useWindowDimensions();
  const count = useMemo(
    () => clamp(Math.round((width * height) / PARTICLE_AREA), MIN_PARTICLES, MAX_PARTICLES),
    [height, width]
  );
  const particlesRef = useRef([]);
  const interactionRef = useRef(interactionPoint);
  const frameRef = useRef(null);
  const lastRenderRef = useRef(0);
  const [scene, setScene] = useState({ circles: [], lines: [] });

  useEffect(() => {
    interactionRef.current = interactionPoint;
  }, [interactionPoint]);

  useEffect(() => {
    if (!width || !height) return undefined;

    particlesRef.current = createParticles(width, height, count);
    setScene(buildScene(particlesRef.current, { x: -1000, y: -1000 }));

    return undefined;
  }, [count, height, width]);

  useEffect(() => {
    if (!width || !height || !particlesRef.current.length) return undefined;

    let mounted = true;

    const animate = (timestamp) => {
      if (!mounted) return;

      frameRef.current = requestAnimationFrame(animate);

      if (timestamp - lastRenderRef.current < FRAME_INTERVAL) {
        return;
      }

      lastRenderRef.current = timestamp;

      const liveInteraction = interactionRef.current;
      const fallbackTarget = {
        x: width * 0.5 + Math.sin(timestamp / 2600) * width * 0.22,
        y: height * 0.5 + Math.cos(timestamp / 3400) * height * 0.18,
      };
      const target = liveInteraction?.active ? liveInteraction : fallbackTarget;

      setScene(buildScene(particlesRef.current, target));
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [count, height, width]);

  return (
    <View pointerEvents="none" style={styles.root}>
      <Svg height={height} width={width}>
        {scene.lines.map((line, index) => (
          <Line
            key={`line-${index}`}
            stroke={`rgba(255, 255, 255, ${line.opacity})`}
            strokeWidth={1.5}
            x1={line.x1}
            x2={line.x2}
            y1={line.y1}
            y2={line.y2}
          />
        ))}
        {scene.circles.map((circle, index) => (
          <Circle
            key={`circle-${index}`}
            cx={circle.x}
            cy={circle.y}
            fill={`rgba(255, 255, 255, ${circle.opacity})`}
            r={circle.radius}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
});
