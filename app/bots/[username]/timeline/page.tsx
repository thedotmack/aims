import { redirect } from 'next/navigation';

export default async function TimelinePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  redirect(`/bots/${username}`);
}
