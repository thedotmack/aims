# Bundle Size Analysis — Feb 19, 2026

## Setup

```bash
# Visualize bundle with interactive treemap
npm run analyze

# Regular build with size output
npm run build
```

The `@next/bundle-analyzer` is integrated via `next.config.ts` and activated with `ANALYZE=true`.

## Findings (Refinement Cycle 29)

### Total Client JS: ~1.4MB across 45 chunks

### Largest Chunks

| Chunk | Size | Contents | Optimization |
|-------|------|----------|-------------|
| Framework runtime | 220KB | React, Next.js core, router | Not optimizable (required) |
| react-markdown + micromark | 140KB + 80KB | Markdown rendering (remark-gfm) | ✅ Lazy-loaded via `React.lazy()` in AimFeedItem |
| Next.js Image | 124KB | `next/image` optimization | Not optimizable (framework) |
| App shell | 112KB | Layout, routing, shared UI | Not optimizable (shared) |

### Optimizations Applied

1. **MarkdownContent lazy loading** — `react-markdown` (232KB chunk) split into lazy-loaded chunks via `React.lazy()` + `Suspense` in `AimFeedItem.tsx`. Initial page load no longer blocks on markdown parser.

2. **Bot profile dynamic imports** — 7 below-the-fold analytics components converted to `next/dynamic`:
   - ActivityHeatmap, ThoughtActionAnalysisView, PersonalityProfile, TransparencyMeter
   - BehaviorAnalysis, ConsistencyScoreView, SimilarBots
   - These are only loaded when the bot profile page is visited, not eagerly bundled.

3. **Explore page dynamic imports** — NetworkGraph and NetworkAnalytics lazy-loaded via `next/dynamic`.

### What's Already Good

- **Server-only deps stay server-side**: `@neondatabase/serverless`, `@solana/web3.js`, `resend`, `@upstash/*` are only imported in API routes and `lib/` modules — never in client components.
- **Next.js automatic code splitting**: Each page route gets its own chunk. No single mega-bundle.
- **No unnecessary large client deps**: No moment.js, lodash, or similar bloat.

### What Remains (Future Optimization)

- `react-markdown` + `remark-gfm` + `micromark` (~220KB total) is the largest client dependency. If bundle size becomes critical, consider replacing with a lighter markdown renderer (e.g., `marked` at ~30KB) or server-rendering markdown.
- Consider ISR for static pages (`/about`, `/terms`, `/privacy`) to eliminate their JS entirely.
- Monitor with `npm run analyze` or Lighthouse CI budgets (configured in `lighthouserc.js`).
