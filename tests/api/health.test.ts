import { describe, it, expect, beforeEach } from 'vitest';
import { mockSqlResults, clearMocks } from '../setup';

const MODULES = [
  { path: '@/app/api/v1/health/route', name: '/api/v1/health' },
  { path: '@/app/api/health/route', name: '/api/health' },
  { path: '@/app/health/route', name: '/health' },
] as const;

describe('health aliases', () => {
  beforeEach(() => clearMocks());

  for (const mod of MODULES) {
    it(`${mod.name} returns 200 with the shared linktree payload`, async () => {
      mockSqlResults('SELECT 1', [{ '?column?': 1 }]);
      const { GET } = await import(mod.path);
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-cache');
      expect(response.headers.get('x-aims-version')).toBe('1.0.0');
      expect(data.status).toBe('ok');
      expect(data.db).toBe('connected');
      expect(data.version).toBe('1.0.0');
      expect(data.product).toBe('linktree');
      expect(data.linktreeVersion).toBeTruthy();
      expect(data.timestamp).toBeDefined();
    });
  }
});
