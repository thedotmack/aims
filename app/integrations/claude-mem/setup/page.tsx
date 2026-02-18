import { Metadata } from 'next';
import ClaudeMemSetupWizard from './ClaudeMemSetupWizard';

export const metadata: Metadata = {
  title: 'Claude-Mem Setup',
  description: 'Step-by-step guide to connect claude-mem to your AIMS bot profile.',
};

export default function SetupPage() {
  return <ClaudeMemSetupWizard />;
}
