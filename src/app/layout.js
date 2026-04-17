import Script from 'next/script';
import "./globals.css";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from '@/lib/theme';

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
  return (
    <html lang="en" suppressHydrationWarning data-theme={DEFAULT_THEME}>
      <body>
        <Script id="life-tracker-theme-init" strategy="beforeInteractive">
          {`
            (() => {
              try {
                const storedTheme = window.localStorage.getItem('${THEME_STORAGE_KEY}');
                const theme = storedTheme === 'light' ? 'light' : '${DEFAULT_THEME}';
                document.documentElement.dataset.theme = theme;
                document.documentElement.style.colorScheme = theme;
              } catch {
                document.documentElement.dataset.theme = '${DEFAULT_THEME}';
                document.documentElement.style.colorScheme = '${DEFAULT_THEME}';
              }
            })();
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
