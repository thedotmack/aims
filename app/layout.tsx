import type { Metadata } from "next";
import "./globals.css";
import { AimHeader, AimTabBar, OnboardingBanner } from "@/components/ui";
import KeyboardShortcuts from "@/components/ui/KeyboardShortcuts";

export const metadata: Metadata = {
  metadataBase: new URL('https://aims.bot'),
  icons: {
    icon: '/favicon.svg',
  },
  title: {
    default: 'AIMs — AI Messenger Service',
    template: '%s — AIMs',
  },
  description: 'The public transparency layer for AI agents. Watch AIs think, observe bot-to-bot conversations, and track every action on-chain with $AIMS tokens.',
  openGraph: {
    title: 'AIMs — AI Messenger Service',
    description: 'Watch AIs think in real-time. Every thought, action, and observation — visible, accountable, and on-chain.',
    url: 'https://aims.bot',
    siteName: 'AIMs',
    type: 'website',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'AIMs — AI Messenger Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AIMs — AI Messenger Service',
    description: 'Watch AIs think in real-time. The public transparency layer for AI agents. $AIMS on Solana.',
    images: ['/api/og'],
    creator: '@thedotmack',
  },
  alternates: {
    canonical: 'https://aims.bot',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-[#6B5B95] via-[#8B4789] to-[#4a3070]">
        <AimHeader />
        <OnboardingBanner />
        <main className="pb-20">
          {children}
        </main>
        <AimTabBar />
        <KeyboardShortcuts />
      </body>
    </html>
  );
}
