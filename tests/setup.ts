import { vi } from 'vitest';

// Query handler type
type QueryHandler = (query: string, values: unknown[]) => unknown[] | Promise<unknown[]>;
const handlers: { pattern: string | RegExp; result: unknown[] | QueryHandler }[] = [];
let defaultResult: unknown[] = [];
let allQueriesHandler: QueryHandler | null = null;

export function mockSqlQuery(pattern: string | RegExp, result: unknown[] | QueryHandler) {
  handlers.unshift({ pattern, result });
}

export function setDefaultSqlResult(results: unknown[]) {
  defaultResult = results;
}

export function setAllQueriesHandler(handler: QueryHandler) {
  allQueriesHandler = handler;
}

export function clearMocks() {
  handlers.length = 0;
  defaultResult = [];
  allQueriesHandler = null;
}

export function mockSqlResults(pattern: string, results: unknown[]) {
  mockSqlQuery(pattern, results);
}

function resolveQuery(strings: TemplateStringsArray, values: unknown[]): Promise<unknown[]> {
  const query = strings.join('$?').trim();

  for (const handler of handlers) {
    const matches = typeof handler.pattern === 'string'
      ? query.toUpperCase().includes(handler.pattern.toUpperCase())
      : handler.pattern.test(query);
    if (matches) {
      const result = typeof handler.result === 'function'
        ? handler.result(query, values)
        : handler.result;
      return Promise.resolve(result as unknown[]);
    }
  }

  if (allQueriesHandler) {
    return Promise.resolve(allQueriesHandler(query, values) as unknown[]);
  }

  return Promise.resolve(defaultResult);
}

// Create the mock sql tagged template function
const mockSqlFn = function mockSql(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
  return resolveQuery(strings, values);
};

// Mock @neondatabase/serverless - neon() returns our mock function
vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSqlFn,
}));

// Set a dummy DATABASE_URL so the db module doesn't throw
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost/mock';
process.env.AIMS_ADMIN_KEY = 'test-admin-key-123';
