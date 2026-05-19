import Script from 'next/script';
import "./globals.css";
import {
  CUSTOM_COLORS_STORAGE_KEY,
  DEFAULT_CUSTOM_COLORS,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
} from '@/lib/theme';

export const metadata = {
  title: "Life tracker",
  description: "Your personal habit and life progress tracker",
  verification: {
    google: "3lobb799ejtVo-p9KoxhJNcyJ_LBBrMIyzNvH8rPUzk",
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  }
};

export default function RootLayout({ children }) {
  const initScript = `
    (() => {
      const VALID = new Set(['dark', 'light', 'custom']);
      const DEFAULT_THEME = '${DEFAULT_THEME}';
      const THEME_KEY = '${THEME_STORAGE_KEY}';
      const CUSTOM_KEY = '${CUSTOM_COLORS_STORAGE_KEY}';
      const DEFAULT_CUSTOM = ${JSON.stringify(DEFAULT_CUSTOM_COLORS)};
      const root = document.documentElement;

      function isHex(v) { return typeof v === 'string' && /^#([0-9a-f]{6})$/i.test(v); }
      function hexToRgb(hex) {
        const v = hex.replace('#', '');
        return {
          r: parseInt(v.slice(0, 2), 16),
          g: parseInt(v.slice(2, 4), 16),
          b: parseInt(v.slice(4, 6), 16),
        };
      }
      function lum({ r, g, b }) {
        const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      }
      function applyCustom(colors) {
        const bg = isHex(colors.bg) ? colors.bg : DEFAULT_CUSTOM.bg;
        const fg = isHex(colors.fg) ? colors.fg : DEFAULT_CUSTOM.fg;
        const bgRgb = hexToRgb(bg);
        const fgRgb = hexToRgb(fg);
        const fgCsv = bgRgb && fgRgb.r + ', ' + fgRgb.g + ', ' + fgRgb.b;
        const fgC = fgRgb.r + ', ' + fgRgb.g + ', ' + fgRgb.b;
        const bgC = bgRgb.r + ', ' + bgRgb.g + ', ' + bgRgb.b;
        const fa = (a) => 'rgba(' + fgC + ', ' + a + ')';
        const ba = (a) => 'rgba(' + bgC + ', ' + a + ')';
        const vars = {
          '--theme-rgb': fgC,
          '--shadow-rgb': bgC,
          '--bg-color': bg,
          '--text-primary': fg,
          '--text-secondary': fa(0.72),
          '--text-tertiary': fa(0.5),
          '--text-muted': fa(0.34),
          '--border-color': fa(0.45),
          '--border-color-dim': fa(0.22),
          '--glow-color': fa(0.4),
          '--panel-solid': ba(0.94),
          '--panel-translucent': ba(0.78),
          '--panel-translucent-strong': ba(0.96),
          '--header-gradient': 'linear-gradient(180deg, ' + ba(0.96) + ' 0%, ' + ba(0.62) + ' 72%, ' + ba(0) + ' 100%)',
          '--nav-gradient': 'linear-gradient(0deg, ' + ba(0.98) + ' 0%, ' + ba(0.84) + ' 100%)',
          '--panel-gradient-right': 'linear-gradient(90deg, transparent 0%, ' + ba(0.78) + ' 28%, ' + ba(0.96) + ' 100%)',
          '--panel-gradient-left': 'linear-gradient(270deg, transparent 0%, ' + ba(0.78) + ' 28%, ' + ba(0.96) + ' 100%)',
          '--surface-contrast': fg,
          '--surface-contrast-inverse': bg,
        };
        Object.keys(vars).forEach((k) => root.style.setProperty(k, vars[k]));
        root.style.colorScheme = lum(bgRgb) < 0.5 ? 'dark' : 'light';
      }

      try {
        const stored = window.localStorage.getItem(THEME_KEY);
        const theme = VALID.has(stored) ? stored : DEFAULT_THEME;
        root.dataset.theme = theme;
        if (theme === 'custom') {
          let colors = DEFAULT_CUSTOM;
          try {
            const raw = window.localStorage.getItem(CUSTOM_KEY);
            if (raw) colors = JSON.parse(raw) || DEFAULT_CUSTOM;
          } catch {}
          applyCustom(colors);
        } else {
          root.style.colorScheme = theme;
        }
      } catch {
        root.dataset.theme = DEFAULT_THEME;
        root.style.colorScheme = DEFAULT_THEME;
      }
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning data-theme={DEFAULT_THEME}>
      <body>
        <Script id="life-tracker-theme-init" strategy="beforeInteractive">
          {initScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
