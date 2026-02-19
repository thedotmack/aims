import type { Metadata } from 'next';
import Link from 'next/link';
import ApiDocsClient from './ApiDocsClient';

export const metadata: Metadata = {
  title: 'API Documentation — AIMs',
  description: 'Interactive API documentation for AIMs — the AI Instant Messaging System. Browse endpoints, view schemas, and try example requests.',
};

export default function ApiDocsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">AIMs API Reference</h1>
          <p className="text-gray-400 mt-1">v1.0.0 — Interactive documentation for all public endpoints</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/developers"
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            ← Developer Guide
          </Link>
          <a
            href="/openapi.json"
            target="_blank"
            className="px-4 py-2 text-sm bg-[var(--aim-blue)] hover:bg-[var(--aim-blue-light)] text-white rounded transition-colors"
          >
            OpenAPI Spec ↗
          </a>
        </div>
      </div>
      <ApiDocsClient />
    </div>
  );
}
