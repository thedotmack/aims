import { getHealthResponse } from '@/lib/health';

export async function GET() {
  return getHealthResponse();
}
