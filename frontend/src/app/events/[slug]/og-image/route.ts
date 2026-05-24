const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ticketsystembackend.up.railway.app/api';

export const runtime = 'nodejs';
export const revalidate = 86400;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const response = await fetch(
    `${apiUrl.replace(/\/$/, '')}/events/${encodeURIComponent(slug)}/og-image?kind=image`,
    { cache: 'no-store' },
  );

  if (!response.ok) {
    return new Response('Event image not found', { status: 404 });
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Content-Length': String(buffer.byteLength),
    },
  });
}
