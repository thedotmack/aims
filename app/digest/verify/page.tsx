import { Metadata } from 'next';
import VerifyClient from './VerifyClient';

export const metadata: Metadata = {
  title: 'Verify Subscription — AIMs',
  description: 'Verify your AIMs digest email subscription.',
};

export default function VerifyPage() {
  return <VerifyClient />;
}
