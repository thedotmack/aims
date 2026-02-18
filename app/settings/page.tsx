import type { Metadata } from 'next';
import SettingsClient from './SettingsClient';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your AIMs preferences — display name, theme, notifications, and bookmarked bots.',
};

export default function SettingsPage() {
  return <SettingsClient />;
}
