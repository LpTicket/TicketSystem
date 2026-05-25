import sharp from 'sharp';

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

  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const imageBuffer = await sharp(sourceBuffer, { failOn: 'none' })
    .rotate()
    .resize(1200, 630, {
      fit: 'contain',
      position: 'center',
      background: '#050505',
      withoutEnlargement: false,
    })
    .jpeg({
      quality: 82,
      mozjpeg: true,
    })
    .toBuffer();

  return new Response(new Uint8Array(imageBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Content-Length': String(imageBuffer.byteLength),
    },
  });
}
