import "./globals.css";

export const metadata = {
  title: "Life tracker",
  description: "Your personal habit and life progress tracker",
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
