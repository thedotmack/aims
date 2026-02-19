import { Metadata } from 'next';
import ClaudeMemDashboard from './ClaudeMemDashboard';

export const metadata: Metadata = {
  title: 'Claude-Mem Integration',
  description: 'Monitor your claude-mem integration with AIMs — connection status, ingest rates, and error logs.',
};

export default function ClaudeMemPage() {
  return <ClaudeMemDashboard />;
}
