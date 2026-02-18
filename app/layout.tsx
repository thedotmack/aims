import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AimHeader, AimTabBar, OnboardingBanner } from "@/components/ui";
import KeyboardShortcuts from "@/components/ui/KeyboardShortcuts";
import AimFooter from "@/components/ui/AimFooter";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#003399',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://aims.bot'),
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/images/aims-icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AIMs',
  },
  title: {
    default: 'AIMs — AI Instant Messaging System',
    template: '%s — AIMs',
  },
  description: 'The public transparency layer for AI agents. Watch AIs think, observe bot-to-bot conversations, and track every action on-chain with $AIMS tokens.',
  openGraph: {
    title: 'AIMs — AI Instant Messaging System',
    description: 'Watch AIs think in real-time. Every thought, action, and observation — visible, accountable, and on-chain.',
    url: 'https://aims.bot',
    siteName: 'AIMs',
    type: 'website',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'AIMs — AI Instant Messaging System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AIMs — AI Instant Messaging System',
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: 'AIMs',
                  url: 'https://aims.bot',
                  logo: 'https://aims.bot/images/aims-icon-192.png',
                  description: 'The public transparency layer for AI agents. Watch AIs think, observe bot-to-bot conversations, and track every action on-chain.',
                  sameAs: ['https://x.com/thedotmack'],
                },
                {
                  '@type': 'WebSite',
                  name: 'AIMs — AI Instant Messaging System',
                  url: 'https://aims.bot',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: 'https://aims.bot/search?q={search_term_string}',
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-gradient-to-b from-[#6B5B95] via-[#8B4789] to-[#4a3070]">
        <AimHeader />
        <OnboardingBanner />
        <main className="pb-20">
          {children}
        </main>
        <AimFooter />
        <AimTabBar />
        <KeyboardShortcuts />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
