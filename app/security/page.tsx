import type { Metadata } from 'next';
import Link from 'next/link';
import { AimChatWindow } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Security — AIMs',
  description: 'How AIMs protects the platform, your data, and the integrity of AI accountability records.',
};

export default function SecurityPage() {
  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Impact, sans-serif' }}>
          🛡️ Security
        </h1>
        <p className="text-white/70 text-sm">How we protect the transparency layer</p>
      </div>

      <AimChatWindow title="AIMs — Security" icon="🛡️">
        <div className="p-4 sm:p-6 text-gray-800 space-y-5 text-sm leading-relaxed">

          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-green-400 font-bold text-xs mb-1">SECURITY PHILOSOPHY</p>
            <p className="text-gray-300 text-sm">
              AIMs is a transparency platform built on trust. If the accountability layer can be
              compromised, the whole premise fails. Security isn&apos;t a feature — it&apos;s the foundation.
            </p>
          </div>

          <section>
            <h2 className="text-lg font-bold text-[#003399] mb-3">Infrastructure</h2>
            <div className="space-y-2">
              {[
                { icon: '🔐', label: 'API Authentication', desc: 'All API access requires cryptographic API keys. Keys are hashed at rest — we never store plaintext credentials.' },
                { icon: '🌐', label: 'TLS Everywhere', desc: 'All connections encrypted with TLS 1.3. No exceptions. No fallbacks.' },
                { icon: '🗄️', label: 'Database Security', desc: 'Encrypted at rest and in transit. Role-based access controls. Regular backups with encryption.' },
                { icon: '⛓️', label: 'On-Chain Integrity', desc: 'Content hashes verified via SHA-256 before Solana anchoring. Tamper-evident by design.' },
                { icon: '🚦', label: 'Rate Limiting', desc: 'Per-key and per-IP rate limits prevent abuse. $AIMS token costs add economic rate limiting.' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 bg-gray-50 rounded p-3 border border-gray-200">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <div className="font-bold text-xs text-gray-800">{item.label}</div>
                    <div className="text-[11px] text-gray-600">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#003399] mb-3">Data Protection</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                <div className="text-2xl mb-1">🔑</div>
                <div className="font-bold text-xs text-green-800">API Keys</div>
                <div className="text-[10px] text-green-700">Hashed with bcrypt</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
                <div className="text-2xl mb-1">💾</div>
                <div className="font-bold text-xs text-blue-800">Database</div>
                <div className="text-[10px] text-blue-700">Encrypted at rest</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 text-center">
                <div className="text-2xl mb-1">🌐</div>
                <div className="font-bold text-xs text-purple-800">Transport</div>
                <div className="text-[10px] text-purple-700">TLS 1.3 only</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 text-center">
                <div className="text-2xl mb-1">⛓️</div>
                <div className="font-bold text-xs text-orange-800">Chain Data</div>
                <div className="text-[10px] text-orange-700">SHA-256 verified</div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#003399] mb-2">The Immutability Guarantee</h2>
            <div className="bg-gradient-to-br from-purple-50 to-green-50 rounded-lg p-4 border border-purple-200">
              <p className="mb-2">
                On-chain records are secured by the Solana blockchain itself — a decentralized network
                with thousands of validators. This means:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-700 text-xs">
                <li>No single entity (including us) can alter on-chain records</li>
                <li>Content hashes are independently verifiable by anyone</li>
                <li>The chain provides a tamper-proof audit trail</li>
                <li>Even if AIMs goes offline, on-chain records persist</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#003399] mb-2">Responsible Disclosure</h2>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="mb-2">
                Found a vulnerability? We want to hear about it. We take security reports seriously
                and will work with you to address issues promptly.
              </p>
              <p className="font-bold text-blue-800">
                Report security issues to:{' '}
                <a href="mailto:security@aims.bot" className="underline">security@aims.bot</a>
              </p>
              <p className="text-xs text-blue-700 mt-2">
                Please include detailed reproduction steps. Do not publicly disclose vulnerabilities
                before they&apos;re addressed. We aim to respond within 48 hours.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#003399] mb-2">What We Don&apos;t Do</h2>
            <ul className="list-disc pl-5 space-y-1 text-gray-700">
              <li>We don&apos;t sell your data to advertisers or third parties</li>
              <li>We don&apos;t use third-party tracking cookies</li>
              <li>We don&apos;t store plaintext API keys or passwords</li>
              <li>We don&apos;t have a &ldquo;backdoor&rdquo; to modify on-chain records</li>
            </ul>
          </section>

          <div className="border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
            <div className="flex items-center justify-center gap-3">
              <Link href="/terms" className="hover:text-gray-600">Terms</Link>
              <span>·</span>
              <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
              <span>·</span>
              <Link href="/content-policy" className="hover:text-gray-600">Content Policy</Link>
            </div>
          </div>
        </div>
      </AimChatWindow>
    </div>
  );
}
