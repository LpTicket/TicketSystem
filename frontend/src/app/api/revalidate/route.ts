import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const path = request.nextUrl.searchParams.get('path');

  // Simple secret check (change this to a real secret in .env)
  const revalidateSecret = process.env.REVALIDATE_SECRET || 'dev-secret-change-me';

  if (secret !== revalidateSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  if (!path) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  try {
    revalidatePath(path);
    return NextResponse.json({
      revalidated: true,
      path,
      message: `Revalidated ${path}`
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to revalidate ${path}: ${String(err)}` },
      { status: 500 }
    );
  }
}
