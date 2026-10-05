export type MapStatistic = { label: string; value: number; color: string };

/** Export a detached visual copy. The live map, camera and inventory are never changed. */
export async function exportVenueMapPdf(canvas: HTMLDivElement, options: {
  title: string;
  date: string;
  lang: string;
  statistics: MapStatistic[];
  background: string;
}) {
  await document.fonts.ready;
  const origin = canvas.getBoundingClientRect();
  const scale = origin.width / canvas.offsetWidth;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Map is not visible');
  const elements = Array.from(canvas.querySelectorAll<HTMLElement>('*'));
  const rectangles = elements.filter(node => !node.closest('[data-export-exclude]')).map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
  if (!rectangles.length) throw new Error('Empty map');
  // DOM bounds include rotated sections, chair offsets and labels outside section boxes.
  const left = (Math.min(...rectangles.map(r => r.left)) - origin.left) / scale - 28;
  const top = (Math.min(...rectangles.map(r => r.top)) - origin.top) / scale - 28;
  const width = Math.ceil((Math.max(...rectangles.map(r => r.right)) - origin.left) / scale - left + 28);
  const height = Math.ceil((Math.max(...rectangles.map(r => r.bottom)) - origin.top) / scale - top + 28);
  const copy = canvas.cloneNode(true) as HTMLDivElement;
  const copies = [copy, ...Array.from(copy.querySelectorAll<HTMLElement>('*'))];
  [canvas, ...elements].forEach((node, index) => {
    const style = getComputedStyle(node);
    for (const property of Array.from(style)) copies[index].style.setProperty(property, style.getPropertyValue(property));
    copies[index].style.setProperty('animation', 'none');
    copies[index].style.setProperty('transition', 'none');
  });
  copy.querySelectorAll('[data-export-exclude]').forEach(node => node.remove());
  // Avoid duplicate IDs and prevent the copy from receiving focus or pointer input.
  copies.forEach(node => { node.removeAttribute('id'); node.removeAttribute('tabindex'); });
  Object.assign(copy.style, { transform: 'none', left: `${-left}px`, top: `${-top}px` });
  const snapshot = document.createElement('div');
  Object.assign(snapshot.style, { position: 'relative', width: `${width}px`, height: `${height}px`, overflow: 'hidden', backgroundColor: options.background });
  snapshot.appendChild(copy);
  const host = document.createElement('div');
  host.inert = true;
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, { position: 'fixed', left: '-100000px', top: '0', pointerEvents: 'none' });
  host.appendChild(snapshot);
  document.body.appendChild(host);
  try {
    const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
    const mapImage = await toPng(snapshot, { width, height, pixelRatio: Math.min(3, 6500 / Math.max(width, height)), backgroundColor: options.background });
    const logo = new Image();
    logo.src = '/logo.png';
    await logo.decode();
    const doc = new jsPDF({ orientation: width > height ? 'landscape' : 'portrait', unit: 'mm', format: 'a3', compress: true });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setProperties({ title: `${options.title} - ${options.lang === 'es' ? 'Mapa del evento' : 'Event map'}`, author: 'LPTicket' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(19);
    const titleLines = doc.splitTextToSize(options.title, pageW - 102);
    const headerH = Math.max(40, titleLines.length * 8 + 22);
    doc.setFillColor('#0b2135');
    doc.rect(0, 0, pageW, headerH, 'F');
    doc.addImage(logo, 'PNG', 14, 12, 48, 48 * logo.naturalHeight / logo.naturalWidth);
    doc.setTextColor('#ffffff');
    doc.text(titleLines, 80, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor('#cbd5e1');
    doc.text(options.date, 80, 14 + titleLines.length * 8);
    const mapY = headerH + 8;
    const mapW = pageW - 28;
    const mapH = pageH - mapY - 53;
    if (mapH < 50) throw new Error('Event title is too long');
    const ratio = Math.min(mapW / width, mapH / height);
    const imageW = width * ratio;
    const imageH = height * ratio;
    doc.addImage(mapImage, 'PNG', (pageW - imageW) / 2, mapY + (mapH - imageH) / 2, imageW, imageH);
    const footerY = pageH - 42;
    const gap = 3;
    const cardW = (pageW - 28 - gap * (options.statistics.length - 1)) / options.statistics.length;
    options.statistics.forEach((stat, index) => {
      const x = 14 + index * (cardW + gap);
      doc.setFillColor('#f1f5f9');
      doc.roundedRect(x, footerY, cardW, 25, 2, 2, 'F');
      doc.setFillColor(stat.color);
      doc.roundedRect(x + 3, footerY + 4, 2, 17, .8, .8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor('#475569');
      doc.text(stat.label, x + 8, footerY + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor('#0f172a');
      doc.text(String(stat.value), x + 8, footerY + 19);
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#64748b');
    doc.text(options.lang === 'es' ? 'Mapa completo · Cifras al momento de exportar' : 'Complete map · Figures at export time', 14, pageH - 9);
    doc.text('LPTicket', pageW - 14, pageH - 9, { align: 'right' });
    const name = options.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 90) || 'evento';
    doc.save(`LPTicket-${name}-mapa.pdf`);
  } finally {
    host.remove();
  }
}
