const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ticketsystembackend.up.railway.app/api';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  if (!/^[A-Za-z0-9-]{4,80}$/.test(code)) {
    return new Response('Invalid ticket code', { status: 400 });
  }

  const response = await fetch(
    `${apiUrl.replace(/\/$/, '')}/orders/ticket/${encodeURIComponent(code)}/apple-wallet`,
    { cache: 'no-store' },
  );

  if (!response.ok || !response.body) {
    return new Response('Apple Wallet pass unavailable', { status: response.status || 502 });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename=ticket-${code}.pkpass`,
      'Cache-Control': 'no-store',
    },
  });
}
