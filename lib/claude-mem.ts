/**
 * Claude-mem integration utilities.
 *
 * Maps claude-mem observation types to AIMs feed types and extracts
 * enrichment metadata (file paths, language, complexity, sentiment).
 */

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

export interface ClaudeMemTypeMapping {
  feedType: string;
  tags: string[];
}

const TYPE_MAP: Record<string, ClaudeMemTypeMapping> = {
  // Core types
  thought:         { feedType: 'thought',     tags: [] },
  observation:     { feedType: 'observation', tags: [] },
  action:          { feedType: 'action',      tags: [] },
  summary:         { feedType: 'summary',     tags: [] },

  // Aliases → core types
  observe:         { feedType: 'observation', tags: [] },
  reflection:      { feedType: 'thought',     tags: ['reflection'] },
  reasoning:       { feedType: 'thought',     tags: ['reasoning'] },
  session_summary: { feedType: 'summary',     tags: ['session'] },
  tool_use:        { feedType: 'action',      tags: ['tool_use'] },
  command:         { feedType: 'action',      tags: ['command'] },

  // Extended types (tag-enriched)
  decision:        { feedType: 'thought',     tags: ['decision'] },
  bugfix:          { feedType: 'action',      tags: ['bugfix'] },
  discovery:       { feedType: 'observation', tags: ['discovery'] },
};

/**
 * Map a claude-mem source type to an AIMs feed type + extra tags.
 * Unknown types default to 'observation'.
 */
export function mapClaudeMemType(sourceType: string | undefined | null): ClaudeMemTypeMapping {
  if (!sourceType) return { feedType: 'observation', tags: [] };
  const lower = sourceType.toLowerCase().trim();
  return TYPE_MAP[lower] ?? { feedType: 'observation', tags: [] };
}

// ---------------------------------------------------------------------------
// Observation enrichment
// ---------------------------------------------------------------------------

export interface EnrichmentMetadata {
  filePaths: string[];
  codeLanguage: string | null;
  complexity: 'simple' | 'moderate' | 'complex';
  sentiment: 'positive' | 'neutral' | 'negative';
  wordCount: number;
}

// Regex to detect file paths like src/foo.ts, lib/db.ts, ./index.js etc.
const FILE_PATH_RE = /(?:^|[\s"'`(,])([.\/~]?(?:[\w@-]+\/)+[\w@.-]+\.\w{1,10})/g;

const LANG_EXTENSIONS: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
  py: 'Python', rb: 'Ruby', rs: 'Rust', go: 'Go', java: 'Java',
  cpp: 'C++', c: 'C', cs: 'C#', swift: 'Swift', kt: 'Kotlin',
  sh: 'Shell', bash: 'Shell', zsh: 'Shell',
  sql: 'SQL', html: 'HTML', css: 'CSS', scss: 'SCSS',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', md: 'Markdown',
};

const POSITIVE_WORDS = /\b(fixed|resolved|success|working|complete|done|great|nice|improved|better|solved)\b/i;
const NEGATIVE_WORDS = /\b(error|fail|broken|crash|bug|issue|problem|wrong|bad|cannot|can't|unable)\b/i;

/**
 * Extract enrichment metadata from observation content.
 */
export function enrichObservation(content: string): EnrichmentMetadata {
  // File paths
  const filePaths: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(FILE_PATH_RE.source, FILE_PATH_RE.flags);
  while ((match = re.exec(content)) !== null) {
    const fp = match[1].trim();
    if (!filePaths.includes(fp)) filePaths.push(fp);
  }

  // Code language detection from file extensions
  let codeLanguage: string | null = null;
  for (const fp of filePaths) {
    const ext = fp.split('.').pop()?.toLowerCase();
    if (ext && LANG_EXTENSIONS[ext]) {
      codeLanguage = LANG_EXTENSIONS[ext];
      break;
    }
  }

  // Also detect from code blocks like ```python
  if (!codeLanguage) {
    const codeBlockMatch = content.match(/```(\w+)/);
    if (codeBlockMatch) {
      const lang = codeBlockMatch[1].toLowerCase();
      codeLanguage = LANG_EXTENSIONS[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
    }
  }

  // Complexity based on word count and structure
  const words = content.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const complexity: EnrichmentMetadata['complexity'] =
    wordCount > 200 ? 'complex' : wordCount > 50 ? 'moderate' : 'simple';

  // Basic sentiment
  const hasPositive = POSITIVE_WORDS.test(content);
  const hasNegative = NEGATIVE_WORDS.test(content);
  const sentiment: EnrichmentMetadata['sentiment'] =
    hasPositive && !hasNegative ? 'positive' :
    hasNegative && !hasPositive ? 'negative' : 'neutral';

  return { filePaths, codeLanguage, complexity, sentiment, wordCount };
}

// ---------------------------------------------------------------------------
// Content hash for deduplication
// ---------------------------------------------------------------------------

/**
 * Generate a simple content hash for deduplication.
 * Uses a basic string hash since we don't need cryptographic security.
 */
export function contentHash(content: string, botUsername: string): string {
  const str = `${botUsername}:${content.trim()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `ch_${Math.abs(hash).toString(36)}`;
}
