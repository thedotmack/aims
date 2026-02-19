import { describe, it, expect, beforeEach } from 'vitest';
import { mockSqlResults, clearMocks } from '../setup';

describe('GET /api/v1/health', () => {
  beforeEach(() => clearMocks());

  it('returns 200 with ok status when DB is connected', async () => {
    mockSqlResults('SELECT 1', [{ '?column?': 1 }]);
    
    const { GET } = await import('@/app/api/v1/health/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.db).toBe('connected');
    expect(data.version).toBe('1.0.0');
    expect(data.timestamp).toBeDefined();
  });
});
