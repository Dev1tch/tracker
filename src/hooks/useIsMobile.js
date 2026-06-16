import { useState, useEffect } from 'react';

export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    // Check if window is defined (for Next.js SSR)
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

      const handleChange = (e) => {
        setIsMobile(e.matches);
      };

      // Add listener
      mediaQuery.addEventListener('change', handleChange);

      // Clean up
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
    
  }, [breakpoint]);

  return isMobile;
}
