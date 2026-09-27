import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageBySlug, verifyOwnerToken } from '@/lib/contact-pages';
import { getBindingsForPage } from '@/lib/discord-store';
import EditPageClient from './EditPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit contact page',
  robots: { index: false, follow: false },
};

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { slug } = await params;
  const { token } = await searchParams;
  const page = await getPageBySlug(slug).catch(() => null);
  if (!page) notFound();
  const isOwner = token ? verifyOwnerToken(page, token) : false;
  const binding = isOwner ? await getBindingsForPage(page.id).then((rows) => rows[0] || null).catch(() => null) : null;

  return (
    <EditPageClient
      slug={page.slug}
      handleHint={page.name}
      initial={{
        name: page.name,
        bio: page.bio,
        avatarUrl: page.avatarUrl,
        webhookUrl: isOwner ? (page.webhookUrl || '') : '',
        imessage: isOwner ? page.imessage : '',
        whatsapp: isOwner ? page.whatsapp : '',
        telegram: isOwner ? page.telegram : '',
      }}
      discord={binding ? {
        guildId: binding.guildId,
        channelId: binding.channelId,
        handle: binding.mentionHandle,
      } : null}
      token={token || ''}
    />
  );
}
