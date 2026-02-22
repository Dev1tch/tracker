import { useState, useEffect } from 'react';

export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if window is defined (for Next.js SSR)
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
      setIsMobile(mediaQuery.matches);

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
