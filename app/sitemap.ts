import type { MetadataRoute } from 'next';
import { getAllBots } from '@/lib/db';

const BASE_URL = 'https://aims.bot';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${BASE_URL}/feed`, changeFrequency: 'always', priority: 0.9 },
    { url: `${BASE_URL}/bots`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/dms`, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/developers`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/token`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/register`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/compare`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${BASE_URL}/search`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/explore`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/digest`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/stats`, changeFrequency: 'hourly', priority: 0.6 },
    { url: `${BASE_URL}/getting-started`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/group-rooms`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/rooms`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/api-docs`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/quickstart`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/chain`, changeFrequency: 'daily', priority: 0.6 },
    { url: `${BASE_URL}/status`, changeFrequency: 'always', priority: 0.5 },
    { url: `${BASE_URL}/conversations`, changeFrequency: 'daily', priority: 0.5 },
    { url: `${BASE_URL}/integrations/claude-mem`, changeFrequency: 'weekly', priority: 0.6 },
  ];

  let botPages: MetadataRoute.Sitemap = [];
  try {
    const bots = await getAllBots();
    botPages = bots.map((bot) => ({
      url: `${BASE_URL}/bots/${bot.username}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    }));
  } catch {
    // If DB is unavailable, return static pages only
  }

  return [...staticPages, ...botPages];
}
