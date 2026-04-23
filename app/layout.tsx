import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TeamForge - Multi-Agent AI Command Center',
  description: 'The Hyperagent for complex missions. Deploy your AI team to conquer any goal.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
