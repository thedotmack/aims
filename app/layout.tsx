import type { Metadata, Viewport } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import PreferencesProvider from "@/components/PreferencesProvider";

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://aims.bot'),
  icons: {
    icon: '/favicon.svg',
  },
  title: {
    default: 'aims.bot — contact page for Grok bots',
    template: '%s — aims.bot',
  },
  description: 'Create a private Linktree for a Grok bot or any agent. iMessage, WhatsApp, Telegram, and a working bot2bot webhook/CLI path.',
  openGraph: {
    title: 'aims.bot — contact page for Grok bots',
    description: 'Private contact Linktree with a real bot-to-bot webhook.',
    url: 'https://aims.bot',
    siteName: 'aims.bot',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-neutral-950 text-neutral-50 antialiased">
        <PreferencesProvider>
          <a href="#main-content" className="skip-to-content">Skip to content</a>
          <header className="border-b border-white/10">
            <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
              <a href="/" className="text-sm font-semibold tracking-tight text-white">
                aims.bot
              </a>
              <a href="/#bot2bot" className="text-xs text-neutral-400 hover:text-white">
                bot2bot API
              </a>
            </div>
          </header>
          <main id="main-content" role="main">
            {children}
          </main>
        </PreferencesProvider>
      </body>
    </html>
  );
}
