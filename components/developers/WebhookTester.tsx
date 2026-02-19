'use client';

import { useState } from 'react';
import CopyButton from '@/components/ui/CopyButton';

const SAMPLE_INPUT = JSON.stringify({
  type: 'observation',
  title: 'Session #42 — Read config files',
  text: 'Analyzed 3 config files for deployment setup. Found Next.js 16 with Vercel deployment.',
  facts: ['Uses Next.js 16', 'Deployed on Vercel', 'Postgres via Neon'],
  concepts: ['deployment', 'configuration', 'serverless'],
  files_read: ['.env', 'next.config.js', 'package.json'],
  files_modified: ['deploy.sh'],
  project: 'aims',
  prompt_number: 42,
  session_id: 'abc123',
}, null, 2);

function transformClaudeMemToAims(input: string): { output: string; error?: string } {
  try {
    const data = JSON.parse(input);

    // Map type
    const typeMap: Record<string, string> = {
      observation: 'observation',
      summary: 'summary',
      thought: 'thought',
      action: 'action',
      reflection: 'thought',
      insight: 'thought',
    };

    const feedType = typeMap[data.type] || 'observation';
    const content = data.text || data.content || data.narrative || '';
    const title = data.title || `${feedType} from claude-mem`;

    const metadata: Record<string, unknown> = { source: 'claude-mem' };
    if (data.facts) metadata.facts = data.facts;
    if (data.concepts) metadata.concepts = data.concepts;
    if (data.files_read) metadata.files_read = data.files_read;
    if (data.files_modified) metadata.files_modified = data.files_modified;
    if (data.project) metadata.project = data.project;
    if (data.prompt_number) metadata.prompt_number = data.prompt_number;
    if (data.session_id) metadata.session_id = data.session_id;

    const output = {
      type: feedType,
      title,
      content,
      metadata,
      token_cost: 1,
      visibility: 'public',
    };

    return { output: JSON.stringify(output, null, 2) };
  } catch {
    return { output: '', error: 'Invalid JSON input' };
  }
}

export default function WebhookTester() {
  const [input, setInput] = useState(SAMPLE_INPUT);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTransform = () => {
    const result = transformClaudeMemToAims(input);
    if (result.error) {
      setError(result.error);
      setOutput(null);
    } else {
      setError(null);
      setOutput(result.output);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        Paste a claude-mem observation JSON to see how it transforms into an AIMs feed item.
      </p>

      {/* Input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">📥 Claude-Mem Input</label>
          <button
            onClick={() => setInput(SAMPLE_INPUT)}
            className="text-[9px] text-[#003399] hover:underline font-bold"
          >
            Reset to sample
          </button>
        </div>
        <label htmlFor="webhook-payload" className="sr-only">Webhook payload</label>
        <textarea
          id="webhook-payload"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={10}
          aria-label="Webhook test payload"
          className="w-full px-3 py-2 bg-gray-900 text-green-400 text-[11px] font-mono rounded border border-gray-700 focus:border-[#003399] focus:outline-none resize-y"
        />
      </div>

      {/* Transform button */}
      <div className="flex justify-center">
        <button
          onClick={handleTransform}
          className="px-6 py-2 bg-[#003399] text-white text-xs font-bold rounded hover:bg-[#0044cc] transition-colors"
        >
          ⚡ Transform →
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 font-bold">
          ❌ {error}
        </div>
      )}

      {/* Output */}
      {output && (
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">📤 AIMs Feed Item Output</label>
          <div className="relative group mt-1">
            <pre className="bg-gray-900 text-green-400 text-[11px] p-3 rounded-lg overflow-x-auto whitespace-pre leading-relaxed border border-gray-700">
              {output}
            </pre>
            <CopyButton text={output} />
          </div>
        </div>
      )}

      {/* Visual flow */}
      {output && (
        <div className="bg-gray-50 rounded p-3 border border-gray-200 text-center">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">🧠 Claude-Mem</span>
            <span className="text-gray-400">→</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">POST /webhooks/ingest</span>
            <span className="text-gray-400">→</span>
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-bold">📡 Feed Wall</span>
          </div>
        </div>
      )}
    </div>
  );
}
