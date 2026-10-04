import { HiOutlineChartBar, HiOutlineCalendar, HiOutlineUsers, HiOutlineTag, HiOutlineSpeakerphone, HiOutlineTrendingUp, HiOutlineDocumentText, HiOutlineUserAdd } from 'react-icons/hi';

export const adminNavigation = [
  { href: '/admin', es: 'Resumen', en: 'Overview', group: 'overview', icon: HiOutlineChartBar, descriptionEs: 'Actividad y resumen financiero de la plataforma.', descriptionEn: 'Platform activity and financial overview.' },
  { href: '/admin/events', es: 'Eventos', en: 'Events', group: 'events', icon: HiOutlineCalendar, descriptionEs: 'Revisa publicaciones, solicitudes y detalles de cada evento.', descriptionEn: 'Review publications, requests and event details.' },
  { href: '/admin/events/create', es: 'Crear evento', en: 'Create event', group: 'events', icon: HiOutlineUserAdd, descriptionEs: 'Selecciona el organizador y prepara un nuevo evento.', descriptionEn: 'Select an organizer and prepare a new event.' },
  { href: '/admin/scanner-access', es: 'Personal y accesos', en: 'Staff and access', group: 'events', icon: HiOutlineUsers, descriptionEs: 'Gestiona el personal de acceso de los eventos.', descriptionEn: 'Manage event entrance staff.' },
  { href: '/admin/categories', es: 'Categorías', en: 'Categories', group: 'events', icon: HiOutlineTag, descriptionEs: 'Organiza las categorías del catálogo público.', descriptionEn: 'Organize public catalog categories.' },
  { href: '/admin/users', es: 'Usuarios', en: 'Users', group: 'people', icon: HiOutlineUsers, descriptionEs: 'Consulta cuentas y herramientas de atención al usuario.', descriptionEn: 'Review accounts and user support tools.' },
  { href: '/admin/special-codes', es: 'Códigos especiales', en: 'Special codes', group: 'people', icon: HiOutlineTag, descriptionEs: 'Consulta y administra los códigos existentes.', descriptionEn: 'Review and manage existing codes.' },
  { href: '/admin/analytics', es: 'Analíticas', en: 'Analytics', group: 'finance', icon: HiOutlineTrendingUp, descriptionEs: 'Consulta visitas, actividad y estadísticas.', descriptionEn: 'Review visits, activity and statistics.' },
  { href: '/admin/invoices', es: 'Facturas', en: 'Invoices', group: 'finance', icon: HiOutlineDocumentText, descriptionEs: 'Consulta facturas y accede a la facturación manual.', descriptionEn: 'Review invoices and access manual invoicing.' },
  { href: '/admin/marketing', es: 'Marketing', en: 'Marketing', group: 'content', icon: HiOutlineSpeakerphone, descriptionEs: 'Prepara campañas y administra banners.', descriptionEn: 'Prepare campaigns and manage banners.' },
] as const;

export const adminGroups = [
  { id: 'overview', es: 'Plataforma', en: 'Platform' },
  { id: 'events', es: 'Eventos y acceso', en: 'Events and access' },
  { id: 'people', es: 'Usuarios y códigos', en: 'Users and codes' },
  { id: 'finance', es: 'Informes y facturación', en: 'Reports and invoicing' },
  { id: 'content', es: 'Comunicación', en: 'Communication' },
] as const;

export function getAdminSection(pathname: string) {
  // Prefer the most specific route: creating an event belongs to Create event.
  return [...adminNavigation].sort((a, b) => b.href.length - a.href.length)
    .find(item => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))) || adminNavigation[0];
}
