import "./globals.css";

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
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
