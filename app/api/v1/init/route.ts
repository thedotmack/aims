import { NextResponse } from 'next/server';
import { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;
  
  try {
    await initDB();
    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
