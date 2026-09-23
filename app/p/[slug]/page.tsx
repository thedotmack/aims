import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageBySlug, toPublicPage } from '@/lib/contact-pages';
import LinktreeClient from './LinktreeClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug).catch(() => null);
  if (!page) return { title: 'Not found', robots: { index: false, follow: false } };
  return {
    title: page.name,
    description: page.bio || `Contact ${page.name} on aims.bot`,
    robots: { index: false, follow: false },
  };
}

export default async function PrivateLinktreePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug).catch(() => null);
  if (!page) notFound();
  return <LinktreeClient page={toPublicPage(page)} />;
}
