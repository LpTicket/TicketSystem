import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { apiDelete, apiGet, apiPatch, apiPost, getImageUrl } from '../services/api';
import { GradientButton } from '../components/GradientButton';
import { OrganizerDetailsMobile } from '../components/organizer/OrganizerEventForms';

export type Section = 'dashboard' | 'events' | 'users' | 'categories' | 'marketing' | 'analytics' | 'codes';
type AdminUser = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone?: string;
  address?: string;
  role: 'client' | 'organizer' | 'admin';
  suspended: boolean;
  avatarUrl?: string;
  createdAt?: string;
};
type Category = { id: string; name: string; labelEs: string; labelEn: string; slug: string; icon: string; color: string; sortOrder: number; imageData?: string; active: boolean; featured: boolean };

type AnalyticsSummary = {
  days: number;
  totalViews: number;
  uniqueVisitors: number;
  topEvents: { eventSlug: string; eventTitle?: string | null; views: number; visitors: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  daily: { date: string; views: number; visitors: number }[];
  recentViews: { id: string; path: string; eventSlug?: string | null; deviceType?: string | null; referrerHost?: string | null; createdAt: string }[];
};

type EventFinancial = {
  id: string;
  title: string;
  totalCharged: number;
  ticketSales: number;
  serviceFees: number;
  stripeFees: number;
  lpticketProfit: number;
  ticketsSold: number;
  orders: number;
};

type ApiSpecialCode = {
  id: string;
  code: string;
  ownerUserId: string;
  owner?: { firstName?: string; lastName?: string; email?: string };
  commissionFixed: number;
  isActive: boolean;
  eventId?: string | null;
  event?: { id: string; title: string } | null;
};

type CommissionEntry = {
  eventId?: string;
  eventTitle?: string;
  ownerUserId: string;
  ownerName?: string;
  ownerEmail?: string;
  totalTickets?: number;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  payouts?: { id: string; amount: number; note: string | null; paidAt: string }[];
};

type FeeConfig = {
  event: {
    id: string;
    serviceFeePercent: string;
    serviceFeeFixedPerTicket: string;
    processingFeePercent: string;
    processingFeeFixedPerTicket: string;
  };
  sections: {
    id: string;
    name: string;
    serviceFeePercent: string;
    serviceFeeFixedPerTicket: string;
    processingFeePercent: string;
    processingFeeFixedPerTicket: string;
  }[];
};

type PriceConfig = {
  event: { id: string; title: string };
  sections: {
    id: string;
    name: string;
    price: number | null;
    pendingPrice: number | null;
    priceStatus: string | null;
  }[];
};

type AdminOrder = {
  id: string;
  createdAt?: string;
  totalAmount?: number;
  paidAt?: string;
  status?: string;
  event?: { title?: string };
  user?: { firstName?: string; lastName?: string; email?: string };
};


type AdminStats = {
  totalUsers?: number;
  clients?: number;
  admins?: number;
  totalEvents?: number;
  publishedEvents?: number;
  draftEvents?: number;
  totalOrders?: number;
  paidOrders?: number;
  totalRevenue?: number;
  totalTickets?: number;
  ticketSales?: number;
  serviceFees?: number;
  stripeFees?: number;
  stripePercent?: number;
  stripeFixed?: number;
  lpticketProfit?: number;
};

const PRESET_ICONS = ['🎵','🎭','🎪','😂','⚽','🎤','🧒','🎫','🎬','🏟️','🎺','🥁','🎸','🎹','🎻','🏀','🎾','🏐','🚀','🌟'];
const PRESET_COLORS = ['#f97316','#8b5cf6','#ec4899','#eab308','#22c55e','#06b6d4','#3b82f6','#6b7280','#ef4444','#10b981','#f59e0b','#6366f1'];

function listFrom(payload: any) {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.events || payload?.users || payload?.categories || payload?.items || [];
}

function money(value: any) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatEventSlug(slug: string) {
  const parts = slug
    .split(/[/-]+/)
    .filter(Boolean)
    .filter((word, index, words) => {
      const isLast = index === words.length - 1;
      return !(isLast && /^[a-z0-9]{8,}$/i.test(word));
    });

  return parts
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function analyticsEventKey(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function analyticsEventImage(topEvent: AnalyticsSummary['topEvents'][number], events: any[]) {
  const titleKey = analyticsEventKey(topEvent.eventTitle || formatEventSlug(topEvent.eventSlug));
  const slugKey = analyticsEventKey(formatEventSlug(topEvent.eventSlug));
  const match = events.find((event) => {
    const eventTitle = analyticsEventKey(event?.title || event?.name);
    return eventTitle && (eventTitle === titleKey || eventTitle === slugKey);
  });
  return adminEventImage(match);
}

function fullName(user: any) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.name || user?.username || user?.email || 'Usuario';
}

function adminEventTitle(event: any) {
  return event?.title || 'Evento';
}

function adminEventVenue(event: any) {
  return event?.venueName || event?.venue || event?.venueAddress || 'Venue';
}

function adminEventDate(event: any) {
  const value = event?.eventDate || event?.date;
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function isAdminEventPast(event: any) {
  const value = event?.eventDate || event?.date;
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function adminEventTime(event: any) {
  const value = event?.eventDate || event?.date;
  const time = value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function sortAdminEventsBySchedule(a: any, b: any) {
  const aPast = isAdminEventPast(a);
  const bPast = isAdminEventPast(b);
  if (aPast !== bPast) return aPast ? 1 : -1;
  return adminEventTime(a) - adminEventTime(b);
}

function adminEventImage(event: any) {
  return getImageUrl(event?.imageUrl || event?.bannerImageUrl || event?.imageData || event?.mobileImageData);
}

function toAdminUser(user: any): AdminUser {
  return {
    id: String(user.id || user._id || user.email),
    name: fullName(user),
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || user.email?.split('@')[0] || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    role: user.role === 'admin' ? 'admin' : user.role === 'organizer' ? 'organizer' : 'client',
    suspended: user.isActive === false || user.suspended === true,
    avatarUrl: getImageUrl(user.avatarUrl || user.profileImageUrl || user.photoUrl || user.imageUrl),
    createdAt: user.createdAt,
  };
}

const sections: { id: Section; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'events', label: 'Eventos' },
  { id: 'users', label: 'Usuarios' },
  { id: 'categories', label: 'Categorias' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'analytics', label: 'Analiticas' },
  { id: 'codes', label: 'Codigos' },
];

type AdminProps = { section?: Section; onSectionChange?: (s: Section) => void };

export function AdminPanelScreen({ section, onSectionChange: _onSectionChange }: AdminProps = {}) {
  const { t } = useLanguage();
  const adminIndicatorX = useRef(new Animated.Value(0)).current;
  const adminIndicatorWidth = useRef(new Animated.Value(118)).current;
  const active: Section = section ?? 'dashboard';
  const [tabLayouts] = useState<Partial<Record<Section, { x: number; width: number }>>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [marketingBannerEnabled, setMarketingBannerEnabled] = useState(true);
  const [marketingFeaturedEnabled, setMarketingFeaturedEnabled] = useState(true);
  const [marketingPromoEnabled, setMarketingPromoEnabled] = useState(false);
  const [specialCodeDraft, setSpecialCodeDraft] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'' | 'client' | 'admin'>('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedUserTickets, setSelectedUserTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const [adminStats, setAdminStats] = useState<AdminStats>({});
  const [adminEvents, setAdminEvents] = useState<any[]>([]);
  const [eventFilter, setEventFilter] = useState<'all' | 'pending_approval' | 'draft' | 'published' | 'cancelled'>('all');
  const [eventSearch, setEventSearch] = useState('');
  const [editingAdminEvent, setEditingAdminEvent] = useState<any | null>(null);
  const [adminEditTitle, setAdminEditTitle] = useState('');
  const [adminEditVenue, setAdminEditVenue] = useState('');
  const [adminEditStatus, setAdminEditStatus] = useState<'draft' | 'published' | 'cancelled'>('published');

  // Lazy-loaded section data
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRecentOpen, setAnalyticsRecentOpen] = useState(false);
  const [eventFinancials, setEventFinancials] = useState<EventFinancial[]>([]);
  const [selectedFinancialEventId, setSelectedFinancialEventId] = useState('');
  const [apiCodes, setApiCodes] = useState<ApiSpecialCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesLoaded, setCodesLoaded] = useState(false);
  const [codesError, setCodesError] = useState('');
  const [commissionSummary, setCommissionSummary] = useState<CommissionEntry[]>([]);
  const [homeBanner, setHomeBanner] = useState<{ title?: string; isActive?: boolean } | null | false>(null);
  const [recipientsCount, setRecipientsCount] = useState(0);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [campaignSubjectDraft, setCampaignSubjectDraft] = useState('');
  const [campaignBodyDraft, setCampaignBodyDraft] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignPreheader, setCampaignPreheader] = useState('');
  const [campaignLink, setCampaignLink] = useState('');
  const [emailArtData, setEmailArtData] = useState('');
  const [emailArtFileName, setEmailArtFileName] = useState('');
  const [emailAudience, setEmailAudience] = useState<'all' | 'specify'>('all');
  const [smsMessage, setSmsMessage] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [waLang, setWaLang] = useState<'es' | 'en'>('es');
  const [sending, setSending] = useState<'' | 'email' | 'sms' | 'whatsapp'>('');
  const [bannerStatus, setBannerStatus] = useState<'draft' | 'active'>('draft');
  const [specialCodeOwnerDraft, setSpecialCodeOwnerDraft] = useState('');
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerSearchResults, setOwnerSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [ownerSearching, setOwnerSearching] = useState(false);
  const [usersApiError, setUsersApiError] = useState('');
  const [usersTotal, setUsersTotal] = useState<number | null>(null);

  // Category form (create + edit modals)
  const emptyCategForm = { labelEs: '', labelEn: '', icon: '🎫', color: '#6366f1', sortOrder: 0, imageData: '' as string };
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ ...emptyCategForm });
  const [editingCategoryModal, setEditingCategoryModal] = useState<Category | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState({ ...emptyCategForm });
  const [savingCategory, setSavingCategory] = useState(false);

  // Special codes extra state
  const [codeSearch, setCodeSearch] = useState('');
  const [editingCode, setEditingCode] = useState<ApiSpecialCode | null>(null);
  const [editCodeForm, setEditCodeForm] = useState({ code: '', ownerUserId: '', ownerName: '', ownerEmail: '', eventId: '', isActive: true });
  const [editCodeOwnerQuery, setEditCodeOwnerQuery] = useState('');
  const [editCodeOwnerResults, setEditCodeOwnerResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [codeActiveCreate, setCodeActiveCreate] = useState(true);
  const [codeEventId, setCodeEventId] = useState('');
  const [eventRewards, setEventRewards] = useState<Record<string, string>>({});
  const [savingEventReward, setSavingEventReward] = useState<string | null>(null);

  // Fees config
  const [feeEventId, setFeeEventId] = useState<string | null>(null);
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeTab, setFeeTab] = useState<'global' | 'sections'>('global');

  // Price approvals
  const [priceEventId, setPriceEventId] = useState<string | null>(null);
  const [priceConfig, setPriceConfig] = useState<PriceConfig | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Payout
  const [payoutEntry, setPayoutEntry] = useState<CommissionEntry | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);

  const loadUsers = async (roleFilter?: string) => {
    try {
      setUsersApiError('');
      const role = roleFilter !== undefined ? roleFilter : userRoleFilter;
      const params = role ? `?role=${role}&page=1&limit=50` : '?page=1&limit=50';
      const data = await apiGet<any>(`/admin/users${params}`);
      setUsers(listFrom(data).map(toAdminUser));
      setUsersTotal(typeof data?.total === 'number' ? data.total : listFrom(data).length);
    } catch (err: any) {
      setUsersApiError(err?.message || 'Could not load users');
    }
  };

  const openUserDetail = async (u: AdminUser) => {
    setSelectedUser(u);
    setSelectedUserTickets([]);
    setLoadingTickets(true);
    try {
      const data = await apiGet<any[]>(`/orders/user/${u.id}/tickets`);
      setSelectedUserTickets(Array.isArray(data) ? data : []);
    } catch { setSelectedUserTickets([]); }
    finally { setLoadingTickets(false); }
  };

  // ── Create user (admin) ────────────────────────────────────────────────────
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [cuForm, setCuForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', phone: '', role: 'client' as 'client' | 'organizer' | 'admin' });
  const [creatingUser, setCreatingUser] = useState(false);
  const setCu = (k: keyof typeof cuForm, v: string) => setCuForm((f) => ({ ...f, [k]: v }));
  const createUserApi = async () => {
    if (!cuForm.firstName.trim() || !cuForm.lastName.trim() || !cuForm.username.trim() || !cuForm.email.trim()) {
      Alert.alert(t('Faltan datos', 'Missing info'), t('Nombre, apellido, usuario y correo son requeridos.', 'First name, last name, username and email are required.'));
      return;
    }
    setCreatingUser(true);
    try {
      await apiPost('/admin/users', {
        firstName: cuForm.firstName,
        lastName: cuForm.lastName,
        username: cuForm.username,
        email: cuForm.email,
        password: cuForm.password || undefined,
        role: cuForm.role,
        phone: cuForm.phone,
      });
      Alert.alert(t('Listo', 'Done'), t('Usuario creado.', 'User created.'));
      setShowCreateUser(false);
      setCuForm({ firstName: '', lastName: '', username: '', email: '', password: '', phone: '', role: 'client' });
      await loadUsers();
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo crear el usuario', 'Could not create user'));
    } finally {
      setCreatingUser(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([
      apiGet<AdminStats>('/admin/stats'),
      apiGet<any>('/admin/events?page=1&limit=50'),
      apiGet<any>('/admin/users?page=1&limit=50'),
      apiGet<any>('/categories?all=true'),
      apiGet<any>('/admin/events/financials').catch(() => ({ events: [] })),
    ]).then(([statsRes, eventsRes, usersRes, categoriesRes, finRes]) => {
      if (!mounted) return;

      if (statsRes.status === 'fulfilled') setAdminStats(statsRes.value || {});
      if (finRes.status === 'fulfilled') setEventFinancials((finRes.value as any)?.events || []);

      if (eventsRes.status === 'fulfilled') {
        setAdminEvents(listFrom(eventsRes.value));
      }

      if (usersRes.status === 'fulfilled') {
        setUsers(listFrom(usersRes.value).map(toAdminUser));
        setUsersTotal(typeof usersRes.value?.total === 'number' ? usersRes.value.total : listFrom(usersRes.value).length);
        setUsersApiError('');
      }

      if (categoriesRes.status === 'fulfilled') {
        const liveCategories = listFrom(categoriesRes.value).map((category: any) => ({
          id: String(category.id || category._id || category.name),
          name: category.labelEs || category.name || category.label || 'Category',
          labelEs: category.labelEs || category.name || '',
          labelEn: category.labelEn || category.name || '',
          slug: category.slug || '',
          icon: category.icon || '🎫',
          color: category.color || '#6366f1',
          sortOrder: category.sortOrder ?? 0,
          imageData: category.imageData || '',
          active: category.isActive !== false && category.active !== false,
          featured: Boolean(category.featured || category.isFeatured),
        }));
        if (liveCategories.length) setCategories(liveCategories);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const [users, setUsers] = useState<AdminUser[]>([
    { id: '1', name: 'Sundin Galue', firstName: 'Sundin', lastName: 'Galue', username: 'sundin', email: 'sundin@example.com', role: 'admin', suspended: false },
    { id: '2', name: 'Fidel Genre', firstName: 'Fidel', lastName: 'Genre', username: 'fidel', email: 'fidel@example.com', role: 'organizer', suspended: false },
    { id: '3', name: 'Maria Lopez', firstName: 'Maria', lastName: 'Lopez', username: 'maria', email: 'maria@example.com', role: 'client', suspended: false },
  ]);

  useEffect(() => {
    if (active === 'users') loadUsers(userRoleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userRoleFilter]);

  const normalizedUserSearch = userSearchQuery.trim().toLowerCase();
  const visibleUsers = normalizedUserSearch
    ? users.filter((user) => {
        const haystack = `${user.name} ${user.email} ${user.role} ${user.suspended ? 'suspended suspendido' : 'active activo'}`.toLowerCase();
        return haystack.includes(normalizedUserSearch);
      })
    : users;

  const [categories, setCategories] = useState<Category[]>([
    { id: '1', name: 'Concert', labelEs: 'Concierto', labelEn: 'Concert', slug: 'concierto', icon: '🎵', color: '#f97316', sortOrder: 0, active: true, featured: true },
    { id: '2', name: 'Private Event', labelEs: 'Evento Privado', labelEn: 'Private Event', slug: 'evento-privado', icon: '🎫', color: '#6366f1', sortOrder: 1, active: true, featured: true },
    { id: '3', name: 'Theater', labelEs: 'Teatro', labelEn: 'Theater', slug: 'teatro', icon: '🎭', color: '#8b5cf6', sortOrder: 2, active: true, featured: false },
    { id: '4', name: 'Workshop', labelEs: 'Taller', labelEn: 'Workshop', slug: 'taller', icon: '🎪', color: '#6b7280', sortOrder: 3, active: false, featured: false },
  ]);

  const firstEvent = adminEvents[0];
  const activeSectionIndex = Math.max(0, sections.findIndex((section) => section.id === active));

  useEffect(() => {
    const activeLayout = tabLayouts[active];
    const fallbackX = 6 + activeSectionIndex * 130;
    const nextX = activeLayout?.x ?? fallbackX;
    const nextWidth = activeLayout?.width ?? 118;

    Animated.parallel([
      Animated.spring(adminIndicatorX, {
        toValue: nextX,
        useNativeDriver: false,
        damping: 17,
        stiffness: 190,
        mass: 0.72,
      }),
      Animated.spring(adminIndicatorWidth, {
        toValue: nextWidth,
        useNativeDriver: false,
        damping: 15,
        stiffness: 150,
        mass: 0.8,
      }),
    ]).start();
  }, [active, activeSectionIndex, adminIndicatorWidth, adminIndicatorX, tabLayouts]);

  // Reload events when filter changes
  useEffect(() => {
    if (active !== 'events') return;
    const params = eventFilter !== 'all' ? `?status=${eventFilter}&page=1&limit=50` : '?page=1&limit=50';
    apiGet<any>(`/admin/events${params}`)
      .then((data) => setAdminEvents(listFrom(data)))
      .catch(() => {});
  }, [eventFilter, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load analytics when that section is first opened or days changes
  useEffect(() => {
    if (active !== 'analytics' || analyticsLoading) return;
    setAnalyticsLoading(true);
    setAnalyticsSummary(null);
    apiGet<AnalyticsSummary>(`/analytics/summary?days=${analyticsDays}`)
      .then(setAnalyticsSummary)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [active, analyticsDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load special codes when that section is first opened
  useEffect(() => {
    if (active !== 'codes' || codesLoaded || codesLoading) return;
    setCodesLoading(true);
    setCodesError('');
    Promise.allSettled([
      apiGet<ApiSpecialCode[]>('/special-codes'),
      apiGet<CommissionEntry[]>('/special-codes/admin/commission-summary'),
    ]).then(([codesRes, commRes]) => {
      let nextError = '';
      if (codesRes.status === 'fulfilled') setApiCodes(codesRes.value || []);
      if (codesRes.status === 'rejected') nextError = codesRes.reason?.message || 'Could not load special codes';
      if (commRes.status === 'fulfilled') setCommissionSummary(commRes.value || []);
      if (commRes.status === 'rejected' && !nextError) nextError = commRes.reason?.message || 'Could not load commission summary';
      if (nextError) setCodesError(nextError);
    }).finally(() => {
      setCodesLoaded(true);
      setCodesLoading(false);
    });
  }, [active, codesLoaded, codesLoading]);

  // Lazy-load marketing data when that section is first opened
  useEffect(() => {
    if (active !== 'marketing' || homeBanner !== null) return;
    Promise.allSettled([
      apiGet<any>('/marketing/banner/home'),
      apiGet<any[]>('/marketing/admin/recipients'),
    ]).then(([bannerRes, recipientsRes]) => {
      const banner = bannerRes.status === 'fulfilled' ? (bannerRes.value || false) : false;
      setHomeBanner(banner);
      if (banner && (banner as any).imageData) setBannerStatus('active');
      if (recipientsRes.status === 'fulfilled') setRecipientsCount((recipientsRes.value || []).length);
    });
  }, [active, homeBanner]);


  // ── User actions ───────────────────────────────────────────────────────────

  const updateUser = (id: string, key: keyof AdminUser, value: string | boolean) => {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, [key]: value } : user));
  };

  const saveUserToApi = async (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    const [firstName, ...rest] = user.name.split(' ');
    try {
      await apiPatch(`/admin/users/${id}`, { firstName, lastName: rest.join(' '), email: user.email });
      await apiPatch(`/admin/users/${id}/role`, { role: user.role });
      setEditingUserId(null);
    } catch {
      Alert.alert(t('Error', 'Error'), t('No se pudo guardar el usuario.', 'Could not save user.'));
    }
  };

  const toggleUserActiveApi = async (id: string) => {
    try {
      await apiPatch(`/admin/users/${id}/toggle-active`);
      updateUser(id, 'suspended', !users.find((u) => u.id === id)?.suspended);
    } catch {}
  };

  const deleteUserApi = (id: string) => {
    Alert.alert(
      t('Eliminar usuario', 'Delete user'),
      t('¿Estás seguro? Esta acción no se puede deshacer.', 'Are you sure? This cannot be undone.'),
      [
        { text: t('Cancelar', 'Cancel'), style: 'cancel' },
        {
          text: t('Eliminar', 'Delete'), style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/admin/users/${id}`);
              setUsers((current) => current.filter((u) => u.id !== id));
            } catch {
              Alert.alert(t('Error', 'Error'), t('No se pudo eliminar el usuario.', 'Could not delete user.'));
            }
          },
        },
      ],
    );
  };

  // ── Category actions ───────────────────────────────────────────────────────

  const updateCategory = (id: string, key: keyof Category, value: string | boolean) => {
    setCategories((current) => current.map((category) => category.id === id ? { ...category, [key]: value } : category));
  };

  const pickCategoryImage = async (which: 'create' | 'edit') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('Permiso necesario', 'Permission needed'), t('Concede acceso a tus fotos.', 'Grant photo access.')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, base64: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const dataUrl = a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri;
    if (which === 'create') setCategoryForm((f) => ({ ...f, imageData: dataUrl }));
    else setEditCategoryForm((f) => ({ ...f, imageData: dataUrl }));
  };

  const slugify = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const addCategory = async () => {
    const labelEs = categoryForm.labelEs.trim();
    const labelEn = categoryForm.labelEn.trim() || labelEs;
    if (!labelEs) return;
    const slug = slugify(labelEs);
    setSavingCategory(true);
    try {
      const result = await apiPost<any>('/categories', {
        slug, labelEs, labelEn,
        icon: categoryForm.icon,
        color: categoryForm.color,
        sortOrder: Number(categoryForm.sortOrder) || 0,
        ...(categoryForm.imageData ? { imageData: categoryForm.imageData } : {}),
      });
      setCategories((current) => [...current, {
        id: String(result.id || Date.now()),
        name: labelEs, labelEs, labelEn,
        slug: result.slug || slug,
        icon: result.icon || categoryForm.icon,
        color: result.color || categoryForm.color,
        sortOrder: result.sortOrder ?? Number(categoryForm.sortOrder) ?? 0,
        imageData: categoryForm.imageData || '',
        active: true, featured: false,
      }]);
      setCategoryForm({ ...emptyCategForm });
      setShowCreateCategory(false);
    } catch {
      Alert.alert(t('Error', 'Error'), t('No se pudo crear la categoría.', 'Could not create category.'));
    } finally { setSavingCategory(false); }
  };

  const saveCategoryToApi = async (id: string) => {
    const labelEs = editCategoryForm.labelEs.trim();
    const labelEn = editCategoryForm.labelEn.trim() || labelEs;
    const slug = slugify(labelEs);
    setSavingCategory(true);
    try {
      await apiPatch(`/categories/${id}`, {
        slug, labelEs, labelEn,
        icon: editCategoryForm.icon,
        color: editCategoryForm.color,
        sortOrder: Number(editCategoryForm.sortOrder) || 0,
        isActive: editingCategoryModal?.active ?? true,
        ...(editCategoryForm.imageData ? { imageData: editCategoryForm.imageData } : {}),
      });
      setCategories((current) => current.map((c) => c.id === id ? {
        ...c, name: labelEs, labelEs, labelEn, slug,
        icon: editCategoryForm.icon,
        color: editCategoryForm.color,
        sortOrder: Number(editCategoryForm.sortOrder) || 0,
        imageData: editCategoryForm.imageData || c.imageData,
      } : c));
      setEditingCategoryModal(null);
      setEditingCategoryId(null);
    } catch {
      Alert.alert(t('Error', 'Error'), t('No se pudo guardar la categoría.', 'Could not save category.'));
    } finally { setSavingCategory(false); }
  };

  const toggleCategoryActiveApi = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    const next = !cat.active;
    updateCategory(id, 'active', next);
    try {
      await apiPatch(`/categories/${id}`, { isActive: next });
    } catch {
      updateCategory(id, 'active', !next);
    }
  };

  const deleteCategoryApi = (id: string) => {
    Alert.alert(
      t('Eliminar categoría', 'Delete category'),
      t('¿Estás seguro?', 'Are you sure?'),
      [
        { text: t('Cancelar', 'Cancel'), style: 'cancel' },
        {
          text: t('Eliminar', 'Delete'), style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/categories/${id}`);
              setCategories((current) => current.filter((c) => c.id !== id));
            } catch {
              Alert.alert(t('Error', 'Error'), t('No se pudo eliminar.', 'Could not delete.'));
            }
          },
        },
      ],
    );
  };

  // ── Event actions ──────────────────────────────────────────────────────────

  const toggleEventFeaturedApi = async (id: string) => {
    try {
      await apiPatch(`/admin/events/${id}/toggle-featured`);
      setAdminEvents((current) => current.map((e) => e.id === id ? { ...e, isFeatured: !e.isFeatured, featured: !e.featured } : e));
    } catch {}
  };

  const toggleEventVisibilityApi = async (id: string) => {
    try {
      await apiPatch(`/admin/events/${id}/toggle-public-visibility`);
      setAdminEvents((current) => current.map((e) => e.id === id ? { ...e, status: e.status === 'published' ? 'draft' : 'published' } : e));
    } catch {}
  };

  const deleteEventApi = (id: string) => {
    Alert.alert(
      t('Eliminar evento', 'Delete event'),
      t('¿Estás seguro? Esta acción no se puede deshacer.', 'Are you sure? This cannot be undone.'),
      [
        { text: t('Cancelar', 'Cancel'), style: 'cancel' },
        {
          text: t('Eliminar', 'Delete'), style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/admin/events/${id}`);
              setAdminEvents((current) => current.filter((e) => e.id !== id));
            } catch {
              Alert.alert(t('Error', 'Error'), t('No se pudo eliminar el evento.', 'Could not delete event.'));
            }
          },
        },
      ],
    );
  };

  // ── Event approval (pending events + pending changes) ──────────────────────
  const PENDING_CHANGE_FIELDS = ['title', 'description', 'imageUrl', 'bannerImageUrl', 'venueName', 'category', 'eventDate', 'creatorCommission'];
  const eventPendingFields = (ev: any): string[] => {
    const map: Record<string, any> = {
      title: ev.pendingTitle, description: ev.pendingDescription, imageUrl: ev.pendingImageUrl,
      bannerImageUrl: ev.pendingBannerImageUrl, venueName: ev.pendingVenueName, category: ev.pendingCategory,
      eventDate: ev.pendingEventDate,
      creatorCommission: ev.pendingCreatorCommission != null ? ev.pendingCreatorCommission : undefined,
    };
    return PENDING_CHANGE_FIELDS.filter((f) => map[f] != null && map[f] !== '');
  };

  const approveEventApi = async (id: string) => {
    try {
      await apiPatch(`/admin/events/${id}/approve`);
      setAdminEvents((cur) => cur.map((e) => e.id === id ? { ...e, status: 'published' } : e));
    } catch (err: any) { Alert.alert('Error', err?.message || t('No se pudo aprobar', 'Could not approve')); }
  };
  const rejectEventApi = async (id: string) => {
    try {
      await apiPatch(`/admin/events/${id}/reject`);
      setAdminEvents((cur) => cur.map((e) => e.id === id ? { ...e, status: 'rejected' } : e));
    } catch (err: any) { Alert.alert('Error', err?.message || t('No se pudo rechazar', 'Could not reject')); }
  };
  const resolveChanges = async (id: string, approve: boolean) => {
    const ev = adminEvents.find((e) => e.id === id);
    if (!ev) return;
    const fields = eventPendingFields(ev);
    if (fields.length === 0) return;
    try {
      for (const field of fields) {
        await apiPatch(`/admin/events/${id}/${approve ? 'approve-change' : 'reject-change'}`, { field });
      }
      Alert.alert(t('Listo', 'Done'), approve ? t('Cambios aprobados.', 'Changes approved.') : t('Cambios rechazados.', 'Changes rejected.'));
      try {
        const fresh = await apiGet<any>('/admin/events?page=1&limit=50');
        setAdminEvents(listFrom(fresh));
      } catch {}
    } catch (err: any) { Alert.alert('Error', err?.message || 'Error'); }
  };

  // ── Special codes actions ──────────────────────────────────────────────────

  const searchOwnerUsers = async (q: string) => {
    if (q.trim().length < 2) { setOwnerSearchResults([]); return; }
    setOwnerSearching(true);
    try {
      const data = await apiGet<any>(`/admin/users?search=${encodeURIComponent(q.trim())}&limit=5`);
      setOwnerSearchResults(listFrom(data).map((u: any) => ({
        id: u.id || u._id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email,
        email: u.email,
      })));
    } catch { setOwnerSearchResults([]); }
    finally { setOwnerSearching(false); }
  };

  const addSpecialCode = async () => {
    const code = specialCodeDraft.trim().toUpperCase();
    const ownerUserId = specialCodeOwnerDraft.trim();
    if (!code || !ownerUserId) {
      Alert.alert(t('Campos requeridos', 'Required fields'), t('Ingresa el código y selecciona el dueño.', 'Enter the code and select the owner.'));
      return;
    }
    try {
      const result = await apiPost<ApiSpecialCode>('/special-codes', { code, ownerUserId, eventId: codeEventId || null, isActive: codeActiveCreate, commissionFixed: 0 });
      setApiCodes((current) => [result, ...current]);
      setSpecialCodeDraft('');
      setSpecialCodeOwnerDraft('');
      setOwnerSearchQuery('');
      setOwnerSearchResults([]);
      setCodeEventId('');
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo crear el código.', 'Could not create code.'));
    }
  };

  const searchEditCodeOwner = async (q: string) => {
    if (q.trim().length < 2) { setEditCodeOwnerResults([]); return; }
    try {
      const data = await apiGet<any>(`/admin/users?search=${encodeURIComponent(q.trim())}&limit=5`);
      setEditCodeOwnerResults(listFrom(data).map((u: any) => ({
        id: u.id || u._id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email,
        email: u.email,
      })));
    } catch { setEditCodeOwnerResults([]); }
  };

  const saveEditCode = async () => {
    if (!editingCode) return;
    if (!editCodeForm.code.trim() || !editCodeForm.ownerUserId) {
      Alert.alert(t('Campos requeridos', 'Required'), t('Código y dueño son requeridos.', 'Code and owner required.'));
      return;
    }
    try {
      await apiPatch(`/special-codes/${editingCode.id}`, {
        code: editCodeForm.code.trim().toUpperCase(),
        ownerUserId: editCodeForm.ownerUserId,
        eventId: editCodeForm.eventId || null,
        isActive: editCodeForm.isActive,
      });
      setApiCodes((current) => current.map((c) => c.id === editingCode.id ? {
        ...c,
        code: editCodeForm.code.trim().toUpperCase(),
        ownerUserId: editCodeForm.ownerUserId,
        isActive: editCodeForm.isActive,
        eventId: editCodeForm.eventId || null,
      } : c));
      setEditingCode(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo guardar.', 'Could not save.'));
    }
  };

  const saveEventReward = async (eventId: string) => {
    const amount = Math.round(Number(eventRewards[eventId] ?? '0') * 100) / 100;
    if (isNaN(amount) || amount < 0) { Alert.alert('Error', t('Monto inválido', 'Invalid amount')); return; }
    setSavingEventReward(eventId);
    try {
      await apiPatch(`/admin/events/${eventId}/creator-commission`, { amount });
      setAdminEvents((current) => current.map((e) => e.id === eventId ? { ...e, creatorCommission: amount } : e));
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo guardar', 'Could not save'));
    } finally { setSavingEventReward(null); }
  };

  const toggleSpecialCode = async (id: string) => {
    const code = apiCodes.find((c) => c.id === id);
    if (!code) return;
    const next = !code.isActive;
    setApiCodes((current) => current.map((c) => c.id === id ? { ...c, isActive: next } : c));
    try {
      await apiPatch(`/special-codes/${id}`, { isActive: next });
    } catch {
      setApiCodes((current) => current.map((c) => c.id === id ? { ...c, isActive: !next } : c));
    }
  };

  const deleteCodeApi = (id: string) => {
    Alert.alert(
      t('Eliminar código', 'Delete code'),
      t('¿Estás seguro?', 'Are you sure?'),
      [
        { text: t('Cancelar', 'Cancel'), style: 'cancel' },
        {
          text: t('Eliminar', 'Delete'), style: 'destructive',
          onPress: async () => {
            try {
              await apiDelete(`/special-codes/${id}`);
              setApiCodes((current) => current.filter((c) => c.id !== id));
            } catch {
              Alert.alert(t('Error', 'Error'), t('No se pudo eliminar el código.', 'Could not delete code.'));
            }
          },
        },
      ],
    );
  };

  // ── Marketing campaigns ────────────────────────────────────────────────────

  const sendEmailCampaign = async () => {
    const subject = campaignSubjectDraft.trim() || campaignName.trim();
    if (!subject) {
      Alert.alert(t('Asunto requerido', 'Subject required'), t('Ingresa un asunto o nombre de campaña.', 'Enter a subject or campaign name.'));
      return;
    }
    setSending('email');
    try {
      const result = await apiPost<{ sent: number; failed: number; total: number }>('/marketing/admin/email-campaign', {
        subject,
        title: campaignName || subject,
        preheader: campaignPreheader || campaignBodyDraft,
        link: campaignLink || undefined,
        imageData: emailArtData || undefined,
      });
      Alert.alert(t('Campaña enviada', 'Campaign sent'), t(`Enviados: ${result.sent} / ${result.total}`, `Sent: ${result.sent} / ${result.total}`));
      setCampaignSubjectDraft('');
      setCampaignBodyDraft('');
      setCampaignName('');
      setCampaignPreheader('');
      setCampaignLink('');
    } catch {
      Alert.alert(t('Error', 'Error'), t('No se pudo enviar la campaña.', 'Could not send campaign.'));
    } finally { setSending(''); }
  };

  const pickEmailArt = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('Permiso necesario', 'Permission needed'), t('Concede acceso a tus fotos.', 'Grant photo access.')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    setEmailArtData(a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri);
    setEmailArtFileName(a.fileName || 'email-art.jpg');
  };

  const sendSms = async () => {
    if (!smsMessage.trim()) { Alert.alert(t('Mensaje vacío', 'Empty message'), t('Escribe un mensaje.', 'Write a message.')); return; }
    setSending('sms');
    try {
      const result = await apiPost<{ sent: number; failed: number; total: number }>('/marketing/admin/sms-campaign', { message: smsMessage });
      Alert.alert(t('SMS enviado', 'SMS sent'), t(`Enviados: ${result.sent} / ${result.total}`, `Sent: ${result.sent} / ${result.total}`));
      setSmsMessage('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo enviar el SMS.', 'Could not send SMS.'));
    } finally { setSending(''); }
  };

  const sendWhatsapp = async () => {
    if (!whatsappMessage.trim()) { Alert.alert(t('Mensaje vacío', 'Empty message'), t('Escribe un mensaje.', 'Write a message.')); return; }
    setSending('whatsapp');
    try {
      const result = await apiPost<{ sent: number; failed: number; total: number }>('/marketing/admin/whatsapp-campaign', { message: whatsappMessage, lang: waLang });
      Alert.alert(t('WhatsApp enviado', 'WhatsApp sent'), t(`Enviados: ${result.sent} / ${result.total}`, `Sent: ${result.sent} / ${result.total}`));
      setWhatsappMessage('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo enviar el WhatsApp.', 'Could not send WhatsApp.'));
    } finally { setSending(''); }
  };

  // ── Home banner management (base64 data URLs, like the web) ────────────────
  const [bannerDesktop, setBannerDesktop] = useState<{ data: string; name: string } | null>(null);
  const [bannerMobile, setBannerMobile] = useState<{ data: string; name: string } | null>(null);
  const [publishingBanner, setPublishingBanner] = useState(false);

  const pickBanner = async (which: 'desktop' | 'mobile') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('Permiso necesario', 'Permission needed'), t('Concede acceso a tus fotos.', 'Grant photo access.')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const dataUrl = a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri;
    const entry = { data: dataUrl, name: a.fileName || `banner-${which}` };
    if (which === 'desktop') setBannerDesktop(entry); else setBannerMobile(entry);
  };

  const publishBanner = async () => {
    if (!bannerDesktop) { Alert.alert(t('Imagen requerida', 'Image required'), t('Selecciona la imagen del banner.', 'Select the banner image.')); return; }
    setPublishingBanner(true);
    try {
      await apiPost('/marketing/admin/banner/home', {
        imageData: bannerDesktop.data,
        fileName: bannerDesktop.name,
        mobileImageData: bannerMobile?.data || null,
        mobileFileName: bannerMobile?.name || null,
      });
      Alert.alert(t('Publicado', 'Published'), t('Banner publicado en el home.', 'Banner published on the home page.'));
      setHomeBanner({ isActive: true });
      setBannerStatus('active');
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo publicar el banner.', 'Could not publish the banner.'));
    } finally {
      setPublishingBanner(false);
    }
  };

  const deleteBanner = async (which: 'home' | 'home-mobile') => {
    try {
      await apiDelete(`/marketing/admin/banner/${which}`);
      if (which === 'home') { setBannerDesktop(null); setHomeBanner(false); } else setBannerMobile(null);
      Alert.alert(t('Listo', 'Done'), t('Banner eliminado.', 'Banner removed.'));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error');
    }
  };

  // ── Fees ──────────────────────────────────────────────────────────────────

  const openFees = async (ev: any) => {
    if (feeEventId === ev.id) { setFeeEventId(null); setFeeConfig(null); return; }
    setFeeEventId(ev.id);
    setFeeConfig(null);
    setFeeLoading(true);
    setFeeTab('global');
    try {
      const data = await apiGet<any>(`/admin/events/${ev.id}/fees`);
      const toStr = (v: any) => v != null ? String(v) : '';
      setFeeConfig({
        event: {
          id: data.event.id,
          serviceFeePercent: toStr(data.event.serviceFeePercent),
          serviceFeeFixedPerTicket: toStr(data.event.serviceFeeFixedPerTicket),
          processingFeePercent: toStr(data.event.processingFeePercent),
          processingFeeFixedPerTicket: toStr(data.event.processingFeeFixedPerTicket),
        },
        sections: (data.sections || []).map((s: any) => ({
          id: s.id,
          name: s.name || s.sectionType || 'Sección',
          serviceFeePercent: toStr(s.serviceFeePercent),
          serviceFeeFixedPerTicket: toStr(s.serviceFeeFixedPerTicket),
          processingFeePercent: toStr(s.processingFeePercent),
          processingFeeFixedPerTicket: toStr(s.processingFeeFixedPerTicket),
        })),
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo cargar la configuración de fees', 'Could not load fee configuration'));
      setFeeEventId(null);
    } finally {
      setFeeLoading(false);
    }
  };

  const saveEventFees = async () => {
    if (!feeConfig) return;
    const toNum = (v: string) => v.trim() !== '' ? Number(v) : null;
    setFeeSaving(true);
    try {
      await apiPatch(`/admin/events/${feeConfig.event.id}/fees`, {
        serviceFeePercent: toNum(feeConfig.event.serviceFeePercent),
        serviceFeeFixedPerTicket: toNum(feeConfig.event.serviceFeeFixedPerTicket),
        processingFeePercent: toNum(feeConfig.event.processingFeePercent),
        processingFeeFixedPerTicket: toNum(feeConfig.event.processingFeeFixedPerTicket),
      });
      Alert.alert(t('Listo', 'Done'), t('Fees del evento guardados.', 'Event fees saved.'));
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo guardar', 'Could not save'));
    } finally {
      setFeeSaving(false);
    }
  };

  const saveSectionFees = async (sectionId: string) => {
    if (!feeConfig) return;
    const sec = feeConfig.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    const toNum = (v: string) => v.trim() !== '' ? Number(v) : null;
    setFeeSaving(true);
    try {
      await apiPatch(`/admin/sections/${sectionId}/fees`, {
        serviceFeePercent: toNum(sec.serviceFeePercent),
        serviceFeeFixedPerTicket: toNum(sec.serviceFeeFixedPerTicket),
        processingFeePercent: toNum(sec.processingFeePercent),
        processingFeeFixedPerTicket: toNum(sec.processingFeeFixedPerTicket),
      });
      Alert.alert(t('Listo', 'Done'), t('Fees de sección guardados.', 'Section fees saved.'));
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo guardar', 'Could not save'));
    } finally {
      setFeeSaving(false);
    }
  };

  const updateFeeEvent = (key: keyof FeeConfig['event'], value: string) => {
    setFeeConfig((prev) => prev ? { ...prev, event: { ...prev.event, [key]: value } } : prev);
  };

  const updateFeeSection = (sectionId: string, key: string, value: string) => {
    setFeeConfig((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) => s.id === sectionId ? { ...s, [key]: value } : s),
    } : prev);
  };

  // ── Prices ─────────────────────────────────────────────────────────────────

  const openPrices = async (ev: any) => {
    if (priceEventId === ev.id) { setPriceEventId(null); setPriceConfig(null); return; }
    setPriceEventId(ev.id);
    setPriceConfig(null);
    setPriceLoading(true);
    try {
      const data = await apiGet<PriceConfig>(`/admin/events/${ev.id}/prices`);
      setPriceConfig(data);
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo cargar los precios', 'Could not load prices'));
      setPriceEventId(null);
    } finally {
      setPriceLoading(false);
    }
  };

  const approveSectionPrice = async (sectionId: string) => {
    try {
      await apiPatch(`/admin/sections/${sectionId}/approve-price`, {});
      Alert.alert(t('Aprobado', 'Approved'), t('Precio aprobado.', 'Price approved.'));
      if (priceEventId) {
        const data = await apiGet<PriceConfig>(`/admin/events/${priceEventId}/prices`);
        setPriceConfig(data);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error');
    }
  };

  const rejectSectionPrice = async (sectionId: string) => {
    try {
      await apiPatch(`/admin/sections/${sectionId}/reject-price`, {});
      Alert.alert(t('Rechazado', 'Rejected'), t('Precio rechazado.', 'Price rejected.'));
      if (priceEventId) {
        const data = await apiGet<PriceConfig>(`/admin/events/${priceEventId}/prices`);
        setPriceConfig(data);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error');
    }
  };

  // ── Payouts ────────────────────────────────────────────────────────────────

  const recordPayout = async () => {
    if (!payoutEntry) return;
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      Alert.alert(t('Monto requerido', 'Amount required'), t('Ingresa un monto válido.', 'Enter a valid amount.'));
      return;
    }
    setPayoutSaving(true);
    try {
      await apiPost('/special-codes/admin/payouts', {
        eventId: payoutEntry.eventId,
        ownerUserId: payoutEntry.ownerUserId,
        amount,
        note: payoutNote.trim() || undefined,
      });
      Alert.alert(t('Pago registrado', 'Payout recorded'), `$${amount.toFixed(2)} → ${payoutEntry.ownerName || payoutEntry.ownerUserId}`);
      setPayoutEntry(null);
      setPayoutAmount('');
      setPayoutNote('');
      // Reload commission summary
      setCodesLoaded(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo registrar el pago', 'Could not record payout'));
    } finally {
      setPayoutSaving(false);
    }
  };

  const openAdminEventEditor = (event: any) => {
    setEditingAdminEvent(event);
    setAdminEditTitle(adminEventTitle(event));
    setAdminEditVenue(adminEventVenue(event));
    setAdminEditStatus(event?.status === 'draft' ? 'draft' : 'published');
  };

  const closeAdminEventEditor = async () => {
    setEditingAdminEvent(null);
    try {
      const fresh = await apiGet<any>('/admin/events?page=1&limit=50');
      setAdminEvents(listFrom(fresh));
    } catch {
      /* keep current list */
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {active !== 'codes' && (
          <>
            <Text style={styles.eyebrow}>{t('ADMIN', 'ADMIN')}</Text>
            <Text style={styles.title}>{titleFor(active, t)}</Text>
            <Text style={styles.subtitle}>{subtitleFor(active, t)}</Text>
          </>
        )}


        {active === 'dashboard' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label={t('Ingresos totales', 'Total revenue')} value={money(adminStats.totalRevenue ?? 0)} />
              <Metric label={t('Usuarios', 'Users')} value={String(adminStats.totalUsers ?? 0)} />
              <Metric label={t('Eventos totales', 'Total events')} value={String(adminStats.totalEvents ?? 0)} />
              <Metric label={t('Órdenes', 'Orders')} value={String(adminStats.totalOrders ?? 0)} />
            </View>

            <View style={styles.dashRowTwo}>
              <View style={styles.dashHalfCard}>
                <Text style={styles.dashCardEyebrow}>{t('USUARIOS', 'USERS')}</Text>
                <View style={styles.dashMiniGrid}>
                  <View style={[styles.dashMiniStat, { borderColor: 'rgba(249,115,22,0.28)' }]}>
                    <Text style={[styles.dashMiniValue, { color: colors.orange }]}>{adminStats.clients ?? 0}</Text>
                    <Text style={styles.dashMiniLabel}>{t('Clientes', 'Clients')}</Text>
                  </View>
                  <View style={[styles.dashMiniStat, { borderColor: 'rgba(239,68,68,0.28)' }]}>
                    <Text style={[styles.dashMiniValue, { color: '#FCA5A5' }]}>{adminStats.admins ?? 0}</Text>
                    <Text style={styles.dashMiniLabel}>{t('Admins', 'Admins')}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.dashHalfCard}>
                <Text style={styles.dashCardEyebrow}>{t('EVENTOS', 'EVENTS')}</Text>
                <View style={styles.dashMiniGrid}>
                  <View style={[styles.dashMiniStat, { borderColor: 'rgba(34,197,94,0.28)' }]}>
                    <Text style={[styles.dashMiniValue, { color: '#4ADE80' }]}>{adminStats.publishedEvents ?? 0}</Text>
                    <Text style={styles.dashMiniLabel}>{t('Activos', 'Published')}</Text>
                  </View>
                  <View style={[styles.dashMiniStat, { borderColor: 'rgba(234,179,8,0.28)' }]}>
                    <Text style={[styles.dashMiniValue, { color: '#FDE047' }]}>{adminStats.draftEvents ?? 0}</Text>
                    <Text style={styles.dashMiniLabel}>{t('Borradores', 'Drafts')}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Financial breakdown */}
            {(() => {
              const selEv = selectedFinancialEventId ? eventFinancials.find((e) => e.id === selectedFinancialEventId) : null;
              const fin = selEv
                ? { totalRevenue: selEv.totalCharged, ticketSales: selEv.ticketSales, serviceFees: selEv.serviceFees, stripeFees: selEv.stripeFees, lpticketProfit: selEv.lpticketProfit }
                : { totalRevenue: adminStats.totalRevenue ?? 0, ticketSales: adminStats.ticketSales ?? 0, serviceFees: adminStats.serviceFees ?? 0, stripeFees: adminStats.stripeFees ?? 0, lpticketProfit: adminStats.lpticketProfit ?? 0 };
              return (
                <View style={styles.panelCard}>
                  <Text style={styles.formEyebrow}>{t('DESGLOSE FINANCIERO', 'FINANCIAL BREAKDOWN')}</Text>
                  <Text style={styles.panelTitle}>{t('Finanzas', 'Finances')}</Text>
                  {eventFinancials.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                      <TouchableOpacity onPress={() => setSelectedFinancialEventId('')} style={[styles.finEventPill, !selectedFinancialEventId && styles.finEventPillActive]}>
                        <Text style={[styles.finEventPillText, !selectedFinancialEventId && styles.finEventPillTextActive]}>{t('Global', 'Global')}</Text>
                      </TouchableOpacity>
                      {eventFinancials.map((ev) => (
                        <TouchableOpacity key={ev.id} onPress={() => setSelectedFinancialEventId(ev.id)} style={[styles.finEventPill, selectedFinancialEventId === ev.id && styles.finEventPillActive]}>
                          <Text style={[styles.finEventPillText, selectedFinancialEventId === ev.id && styles.finEventPillTextActive]} numberOfLines={1}>{ev.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  {selEv && (
                    <Text style={[styles.copy, { marginBottom: 10, marginTop: -8, fontSize: 12 }]}>
                      {selEv.ticketsSold} {t('tickets', 'tickets')} · {selEv.orders} {t('órdenes', 'orders')}
                    </Text>
                  )}
                  <View style={styles.finGrid}>
                    <View style={[styles.finCard, { borderColor: 'rgba(249,115,22,0.28)' }]}>
                      <Text style={styles.finCardLabel}>{t('TOTAL COBRADO', 'TOTAL CHARGED')}</Text>
                      <Text style={[styles.finCardValue, { color: colors.orange }]}>{money(fin.totalRevenue)}</Text>
                      <Text style={styles.finCardNote}>{t('Lo que pagaron compradores', 'What buyers paid')}</Text>
                    </View>
                    <View style={[styles.finCard, { borderColor: 'rgba(96,165,250,0.28)' }]}>
                      <Text style={styles.finCardLabel}>{t('VENTA ENTRADAS', 'TICKET SALES')}</Text>
                      <Text style={[styles.finCardValue, { color: '#60A5FA' }]}>{money(fin.ticketSales)}</Text>
                      <Text style={styles.finCardNote}>{t('Para organizadores', 'To organizers')}</Text>
                    </View>
                    <View style={[styles.finCard, { borderColor: 'rgba(249,115,22,0.28)' }]}>
                      <Text style={styles.finCardLabel}>{t('COMISIÓN LP', 'LP FEES')}</Text>
                      <Text style={[styles.finCardValue, { color: colors.orange }]}>{money(fin.serviceFees)}</Text>
                      <Text style={styles.finCardNote}>{t('Cargo sobre precio base', 'Markup over base price')}</Text>
                    </View>
                    <View style={[styles.finCard, { borderColor: 'rgba(168,85,247,0.28)' }]}>
                      <Text style={styles.finCardLabel}>{t('COMISIÓN STRIPE', 'STRIPE FEES')}</Text>
                      <Text style={[styles.finCardValue, { color: '#C084FC' }]}>-{money(fin.stripeFees)}</Text>
                      <Text style={styles.finCardNote}>{(adminStats.stripePercent ?? 0.029) * 100}% + ${(adminStats.stripeFixed ?? 0.30).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.finCard, styles.finCardGreen]}>
                      <Text style={styles.finCardLabel}>{t('GANANCIA LP', 'LP PROFIT')}</Text>
                      <Text style={[styles.finCardValue, { color: '#4ADE80' }]}>{money(fin.lpticketProfit)}</Text>
                      <Text style={styles.finCardNote}>{t('Comisión − Stripe (neto)', 'Fees − Stripe (net)')}</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            <PanelCard title={t('Actividad reciente', 'Recent activity')}>
              <Activity title={t('Evento más reciente', 'Latest event')} copy={firstEvent ? adminEventTitle(firstEvent) : t('Sin eventos todavía', 'No events yet')} />
              <Activity title={t('Órdenes pagadas', 'Paid orders')} copy={`${adminStats.paidOrders ?? adminStats.totalOrders ?? 0} ${t('órdenes', 'orders')}`} />
              <Activity title={t('Tickets emitidos', 'Tickets issued')} copy={`${adminStats.totalTickets ?? 0} ${t('tickets', 'tickets')}`} />
            </PanelCard>
          </>
        )}

        {active === 'events' && (
          editingAdminEvent ? (
            <>
              <TouchableOpacity onPress={closeAdminEventEditor} style={styles.adminEditBack}>
                <Text style={styles.adminEditBackText}>‹ {t('Eventos admin', 'Admin events')}</Text>
              </TouchableOpacity>
              <OrganizerDetailsMobile
                eventTitle={adminEditTitle}
                setEventTitle={setAdminEditTitle}
                eventVenue={adminEditVenue}
                setEventVenue={setAdminEditVenue}
                eventStatus={adminEditStatus}
                setEventStatus={setAdminEditStatus}
                goTo={(section) => {
                  if (section === 'events') closeAdminEventEditor();
                  if (section === 'map') Alert.alert(t('Mapa visual', 'Visual map'), t('Edita el mapa desde el panel Organizador del evento.', 'Edit the map from the Organizer event panel.'));
                }}
                selectedEventId={String(editingAdminEvent.id)}
                event={editingAdminEvent}
              />
            </>
          ) : (
            <>
            {/* Status filter tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventFilterRow} contentContainerStyle={styles.eventFilterContent}>
              {([
                { key: 'all', label: t('Todos', 'All') },
                { key: 'pending_approval', label: t('Por aprobar', 'Pending Approval') },
                { key: 'draft', label: t('Borradores', 'Drafts') },
                { key: 'published', label: t('Publicados', 'Published') },
                { key: 'cancelled', label: t('Rechazados', 'Rejected') },
              ] as const).map((f) => (
                <TouchableOpacity key={f.key} onPress={() => setEventFilter(f.key)} style={[styles.eventFilterPill, eventFilter === f.key && styles.eventFilterPillActive]}>
                  <Text style={[styles.eventFilterText, eventFilter === f.key && styles.eventFilterTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Search */}
            <View style={styles.userSearchBox}>
              <Text style={styles.userSearchIcon}>⌕</Text>
              <TextInput
                value={eventSearch}
                onChangeText={setEventSearch}
                placeholder={t('Buscar eventos...', 'Search events...')}
                placeholderTextColor="rgba(226,232,240,0.38)"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.userSearchInput}
              />
            </View>

            {adminEvents.filter((e) => !eventSearch || (e.title || '').toLowerCase().includes(eventSearch.toLowerCase())).length === 0 && (
              <PanelCard title={t('Sin eventos', 'No events')} copy={t('No hay eventos con ese filtro.', 'No events match this filter.')} />
            )}
            {[...adminEvents].filter((e) => !eventSearch || (e.title || '').toLowerCase().includes(eventSearch.toLowerCase())).sort(sortAdminEventsBySchedule).map((item: any) => (
              <View key={String(item.id || item.slug || adminEventTitle(item))} style={[styles.adminEventCard, isAdminEventPast(item) && styles.adminEventCardPast]}>
                <TouchableOpacity
                  onPress={() => openAdminEventEditor(item)}
                  style={styles.adminEventEditButton}
                  accessibilityLabel={t('Editar evento', 'Edit event')}
                >
                  <Ionicons name="pencil" size={15} color="#F97316" />
                </TouchableOpacity>
                <View style={styles.adminEventTop}>
                  <View style={styles.adminEventPosterWrap}>
                    {adminEventImage(item) ? (
                      <Image source={{ uri: adminEventImage(item) }} style={styles.adminEventPoster} resizeMode="cover" />
                    ) : (
                      <View style={styles.adminEventPosterFallback}>
                        <Text style={styles.adminEventPosterText}>EVENT</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.adminEventMain}>
                    <Text style={styles.adminEventEyebrow}>{(item.status || 'EVENT').toUpperCase()}</Text>
                    <Text style={styles.adminEventTitle} numberOfLines={2}>{adminEventTitle(item)}</Text>
                    <Text style={styles.adminEventMeta} numberOfLines={2}>{adminEventDate(item)} · {adminEventVenue(item)}</Text>
                    <View style={styles.adminEventBadges}>
                      <StatusPill label={isAdminEventPast(item) ? t('PASADO', 'PAST') : t('ACTIVO', 'ACTIVE')} tone={isAdminEventPast(item) ? 'gray' : 'red'} compact />
                      <StatusPill label={(item.status || 'PUBLICADO').toUpperCase()} tone={item.status === 'draft' ? 'gray' : 'green'} compact />
                      {item.featured || item.isFeatured ? <StatusPill label={t('DESTACADO', 'FEATURED')} tone="orange" compact /> : null}
                    </View>
                  </View>
                </View>

                {item.status === 'pending' && (
                  <View style={styles.adminApprovalRow}>
                    <TouchableOpacity onPress={() => approveEventApi(item.id)} style={[styles.adminApproveBtn]}>
                      <Text style={styles.adminApproveText}>{t('APROBAR EVENTO', 'APPROVE EVENT')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => rejectEventApi(item.id)} style={[styles.adminRejectBtn]}>
                      <Text style={styles.adminRejectText}>{t('RECHAZAR', 'REJECT')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {eventPendingFields(item).length > 0 && (
                  <View style={styles.adminApprovalRow}>
                    <TouchableOpacity onPress={() => resolveChanges(item.id, true)} style={[styles.adminApproveBtn]}>
                      <Text style={styles.adminApproveText}>{t('APROBAR CAMBIOS', 'APPROVE CHANGES')} ({eventPendingFields(item).length})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => resolveChanges(item.id, false)} style={[styles.adminRejectBtn]}>
                      <Text style={styles.adminRejectText}>{t('RECHAZAR', 'REJECT')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.adminEventActions}>
                  <GradientButton
                    label={item.featured || item.isFeatured ? t('QUITAR', 'UNFEATURE') : t('DESTACAR', 'FEATURE')}
                    onPress={() => toggleEventFeaturedApi(item.id)}
                    height={34}
                    style={styles.adminEventPrimaryAction}
                    textStyle={styles.adminEventPrimaryText}
                  />
                  <TouchableOpacity onPress={() => toggleEventVisibilityApi(item.id)} style={styles.adminEventSecondaryAction}>
                    <Text style={styles.adminEventSecondaryText}>{item.status === 'published' ? t('OCULTAR', 'HIDE') : t('PUBLICAR', 'PUBLISH')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteEventApi(item.id)} style={[styles.adminEventSecondaryAction, styles.adminEventDangerAction]}>
                    <Text style={[styles.adminEventSecondaryText, styles.adminEventDangerText]}>{t('DEL', 'DEL')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.adminEventActions}>
                  <TouchableOpacity onPress={() => openFees(item)} style={[styles.adminEventSecondaryAction, feeEventId === item.id && styles.adminEventSecondaryActionActive]}>
                    <Text style={[styles.adminEventSecondaryText, feeEventId === item.id && styles.adminEventSecondaryTextActive]}>{t('FEES', 'FEES')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openPrices(item)} style={[styles.adminEventSecondaryAction, priceEventId === item.id && styles.adminEventSecondaryActionActive]}>
                    <Text style={[styles.adminEventSecondaryText, priceEventId === item.id && styles.adminEventSecondaryTextActive]}>{t('PRECIOS', 'PRICES')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Inline fees panel */}
                {feeEventId === item.id && (
                  <View style={styles.inlinePanel}>
                    {feeLoading ? (
                      <Text style={styles.inlinePanelLoading}>{t('Cargando fees...', 'Loading fees...')}</Text>
                    ) : feeConfig ? (
                      <>
                        <View style={styles.feeTabs}>
                          <TouchableOpacity onPress={() => setFeeTab('global')} style={[styles.feeTab, feeTab === 'global' && styles.feeTabActive]}>
                            <Text style={[styles.feeTabText, feeTab === 'global' && styles.feeTabTextActive]}>{t('Global', 'Global')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setFeeTab('sections')} style={[styles.feeTab, feeTab === 'sections' && styles.feeTabActive]}>
                            <Text style={[styles.feeTabText, feeTab === 'sections' && styles.feeTabTextActive]}>{t('Secciones', 'Sections')}</Text>
                          </TouchableOpacity>
                        </View>
                        {feeTab === 'global' ? (
                          <>
                            <Text style={styles.inlinePanelLabel}>{t('Fee servicio %', 'Service fee %')}</Text>
                            <TextInput style={styles.inlinePanelInput} value={feeConfig.event.serviceFeePercent} onChangeText={(v) => updateFeeEvent('serviceFeePercent', v)} keyboardType="decimal-pad" placeholder="12" placeholderTextColor="#6B7280" />
                            <Text style={styles.inlinePanelLabel}>{t('Fee servicio fijo/ticket', 'Fixed service fee/ticket')}</Text>
                            <TextInput style={styles.inlinePanelInput} value={feeConfig.event.serviceFeeFixedPerTicket} onChangeText={(v) => updateFeeEvent('serviceFeeFixedPerTicket', v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#6B7280" />
                            <Text style={styles.inlinePanelLabel}>{t('Fee procesamiento %', 'Processing fee %')}</Text>
                            <TextInput style={styles.inlinePanelInput} value={feeConfig.event.processingFeePercent} onChangeText={(v) => updateFeeEvent('processingFeePercent', v)} keyboardType="decimal-pad" placeholder="2.9" placeholderTextColor="#6B7280" />
                            <Text style={styles.inlinePanelLabel}>{t('Fee procesamiento fijo/ticket', 'Fixed processing fee/ticket')}</Text>
                            <TextInput style={styles.inlinePanelInput} value={feeConfig.event.processingFeeFixedPerTicket} onChangeText={(v) => updateFeeEvent('processingFeeFixedPerTicket', v)} keyboardType="decimal-pad" placeholder="0.30" placeholderTextColor="#6B7280" />
                            <TouchableOpacity onPress={saveEventFees} style={styles.inlinePanelSave} disabled={feeSaving}>
                              <Text style={styles.inlinePanelSaveText}>{feeSaving ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR FEES', 'SAVE FEES')}</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          feeConfig.sections.map((sec) => (
                            <View key={sec.id} style={styles.inlineSectionFee}>
                              <Text style={styles.inlineSectionFeeTitle}>{sec.name}</Text>
                              <View style={styles.inlineFeeRow}>
                                <View style={styles.inlineFeeField}>
                                  <Text style={styles.inlinePanelLabel}>{t('Svc %', 'Svc %')}</Text>
                                  <TextInput style={styles.inlinePanelInput} value={sec.serviceFeePercent} onChangeText={(v) => updateFeeSection(sec.id, 'serviceFeePercent', v)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#6B7280" />
                                </View>
                                <View style={styles.inlineFeeField}>
                                  <Text style={styles.inlinePanelLabel}>{t('Svc fijo', 'Svc fix')}</Text>
                                  <TextInput style={styles.inlinePanelInput} value={sec.serviceFeeFixedPerTicket} onChangeText={(v) => updateFeeSection(sec.id, 'serviceFeeFixedPerTicket', v)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#6B7280" />
                                </View>
                                <View style={styles.inlineFeeField}>
                                  <Text style={styles.inlinePanelLabel}>{t('Proc %', 'Proc %')}</Text>
                                  <TextInput style={styles.inlinePanelInput} value={sec.processingFeePercent} onChangeText={(v) => updateFeeSection(sec.id, 'processingFeePercent', v)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#6B7280" />
                                </View>
                              </View>
                              <TouchableOpacity onPress={() => saveSectionFees(sec.id)} style={styles.inlinePanelSave} disabled={feeSaving}>
                                <Text style={styles.inlinePanelSaveText}>{feeSaving ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR', 'SAVE')}</Text>
                              </TouchableOpacity>
                            </View>
                          ))
                        )}
                      </>
                    ) : null}
                  </View>
                )}

                {/* Inline prices panel */}
                {priceEventId === item.id && (
                  <View style={styles.inlinePanel}>
                    {priceLoading ? (
                      <Text style={styles.inlinePanelLoading}>{t('Cargando precios...', 'Loading prices...')}</Text>
                    ) : priceConfig ? (
                      priceConfig.sections.length === 0 ? (
                        <Text style={styles.inlinePanelLoading}>{t('Sin secciones con precios.', 'No sections with prices.')}</Text>
                      ) : (
                        priceConfig.sections.map((sec) => (
                          <View key={sec.id} style={styles.inlineSectionFee}>
                            <Text style={styles.inlineSectionFeeTitle}>{sec.name}</Text>
                            <Text style={styles.inlinePanelLabel}>
                              {t('Precio actual', 'Current price')}: ${sec.price ?? '—'}
                              {sec.pendingPrice != null ? `  →  $${sec.pendingPrice} (${t('pendiente', 'pending')})` : ''}
                            </Text>
                            {sec.pendingPrice != null && (
                              <View style={styles.adminApprovalRow}>
                                <TouchableOpacity onPress={() => approveSectionPrice(sec.id)} style={styles.adminApproveBtn}>
                                  <Text style={styles.adminApproveText}>{t('APROBAR', 'APPROVE')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => rejectSectionPrice(sec.id)} style={styles.adminRejectBtn}>
                                  <Text style={styles.adminRejectText}>{t('RECHAZAR', 'REJECT')}</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        ))
                      )
                    ) : null}
                  </View>
                )}
              </View>
            ))}
            </>
          )
        )}

        {active === 'users' && (
          <>
            {/* Role filter tabs */}
            <View style={styles.userRoleFilterRow}>
              {([
                { key: '', label: t('Todos', 'All') },
                { key: 'client', label: t('Clientes', 'Clients') },
                { key: 'admin', label: t('Admins', 'Admins') },
              ] as const).map((f) => (
                <TouchableOpacity key={f.key} onPress={() => setUserRoleFilter(f.key)} style={[styles.eventFilterPill, userRoleFilter === f.key && styles.eventFilterPillActive]}>
                  <Text style={[styles.eventFilterText, userRoleFilter === f.key && styles.eventFilterTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Search */}
            <View style={[styles.userSearchBox, { marginBottom: 10 }]}>
              <Text style={styles.userSearchIcon}>⌕</Text>
              <TextInput
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
                placeholder={t('Buscar usuarios...', 'Search users...')}
                placeholderTextColor="rgba(226,232,240,0.38)"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.userSearchInput}
              />
            </View>

            {/* Create user button */}
            <TouchableOpacity onPress={() => setShowCreateUser(true)} style={styles.createUserBtn}>
              <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
              <Text style={styles.createUserBtnText}>{t('CREAR USUARIO', 'CREATE USER')}</Text>
            </TouchableOpacity>

            {usersApiError ? (
              <View style={styles.userEmptyCard}>
                <Text style={styles.userEmptyText}>{usersApiError}</Text>
              </View>
            ) : null}

            {visibleUsers.length === 0 && !usersApiError && (
              <View style={styles.userEmptyCard}>
                <Text style={styles.userEmptyText}>{t('No se encontraron usuarios', 'No users found')}</Text>
              </View>
            )}

            {visibleUsers.map((user) => {
              const initials = ((user.firstName[0] || '') + (user.lastName[0] || '')).toUpperCase() || user.name.slice(0, 2).toUpperCase();
              const dateStr = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
              return (
                <TouchableOpacity key={user.id} onPress={() => openUserDetail(user)} style={styles.userCard2} activeOpacity={0.8}>
                  {/* Top row: avatar + name + role badge */}
                  <View style={styles.userCard2Top}>
                    <View style={styles.userInitialsAvatar}>
                      {user.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 999 }} resizeMode="cover" />
                      ) : (
                        <Text style={styles.userInitialsText}>{initials}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.userCard2Name} numberOfLines={1}>{user.name}</Text>
                      <Text style={styles.userCard2Username} numberOfLines={1}>@{user.username}</Text>
                    </View>
                    <StatusPill label={user.role.toUpperCase()} tone={user.role === 'admin' ? 'dark' : 'gray'} compact />
                  </View>

                  {/* Email row */}
                  <View style={styles.userCard2EmailRow}>
                    <Ionicons name="mail-outline" size={13} color="rgba(226,232,240,0.5)" />
                    <Text style={styles.userCard2Email} numberOfLines={1}>{user.email}</Text>
                  </View>

                  {/* Status + date */}
                  <View style={styles.userCard2StatusRow}>
                    <StatusPill label={user.suspended ? t('INACTIVO', 'INACTIVE') : t('ACTIVO', 'ACTIVE')} tone={user.suspended ? 'red' : 'green'} compact />
                    {dateStr ? <Text style={styles.userCard2Date}>{dateStr}</Text> : null}
                  </View>

                  {/* Action bar */}
                  <View style={styles.userCard2Actions} onStartShouldSetResponder={() => true}>
                    <View style={styles.userRoleDropdown}>
                      <Text style={styles.userRoleDropdownText}>{user.role === 'admin' ? 'Admin' : user.role === 'organizer' ? 'Organizer' : 'Client'}</Text>
                      <Ionicons name="chevron-down" size={12} color="rgba(226,232,240,0.5)" />
                    </View>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); openUserDetail(user); }} style={styles.userActionIcon}>
                      <Ionicons name="pencil-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleUserActiveApi(user.id); }} style={[styles.userActionIcon, { borderColor: user.suspended ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }]}>
                      <Ionicons name={user.suspended ? 'checkmark-circle-outline' : 'ban-outline'} size={18} color={user.suspended ? '#4ADE80' : '#FCA5A5'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); deleteUserApi(user.id); }} style={[styles.userActionIcon, { borderColor: 'rgba(239,68,68,0.28)' }]}>
                      <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

      {selectedUser && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedUser(null)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedUser(null)} activeOpacity={1} />
            <View style={styles.userModal}>
              {/* Modal header */}
              <View style={styles.userModalHeader}>
                <View style={styles.userInitialsAvatarLg}>
                  {selectedUser.avatarUrl ? (
                    <Image source={{ uri: selectedUser.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 999 }} resizeMode="cover" />
                  ) : (
                    <Text style={styles.userInitialsTextLg}>
                      {((selectedUser.firstName[0] || '') + (selectedUser.lastName[0] || '')).toUpperCase() || selectedUser.name.slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.userModalName}>{selectedUser.name}</Text>
                  <Text style={styles.userModalSub}>@{selectedUser.username} · {selectedUser.role.toUpperCase()}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.userModalClose}>
                  <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
                {/* Contact info */}
                <View>
                  <Text style={styles.userModalSectionLabel}>{t('INFORMACIÓN DE CONTACTO', 'CONTACT INFORMATION')}</Text>
                  <View style={styles.userModalInfoCard}>
                    <View style={styles.userModalInfoRow}>
                      <Ionicons name="mail-outline" size={16} color="rgba(226,232,240,0.5)" />
                      <Text style={styles.userModalInfoText}>{selectedUser.email}</Text>
                    </View>
                    <View style={styles.userModalInfoRow}>
                      <Ionicons name="call-outline" size={16} color="rgba(226,232,240,0.5)" />
                      <Text style={styles.userModalInfoText}>{selectedUser.phone || t('No configurado', 'Not configured')}</Text>
                    </View>
                    <View style={styles.userModalInfoRow}>
                      <Ionicons name="location-outline" size={16} color="rgba(226,232,240,0.5)" />
                      <Text style={styles.userModalInfoText}>{selectedUser.address || t('No configurado', 'Not configured')}</Text>
                    </View>
                    {selectedUser.createdAt && (
                      <View style={styles.userModalInfoRow}>
                        <Ionicons name="calendar-outline" size={16} color="rgba(226,232,240,0.5)" />
                        <Text style={styles.userModalInfoText}>{t('Registrado el', 'Registered on')} {new Date(selectedUser.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Ticket history */}
                <View>
                  <Text style={styles.userModalSectionLabel}>{t('HISTORIAL DE COMPRAS', 'TICKETS PURCHASE HISTORY')}</Text>
                  <View style={styles.userModalInfoCard}>
                    {loadingTickets ? (
                      <Text style={styles.userModalEmptyText}>{t('Cargando...', 'Loading...')}</Text>
                    ) : selectedUserTickets.length === 0 ? (
                      <Text style={styles.userModalEmptyText}>{t('No se encontraron compras de tickets para este cliente', 'No ticket purchases found for this client')}</Text>
                    ) : selectedUserTickets.map((tk: any, i) => (
                      <View key={tk.id || i} style={[styles.userModalInfoRow, i > 0 && { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: 10 }]}>
                        <Ionicons name="ticket-outline" size={15} color="rgba(249,115,22,0.7)" />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.userModalInfoText, { fontWeight: '700' }]} numberOfLines={1}>{tk.event?.title || tk.eventTitle || t('Evento', 'Event')}</Text>
                          <Text style={[styles.userModalInfoText, { fontSize: 11, color: 'rgba(226,232,240,0.5)' }]}>{tk.seatLabel || tk.seat || ''} · ${tk.price ?? ''}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={styles.userModalFooter}>
                <TouchableOpacity onPress={() => { setSelectedUser(null); setEditingUserId(selectedUser.id); }} style={styles.userModalEditBtn}>
                  <Ionicons name="pencil-outline" size={15} color={colors.orange} />
                  <Text style={styles.userModalEditBtnText}>{t('Editar perfil', 'Edit Profile')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.userModalCloseBtn}>
                  <Text style={styles.userModalCloseBtnText}>{t('Cerrar', 'Close')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        )}

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showCreateUser && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowCreateUser(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowCreateUser(false)} activeOpacity={1} />
            <View style={[styles.userModal, { maxHeight: '92%' }]}>
              <View style={styles.userModalHeader}>
                <View style={[styles.userInitialsAvatarLg, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                  <Ionicons name="person-add-outline" size={22} color={colors.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userModalName}>{t('Nuevo usuario', 'New user')}</Text>
                  <Text style={styles.userModalSub}>{t('Crea una cuenta manualmente', 'Create an account manually')}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCreateUser(false)} style={styles.userModalClose}>
                  <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 10 }}>
                <View style={styles.twoColRow}>
                  <View style={styles.col}><FieldLabel label={t('Nombre', 'First name')} /><TextInput value={cuForm.firstName} onChangeText={(v) => setCu('firstName', v)} style={styles.input} /></View>
                  <View style={styles.col}><FieldLabel label={t('Apellido', 'Last name')} /><TextInput value={cuForm.lastName} onChangeText={(v) => setCu('lastName', v)} style={styles.input} /></View>
                </View>
                <FieldLabel label={t('Usuario', 'Username')} />
                <TextInput value={cuForm.username} onChangeText={(v) => setCu('username', v)} autoCapitalize="none" style={styles.input} />
                <FieldLabel label={t('Email', 'Email')} />
                <TextInput value={cuForm.email} onChangeText={(v) => setCu('email', v)} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
                <FieldLabel label={t('Teléfono', 'Phone')} />
                <TextInput value={cuForm.phone} onChangeText={(v) => setCu('phone', v)} keyboardType="phone-pad" style={styles.input} />
                <FieldLabel label={t('Contraseña (opcional)', 'Password (optional)')} />
                <TextInput value={cuForm.password} onChangeText={(v) => setCu('password', v)} secureTextEntry style={styles.input} />
                <FieldLabel label={t('Rol', 'Role')} />
                <View style={styles.segmentGroup}>
                  {(['client', 'organizer', 'admin'] as const).map((role) => (
                    <TouchableOpacity key={role} onPress={() => setCu('role', role)} style={[styles.segment, cuForm.role === role && styles.segmentActive]}>
                      <Text style={[styles.segmentText, cuForm.role === role && styles.segmentTextActive]}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={[styles.userModalFooter, { justifyContent: 'flex-end', gap: 10 }]}>
                <TouchableOpacity onPress={() => setShowCreateUser(false)} style={styles.userModalCloseBtn}>
                  <Text style={styles.userModalCloseBtnText}>{t('Cancelar', 'Cancel')}</Text>
                </TouchableOpacity>
                <GradientButton label={creatingUser ? t('CREANDO...', 'CREATING...') : t('CREAR USUARIO', 'CREATE USER')} onPress={createUserApi} height={44} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Create Category Modal ─────────────────────────────────────────── */}
      {showCreateCategory && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowCreateCategory(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowCreateCategory(false)} activeOpacity={1} />
            <View style={[styles.userModal, { maxHeight: '96%' }]}>
              <View style={styles.userModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userModalName}>{t('Nueva categoría', 'New category')}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCreateCategory(false)} style={styles.userModalClose}>
                  <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 10 }}>
                <FieldLabel label={t('Nombre (ES):', 'Nombre (ES):')} />
                <TextInput value={categoryForm.labelEs} onChangeText={(v) => setCategoryForm((f) => ({ ...f, labelEs: v }))} placeholder={t('ej. Concierto', 'e.g. Concert')} placeholderTextColor="#9CA3AF" style={styles.input} />
                <FieldLabel label="Name (EN):" />
                <TextInput value={categoryForm.labelEn} onChangeText={(v) => setCategoryForm((f) => ({ ...f, labelEn: v }))} placeholder="e.g. Concert" placeholderTextColor="#9CA3AF" style={styles.input} />
                <FieldLabel label={t('Slug (auto-generado):', 'Slug (auto-generated):')} />
                <TextInput value={categoryForm.labelEs ? categoryForm.labelEs.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''} editable={false} placeholderTextColor="#9CA3AF" style={[styles.input, { opacity: 0.5 }]} />
                <FieldLabel label={t('Orden:', 'Order:')} />
                <TextInput value={String(categoryForm.sortOrder)} onChangeText={(v) => setCategoryForm((f) => ({ ...f, sortOrder: Number(v) || 0 }))} keyboardType="number-pad" style={styles.input} />
                <FieldLabel label={t('Ícono:', 'Icon:')} />
                <View style={styles.catIconGrid}>
                  {PRESET_ICONS.map((icon) => (
                    <TouchableOpacity key={icon} onPress={() => setCategoryForm((f) => ({ ...f, icon }))} style={[styles.catIconPicker, categoryForm.icon === icon && { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.14)' }]}>
                      <Text style={{ fontSize: 22 }}>{icon}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.catSelectedIconBox}>
                  <Text style={{ fontSize: 28 }}>{categoryForm.icon}</Text>
                </View>
                <FieldLabel label={t('Color:', 'Color:')} />
                <View style={styles.catColorGrid}>
                  {PRESET_COLORS.map((color) => (
                    <TouchableOpacity key={color} onPress={() => setCategoryForm((f) => ({ ...f, color }))} style={[styles.catColorSwatch, { backgroundColor: color }, categoryForm.color === color && styles.catColorSwatchSelected]} />
                  ))}
                </View>
                <Text style={styles.catColorHex}>{categoryForm.color}</Text>
                <FieldLabel label={t('Imagen de la categoría (opcional):', 'Category image (optional):')} />
                <View style={styles.catImageRow}>
                  {categoryForm.imageData ? (
                    <Image source={{ uri: categoryForm.imageData }} style={styles.catImageThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.catImageEmpty}><Ionicons name="image-outline" size={28} color="rgba(226,232,240,0.3)" /></View>
                  )}
                  <TouchableOpacity onPress={() => pickCategoryImage('create')} style={styles.catImagePickBtn}>
                    <Text style={styles.catImagePickText}>{t('Subir imagen', 'Upload image')}</Text>
                  </TouchableOpacity>
                </View>
                <FieldLabel label={t('Vista previa:', 'Preview:')} />
                <View style={[styles.catPreviewPill, { backgroundColor: categoryForm.color }]}>
                  <Text style={styles.catPreviewPillText}>{categoryForm.icon} {categoryForm.labelEs || t('Nombre', 'Name')}</Text>
                </View>
              </ScrollView>
              <View style={[styles.userModalFooter, { gap: 10 }]}>
                <TouchableOpacity onPress={() => setShowCreateCategory(false)} style={[styles.userModalCloseBtn, { flex: 1, alignItems: 'center' }]}>
                  <Text style={styles.userModalCloseBtnText}>{t('Cancelar', 'Cancel')}</Text>
                </TouchableOpacity>
                <GradientButton label={savingCategory ? t('CREANDO...', 'CREATING...') : t('CREAR CATEGORÍA', 'CREATE CATEGORY')} onPress={addCategory} height={44} style={{ flex: 2 }} />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Edit Category Modal ───────────────────────────────────────────── */}
      {editingCategoryModal && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditingCategoryModal(null)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditingCategoryModal(null)} activeOpacity={1} />
            <View style={[styles.userModal, { maxHeight: '92%' }]}>
              <View style={styles.userModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userModalName}>{editingCategoryModal.name}</Text>
                  <Text style={styles.userModalSub}>{editingCategoryModal.slug}</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingCategoryModal(null)} style={styles.userModalClose}>
                  <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 10 }}>
                <FieldLabel label={t('Nombre (ES):', 'Name (ES):')} />
                <TextInput value={editCategoryForm.labelEs} onChangeText={(v) => setEditCategoryForm((f) => ({ ...f, labelEs: v }))} style={styles.input} />
                <FieldLabel label="Name (EN):" />
                <TextInput value={editCategoryForm.labelEn} onChangeText={(v) => setEditCategoryForm((f) => ({ ...f, labelEn: v }))} style={styles.input} />
                <FieldLabel label={t('Color:', 'Color:')} />
                <View style={styles.catColorGrid}>
                  {PRESET_COLORS.map((color) => (
                    <TouchableOpacity key={color} onPress={() => setEditCategoryForm((f) => ({ ...f, color }))} style={[styles.catColorSwatch, { backgroundColor: color }, editCategoryForm.color === color && styles.catColorSwatchSelected]} />
                  ))}
                </View>
                <View style={[styles.catColorHexBox, { backgroundColor: editCategoryForm.color }]} />
                <Text style={styles.catColorHex}>{editCategoryForm.color}</Text>
                <FieldLabel label={t('Imagen de la categoría:', 'Category image:')} />
                <View style={styles.catImageRow}>
                  {editCategoryForm.imageData ? (
                    <Image source={{ uri: editCategoryForm.imageData }} style={styles.catImageThumb} resizeMode="cover" />
                  ) : editingCategoryModal.imageData ? (
                    <Image source={{ uri: editingCategoryModal.imageData }} style={styles.catImageThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.catImageEmpty}><Ionicons name="image-outline" size={28} color="rgba(226,232,240,0.3)" /></View>
                  )}
                  <TouchableOpacity onPress={() => pickCategoryImage('edit')} style={styles.catImagePickBtn}>
                    <Text style={styles.catImagePickText}>{t('Cambiar imagen', 'Change image')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
              <View style={[styles.userModalFooter, { gap: 10 }]}>
                <TouchableOpacity onPress={() => setEditingCategoryModal(null)} style={[styles.userModalCloseBtn, { flex: 1, alignItems: 'center' }]}>
                  <Text style={styles.userModalCloseBtnText}>{t('Cancelar', 'Cancel')}</Text>
                </TouchableOpacity>
                <GradientButton label={savingCategory ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR', 'SAVE')} onPress={() => saveCategoryToApi(editingCategoryModal.id)} height={44} style={{ flex: 2 }} />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Edit Code Modal ───────────────────────────────────────────────── */}
      {editingCode && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setEditingCode(null)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditingCode(null)} activeOpacity={1} />
            <View style={[styles.userModal, { maxHeight: '88%' }]}>
              <View style={styles.userModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userModalName}>{t('Editar código', 'Edit code')}: {editingCode.code}</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingCode(null)} style={styles.userModalClose}>
                  <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 10 }}>
                <FieldLabel label={t('CÓDIGO', 'CODE')} />
                <TextInput value={editCodeForm.code} onChangeText={(v) => setEditCodeForm((f) => ({ ...f, code: v.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))} autoCapitalize="characters" style={styles.input} />
                <FieldLabel label={t('CODE OWNER', 'CODE OWNER')} />
                <TextInput
                  value={editCodeOwnerQuery}
                  onChangeText={(v) => { setEditCodeOwnerQuery(v); searchEditCodeOwner(v); }}
                  placeholder={t('Buscar usuario...', 'Search user...')}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                {editCodeOwnerResults.length > 0 && (
                  <View style={styles.ownerResultsList}>
                    {editCodeOwnerResults.map((u) => (
                      <TouchableOpacity key={u.id} onPress={() => { setEditCodeForm((f) => ({ ...f, ownerUserId: u.id, ownerName: u.name, ownerEmail: u.email })); setEditCodeOwnerQuery(`${u.name} (${u.email})`); setEditCodeOwnerResults([]); }} style={styles.ownerResultRow}>
                        <Text style={styles.ownerResultName}>{u.name}</Text>
                        <Text style={styles.ownerResultEmail}>{u.email}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {editCodeForm.ownerUserId ? (
                  <View style={styles.ownerSelectedRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                    <Text style={styles.ownerSelectedText} numberOfLines={1}>{editCodeForm.ownerName || editCodeForm.ownerEmail || editCodeForm.ownerUserId}</Text>
                  </View>
                ) : null}
                <FieldLabel label={t('EVENTO', 'EVENT')} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
                    <TouchableOpacity onPress={() => setEditCodeForm((f) => ({ ...f, eventId: '' }))} style={[styles.codeEventPill, !editCodeForm.eventId && styles.codeEventPillActive]}>
                      <Text style={[styles.codeEventPillText, !editCodeForm.eventId && styles.codeEventPillTextActive]}>{t('Todos', 'All')}</Text>
                    </TouchableOpacity>
                    {adminEvents.slice(0, 10).map((ev) => (
                      <TouchableOpacity key={ev.id} onPress={() => setEditCodeForm((f) => ({ ...f, eventId: ev.id }))} style={[styles.codeEventPill, editCodeForm.eventId === ev.id && styles.codeEventPillActive]}>
                        <Text style={[styles.codeEventPillText, editCodeForm.eventId === ev.id && styles.codeEventPillTextActive]} numberOfLines={1}>{adminEventTitle(ev)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <TouchableOpacity onPress={() => setEditCodeForm((f) => ({ ...f, isActive: !f.isActive }))} style={styles.codeActiveRow}>
                  <View style={[styles.codeActiveCheck, editCodeForm.isActive && styles.codeActiveCheckOn]}>
                    {editCodeForm.isActive && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.codeActiveLabel}>{t('Activo', 'Active')}</Text>
                </TouchableOpacity>
              </ScrollView>
              <View style={[styles.userModalFooter, { gap: 10 }]}>
                <TouchableOpacity onPress={() => setEditingCode(null)} style={[styles.userModalCloseBtn, { flex: 1, alignItems: 'center' }]}>
                  <Text style={styles.userModalCloseBtnText}>{t('Cancelar', 'Cancel')}</Text>
                </TouchableOpacity>
                <GradientButton label={t('GUARDAR', 'SAVE')} onPress={saveEditCode} height={44} style={{ flex: 2 }} />
              </View>
            </View>
          </View>
        </Modal>
      )}

        {active === 'categories' && (
          <>
            {/* Header row: count + NUEVA CATEGORÍA button */}
            <View style={styles.catHeaderRow}>
              <Text style={styles.catCount}>{categories.length} {t('categorías', 'categories')} — {t('los organizadores las verán al crear eventos', 'organizers see them when creating events')}</Text>
              <TouchableOpacity onPress={() => { setCategoryForm({ ...emptyCategForm }); setShowCreateCategory(true); }} style={styles.catNewBtn}>
                <Text style={styles.catNewBtnText}>{t('NUEVA\nCATEGORÍA', 'NEW\nCATEGORY')}</Text>
              </TouchableOpacity>
            </View>

            {categories.map((category) => (
              <View key={category.id} style={styles.catCard}>
                <View style={styles.catCardLeft}>
                  <View style={[styles.catIconBox, { backgroundColor: `${category.color}22`, borderColor: `${category.color}66` }]}>
                    <Text style={styles.catIconText}>{category.icon || '🎫'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.catCardName} numberOfLines={1}>{category.name}</Text>
                    <Text style={styles.catCardSlug} numberOfLines={1}>{category.slug}</Text>
                    <StatusPill label={category.active ? t('ACTIVA', 'ACTIVE') : t('INACTIVA', 'INACTIVE')} tone={category.active ? 'green' : 'red'} compact />
                  </View>
                </View>
                <View style={styles.catCardActions}>
                  <TouchableOpacity onPress={() => { setEditingCategoryModal(category); setEditCategoryForm({ labelEs: category.labelEs, labelEn: category.labelEn, icon: category.icon, color: category.color, sortOrder: category.sortOrder, imageData: category.imageData || '' }); }} style={styles.catActionBtn}>
                    <Ionicons name="pencil-outline" size={17} color="#94A3B8" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteCategoryApi(category.id)} style={[styles.catActionBtn, { borderColor: 'rgba(239,68,68,0.28)' }]}>
                    <Ionicons name="trash-outline" size={17} color="#FCA5A5" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {active === 'marketing' && (
          <>
            <PanelCard title={t('Marketing', 'Marketing')} eyebrow={t('CONTROL DE MARKETING', 'MARKETING CONTROL')} copy={t('Administra lo que aparece en el home, banners, destacados y promociones.', 'Manage what appears on the home page, banners, featured events and promotions.')}>
              <View style={styles.bannerPreviewCard}>
                <View style={styles.bannerPreviewPill}>
                  <Text style={styles.bannerPreviewPillText}>{t('BANNER HOME', 'HOME BANNER')}</Text>
                </View>
                <Text style={styles.bannerPreviewTitle}>{t('Tu entrada a grandes experiencias', 'Your access to great experiences')}</Text>
                <Text style={styles.bannerPreviewCopy}>{t('Conciertos, teatro, talleres, networking y eventos privados.', 'Concerts, theater, workshops, networking and private events.')}</Text>
              </View>
            </PanelCard>

            <PanelCard title={t('Gestión de banner', 'Banner management')} eyebrow={t('HOME', 'HOME')} copy={t('Sube la imagen del banner del home (escritorio y móvil).', 'Upload the home banner image (desktop and mobile).')}>
              <View style={styles.twoColRow}>
                <View style={styles.col}>
                  <FieldLabel label={t('Escritorio', 'Desktop')} />
                  {bannerDesktop ? <Image source={{ uri: bannerDesktop.data }} style={styles.bannerThumb} resizeMode="cover" /> : <View style={styles.bannerThumbEmpty}><Text style={styles.bannerThumbText}>16:9</Text></View>}
                  <TouchableOpacity onPress={() => pickBanner('desktop')} style={styles.bannerPickBtn}><Text style={styles.bannerPickText}>{bannerDesktop ? t('CAMBIAR', 'CHANGE') : t('SELECCIONAR', 'SELECT')}</Text></TouchableOpacity>
                </View>
                <View style={styles.col}>
                  <FieldLabel label={t('Móvil (opcional)', 'Mobile (optional)')} />
                  {bannerMobile ? <Image source={{ uri: bannerMobile.data }} style={styles.bannerThumb} resizeMode="cover" /> : <View style={styles.bannerThumbEmpty}><Text style={styles.bannerThumbText}>9:16</Text></View>}
                  <TouchableOpacity onPress={() => pickBanner('mobile')} style={styles.bannerPickBtn}><Text style={styles.bannerPickText}>{bannerMobile ? t('CAMBIAR', 'CHANGE') : t('SELECCIONAR', 'SELECT')}</Text></TouchableOpacity>
                </View>
              </View>
              <GradientButton label={publishingBanner ? t('PUBLICANDO...', 'PUBLISHING...') : t('PUBLICAR BANNER', 'PUBLISH BANNER')} onPress={publishBanner} height={48} style={{ marginTop: 12 }} />
              <View style={styles.bannerDeleteRow}>
                <TouchableOpacity onPress={() => deleteBanner('home')} style={styles.bannerDeleteBtn}><Text style={styles.bannerDeleteText}>{t('Borrar escritorio', 'Delete desktop')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deleteBanner('home-mobile')} style={styles.bannerDeleteBtn}><Text style={styles.bannerDeleteText}>{t('Borrar móvil', 'Delete mobile')}</Text></TouchableOpacity>
              </View>
            </PanelCard>

            <MarketingRow
              title={t('Banner principal', 'Main banner')}
              copy={t('Imagen principal del home y carrusel superior.', 'Main home image and top carousel.')}
              enabled={marketingBannerEnabled}
              onToggle={() => setMarketingBannerEnabled(!marketingBannerEnabled)}
            />

            <MarketingRow
              title={t('Eventos destacados', 'Featured events')}
              copy={t('Controla los eventos que aparecen como destacados.', 'Control events that appear as featured.')}
              enabled={marketingFeaturedEnabled}
              onToggle={() => setMarketingFeaturedEnabled(!marketingFeaturedEnabled)}
            />

            <MarketingRow
              title={t('Promociones', 'Promotions')}
              copy={t('Activa mensajes comerciales, descuentos o campanas.', 'Enable commercial messages, discounts or campaigns.')}
              enabled={marketingPromoEnabled}
              onToggle={() => setMarketingPromoEnabled(!marketingPromoEnabled)}
            />

            <PanelCard title={t('Orden de aparicion', 'Display order')} eyebrow={t('ORDEN VISUAL', 'DISPLAY ORDER')} copy={t('Define el orden visual del home movil.', 'Define the visual order of the mobile home screen.')}>
              <OrderItem index="01" title={t('Banner principal', 'Main banner')} />
              <OrderItem index="02" title={t('Buscador', 'Search')} />
              <OrderItem index="03" title={t('Beneficios / seguridad', 'Benefits / security')} />
              <OrderItem index="04" title={t('Eventos destacados', 'Featured events')} />
            </PanelCard>
          </>
        )}
        {active === 'analytics' && (
          <>
            {/* ─── Header ─── */}
            <View style={styles.anHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.anTitle}>{t('Analíticas', 'Analytics')}</Text>
                <Text style={styles.anSubtitle}>{t('Visitas del sitio y eventos más vistos', 'Site visits and most viewed events')}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const opts = [1, 7, 30, 90] as const;
                  const next = opts[(opts.indexOf(analyticsDays as 1 | 7 | 30 | 90) + 1) % opts.length];
                  setAnalyticsDays(next);
                }}
                style={styles.anDayBtn}
              >
                <Text style={styles.anDayBtnText}>
                  {analyticsDays === 1 ? t('Últimas 24h', 'Last 24 hours') : analyticsDays === 7 ? t('Últimos 7 días', 'Last 7 days') : analyticsDays === 30 ? t('Últimos 30 días', 'Last 30 days') : t('Últimos 90 días', 'Last 90 days')}
                </Text>
                <Ionicons name="chevron-down" size={14} color="rgba(226,232,240,0.6)" />
              </TouchableOpacity>
            </View>

            {/* ─── Stat cards 2-col grid ─── */}
            <View style={styles.anStatGrid}>
              {[
                { label: t('Total views', 'Total views'), value: analyticsSummary?.totalViews ?? 0, icon: 'eye-outline' as const },
                { label: t('Unique visitors', 'Unique visitors'), value: analyticsSummary?.uniqueVisitors ?? 0, icon: 'people-outline' as const },
                { label: t('Viewed events', 'Viewed events'), value: analyticsSummary?.topEvents.length ?? 0, icon: 'flash-outline' as const },
                { label: t('Viewed pages', 'Viewed pages'), value: (analyticsSummary?.topPages ?? []).length, icon: 'bar-chart-outline' as const },
              ].map((s) => (
                <View key={s.label} style={styles.anStatCard}>
                  <View style={styles.anStatTop}>
                    <Text style={styles.anStatLabel}>{s.label}</Text>
                    <View style={styles.anStatIconBox}><Ionicons name={s.icon} size={16} color={colors.orange} /></View>
                  </View>
                  <Text style={styles.anStatValue}>{s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : String(s.value)}</Text>
                </View>
              ))}
            </View>

            {analyticsLoading && (
              <View style={styles.anStatCard}><Text style={styles.anStatLabel}>{t('Cargando...', 'Loading...')}</Text></View>
            )}

            {/* ─── Top events ─── */}
            {(analyticsSummary?.topEvents ?? []).length > 0 && (
              <View style={styles.anSection}>
                <Text style={styles.anSectionTitle}>{t('Top events', 'Top events')}</Text>
                {(analyticsSummary?.topEvents ?? []).slice(0, 5).map((ev, i) => (
                  <View key={ev.eventSlug} style={styles.anRankRow}>
                    <View style={styles.anRankNum}><Text style={styles.anRankNumText}>{i + 1}</Text></View>
                    <Text style={styles.anRankTitle} numberOfLines={1}>{ev.eventTitle || formatEventSlug(ev.eventSlug)}</Text>
                    <Text style={styles.anRankMeta}>{ev.views} {t('views', 'views')} · {ev.visitors} {t('visitors', 'visitors')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ─── Top pages ─── */}
            {(analyticsSummary?.topPages ?? []).length > 0 && (
              <View style={styles.anSection}>
                <Text style={styles.anSectionTitle}>{t('Top pages', 'Top pages')}</Text>
                {(analyticsSummary?.topPages ?? []).slice(0, 5).map((page, i) => (
                  <View key={page.path} style={styles.anRankRow}>
                    <View style={styles.anRankNum}><Text style={styles.anRankNumText}>{i + 1}</Text></View>
                    <Text style={styles.anRankTitle} numberOfLines={1}>{page.path}</Text>
                    <Text style={styles.anRankMeta}>{page.views} {t('views', 'views')} · {page.visitors} {t('visitors', 'visitors')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ─── Recent activity ─── */}
            {(analyticsSummary?.recentViews ?? []).length > 0 && (
              <View style={styles.anSection}>
                <TouchableOpacity onPress={() => setAnalyticsRecentOpen((v) => !v)} style={styles.anRecentHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.anSectionTitle}>{t('Recent activity', 'Recent activity')}</Text>
                    <Text style={styles.anRecentCount}>{analyticsSummary!.recentViews.length} {t('views', 'views')}</Text>
                  </View>
                  <View style={styles.anRecentToggle}>
                    <Ionicons name={analyticsRecentOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.orange} />
                  </View>
                </TouchableOpacity>
                {analyticsRecentOpen && (
                  <ScrollView style={styles.anTableScroll} nestedScrollEnabled showsVerticalScrollIndicator>
                    <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
                      <View style={styles.anTableInner}>
                        <View style={styles.anTableHeader}>
                          <Text style={styles.anTableColPath}>PATH</Text>
                          <Text style={styles.anTableColEvent}>EVENT</Text>
                        </View>
                        {analyticsSummary!.recentViews.map((view) => (
                          <View key={view.id} style={styles.anTableRow}>
                            <Text style={styles.anTablePath} numberOfLines={1}>{view.path}</Text>
                            <Text style={styles.anTableEvent} numberOfLines={1}>{view.eventSlug ? view.eventSlug.split('-').slice(0, 3).join('-') + (view.eventSlug.split('-').length > 3 ? '...' : '') : '-'}</Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </ScrollView>
                )}
              </View>
            )}

            {!analyticsLoading && !analyticsSummary && (
              <View style={styles.anStatCard}>
                <Text style={styles.anStatLabel}>{t('Sin datos todavía. Las analíticas aparecerán cuando haya actividad.', 'No data yet. Analytics will appear once there is activity.')}</Text>
              </View>
            )}
          </>
        )}
        {active === 'codes' && (
          <>
            {/* Refresh + stats */}
            <GradientButton label={codesLoading ? t('Actualizando...', 'Updating...') : t('Refresh', 'Refresh')} onPress={() => { setCodesLoaded(false); setCodesLoading(false); }} height={42} style={{ marginBottom: 14 }} />

            {!codesLoading && (
              <>
                <View style={styles.codeStatRow}>
                  <View style={styles.codeStatCard}>
                    <View style={styles.codeStatTop}><Text style={styles.codeStatLabel}>{t('TOTAL', 'TOTAL')}</Text><Ionicons name="pricetag-outline" size={18} color={colors.orange} /></View>
                    <Text style={styles.codeStatValue}>{apiCodes.length}</Text>
                  </View>
                  <View style={styles.codeStatCard}>
                    <View style={styles.codeStatTop}><Text style={styles.codeStatLabel}>{t('ACTIVE', 'ACTIVE')}</Text><Ionicons name="checkmark-circle-outline" size={18} color="#4ADE80" /></View>
                    <Text style={styles.codeStatValue}>{apiCodes.filter((c) => c.isActive).length}</Text>
                  </View>
                  <View style={styles.codeStatCard}>
                    <View style={styles.codeStatTop}><Text style={styles.codeStatLabel}>{t('GLOBAL', 'GLOBAL')}</Text><Ionicons name="calendar-outline" size={18} color={colors.orange} /></View>
                    <Text style={styles.codeStatValue}>{apiCodes.filter((c) => !c.eventId).length}</Text>
                  </View>
                </View>
              </>
            )}

            {codesError ? <PanelCard title={t('Error', 'Error')} copy={codesError} /> : null}

            {/* Create code card */}
            <View style={styles.codeCreateCard}>
              <View style={styles.codeCreateHeader}>
                <View style={styles.codeCreateIcon}><Ionicons name="qr-code-outline" size={20} color={colors.orange} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.codeCreateTitle}>{t('Create code', 'Create code')}</Text>
                  <Text style={styles.codeCreateSub}>{t('La recompensa se configura por evento y se paga manualmente.', 'Reward is configured per event and paid manually.')}</Text>
                </View>
              </View>

              <FieldLabel label={t('CODE', 'CODE')} />
              <TextInput value={specialCodeDraft} onChangeText={(v) => setSpecialCodeDraft(v.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="MARIA" placeholderTextColor="#9CA3AF" autoCapitalize="characters" style={styles.codeInput} />

              <FieldLabel label={t('CODE OWNER', 'CODE OWNER')} />
              <View style={styles.ownerSearchBox}>
                <TextInput
                  value={ownerSearchQuery}
                  onChangeText={(v) => { setOwnerSearchQuery(v); searchOwnerUsers(v); }}
                  placeholder={t('Buscar usuario...', 'Search user...')}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.codeInput}
                />
                {ownerSearching && <Text style={styles.ownerSearchingText}>...</Text>}
              </View>
              {ownerSearchResults.length > 0 && (
                <View style={styles.ownerResultsList}>
                  {ownerSearchResults.map((u) => (
                    <TouchableOpacity key={u.id} onPress={() => { setSpecialCodeOwnerDraft(u.id); setOwnerSearchQuery(`${u.name} (${u.email})`); setOwnerSearchResults([]); }} style={styles.ownerResultRow}>
                      <Text style={styles.ownerResultName}>{u.name}</Text>
                      <Text style={styles.ownerResultEmail}>{u.email}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {specialCodeOwnerDraft ? (
                <View style={styles.ownerSelectedRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                  <Text style={styles.ownerSelectedText} numberOfLines={1}>{ownerSearchQuery || specialCodeOwnerDraft}</Text>
                  <TouchableOpacity onPress={() => { setSpecialCodeOwnerDraft(''); setOwnerSearchQuery(''); setOwnerSearchResults([]); }}>
                    <Ionicons name="close-circle" size={16} color="rgba(226,232,240,0.4)" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <FieldLabel label={t('EVENT', 'EVENT')} />
              <View style={styles.codeEventPicker}>
                <TouchableOpacity style={styles.codeEventPickerInner} onPress={() => setCodeEventId('')}>
                  <Text style={[styles.codeEventPickerText, !codeEventId && { color: colors.orange }]}>{!codeEventId ? t('Todos los eventos', 'All events') : adminEvents.find((e) => e.id === codeEventId)?.title || t('Todos los eventos', 'All events')}</Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(226,232,240,0.5)" />
                </TouchableOpacity>
              </View>
              {adminEvents.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
                    <TouchableOpacity onPress={() => setCodeEventId('')} style={[styles.codeEventPill, !codeEventId && styles.codeEventPillActive]}>
                      <Text style={[styles.codeEventPillText, !codeEventId && styles.codeEventPillTextActive]}>{t('Todos', 'All')}</Text>
                    </TouchableOpacity>
                    {adminEvents.slice(0, 10).map((ev) => (
                      <TouchableOpacity key={ev.id} onPress={() => setCodeEventId(ev.id)} style={[styles.codeEventPill, codeEventId === ev.id && styles.codeEventPillActive]}>
                        <Text style={[styles.codeEventPillText, codeEventId === ev.id && styles.codeEventPillTextActive]} numberOfLines={1}>{adminEventTitle(ev)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              <TouchableOpacity onPress={() => setCodeActiveCreate((v) => !v)} style={styles.codeActiveRow}>
                <View style={[styles.codeActiveCheck, codeActiveCreate && styles.codeActiveCheckOn]}>
                  {codeActiveCreate && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                </View>
                <Text style={styles.codeActiveLabel}>{t('Activo', 'Active')}</Text>
              </TouchableOpacity>

              <GradientButton label={t('+ CREATE CODE', '+ CREATE CODE')} onPress={addSpecialCode} height={48} style={{ marginTop: 8 }} />
            </View>

            {/* Created codes list */}
            <View style={styles.createdCodesHeader}>
              <View>
                <Text style={styles.createdCodesTitle}>{t('Created codes', 'Created codes')}</Text>
                <Text style={styles.createdCodesSub}>{t('Activa o pausa códigos sin eliminarlos.', 'Activate or pause codes without deleting them.')}</Text>
              </View>
            </View>

            {/* Search */}
            <View style={[styles.userSearchBox, { marginBottom: 10 }]}>
              <Text style={styles.userSearchIcon}>⌕</Text>
              <TextInput value={codeSearch} onChangeText={setCodeSearch} placeholder={t('Buscar...', 'Search...')} placeholderTextColor="rgba(226,232,240,0.38)" autoCapitalize="none" autoCorrect={false} style={styles.userSearchInput} />
            </View>

            {codesLoading && <PanelCard title={t('Cargando...', 'Loading...')} />}

            {apiCodes.filter((item) => {
              const term = codeSearch.trim().toLowerCase();
              if (!term) return true;
              const ownerStr = `${item.owner?.firstName || ''} ${item.owner?.lastName || ''} ${item.owner?.email || ''}`.toLowerCase();
              return item.code.toLowerCase().includes(term) || ownerStr.includes(term) || (item.event?.title || '').toLowerCase().includes(term);
            }).map((item) => {
              const ownerName = [item.owner?.firstName, item.owner?.lastName].filter(Boolean).join(' ') || item.owner?.email || item.ownerUserId.slice(0, 8);
              return (
                <View key={item.id} style={styles.codeCard2}>
                  <Text style={styles.codeCard2Label}>{t('CÓDIGO', 'CODE')}</Text>
                  <Text style={styles.codeCard2Code}>{item.code}</Text>
                  <Text style={styles.codeCard2Label}>{t('OWNER', 'OWNER')}</Text>
                  <View style={styles.codeCard2OwnerRow}>
                    <Ionicons name="person-outline" size={13} color="rgba(226,232,240,0.5)" />
                    <Text style={styles.codeCard2OwnerName}>{ownerName}</Text>
                  </View>
                  {item.owner?.email ? <Text style={styles.codeCard2OwnerEmail}>{item.owner.email}</Text> : null}
                  <Text style={styles.codeCard2Label}>{t('EVENT', 'EVENT')}</Text>
                  <Text style={styles.codeCard2Event}>{item.event?.title || t('All', 'All')}</Text>
                  <View style={styles.codeCard2Actions}>
                    <TouchableOpacity onPress={() => { setEditingCode(item); setEditCodeForm({ code: item.code, ownerUserId: item.ownerUserId, ownerName: ownerName, ownerEmail: item.owner?.email || '', eventId: item.eventId || '', isActive: item.isActive }); setEditCodeOwnerQuery(`${ownerName}${item.owner?.email ? ` (${item.owner.email})` : ''}`); setEditCodeOwnerResults([]); }} style={styles.codeEditBtn}>
                      <Ionicons name="pencil-outline" size={15} color={colors.orange} />
                      <Text style={styles.codeEditBtnText}>{t('Edit', 'Edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCodeApi(item.id)} style={styles.codeDeleteBtn}>
                      <Text style={styles.codeDeleteBtnText}>{t('Delete', 'Delete')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleSpecialCode(item.id)} style={[styles.codeStatusBtn, item.isActive ? styles.codeStatusBtnActive : styles.codeStatusBtnInactive]}>
                      <Ionicons name={item.isActive ? 'checkmark-circle-outline' : 'close-circle-outline'} size={14} color={item.isActive ? '#4ADE80' : '#94A3B8'} />
                      <Text style={[styles.codeStatusBtnText, { color: item.isActive ? '#4ADE80' : '#94A3B8' }]}>{item.isActive ? t('Active', 'Active') : t('Inactive', 'Inactive')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Event rewards */}
            {adminEvents.length > 0 && (
              <>
                <View style={styles.eventRewardsHeader}>
                  <View style={styles.eventRewardsIcon}><Ionicons name="cash-outline" size={20} color={colors.orange} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventRewardsTitle}>{t('Event rewards', 'Event rewards')}</Text>
                    <Text style={styles.eventRewardsSub}>{t('Administra la recompensa base por evento cuando se usa un código de creador.', 'Manage the base reward per event when creator codes are used.')}</Text>
                  </View>
                </View>
                {adminEvents.map((ev) => {
                  const orgName = [ev.organizer?.firstName, ev.organizer?.lastName].filter(Boolean).join(' ') || ev.organizerName || '-';
                  const current = Number(ev.creatorCommission || 0);
                  const rewardVal = eventRewards[ev.id] !== undefined ? eventRewards[ev.id] : current.toFixed(2);
                  return (
                    <View key={ev.id} style={styles.eventRewardCard}>
                      <Text style={styles.eventRewardFieldLabel}>{t('EVENT', 'EVENT')}</Text>
                      <Text style={styles.eventRewardEventTitle}>{adminEventTitle(ev)}</Text>
                      <Text style={styles.eventRewardFieldLabel}>{t('ORGANIZER', 'ORGANIZER')}</Text>
                      <Text style={styles.eventRewardOrgName}>{orgName}</Text>
                      <Text style={styles.eventRewardFieldLabel}>{t('CURRENT', 'CURRENT')}</Text>
                      <Text style={styles.eventRewardCurrent}>${current.toFixed(2)}</Text>
                      <Text style={styles.eventRewardFieldLabel}>{t('BASE REWARD ($)', 'BASE REWARD ($)')}</Text>
                      <TextInput
                        value={rewardVal}
                        onChangeText={(v) => setEventRewards((prev) => ({ ...prev, [ev.id]: v }))}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                      />
                      <GradientButton
                        label={savingEventReward === ev.id ? t('GUARDANDO...', 'SAVING...') : t('SAVE', 'SAVE')}
                        onPress={() => saveEventReward(ev.id)}
                        height={44}
                        style={{ marginTop: 10 }}
                      />
                    </View>
                  );
                })}
              </>
            )}

            {/* Commission summary with payouts */}
            {commissionSummary.length > 0 && (
              <>
                <Text style={styles.codePanelTitle}>{t('Comisiones por evento', 'Commissions by event')}</Text>
                <Text style={[styles.codePanelCopy, { marginBottom: 12 }]}>{t('Registra pagos y revisa el historial.', 'Record payouts and review history.')}</Text>
                {commissionSummary.map((entry, idx) => {
                  const key = `${entry.ownerUserId}-${entry.eventId || idx}`;
                  const isPayoutOpen = payoutEntry?.ownerUserId === entry.ownerUserId && payoutEntry?.eventId === entry.eventId;
                  return (
                    <View key={key} style={styles.commissionCard}>
                      <View style={styles.commissionHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.commissionOwner}>{entry.ownerName || entry.ownerEmail || entry.ownerUserId.slice(0, 8)}</Text>
                          {entry.eventTitle ? <Text style={styles.commissionEvent}>{entry.eventTitle}</Text> : null}
                        </View>
                        <View style={styles.commissionBadge}>
                          <Text style={styles.commissionBalance}>${Number(entry.balance).toFixed(2)}</Text>
                          <Text style={styles.commissionBalanceLabel}>{t('saldo', 'balance')}</Text>
                        </View>
                      </View>
                      <View style={styles.commissionStats}>
                        <View style={styles.commissionStat}>
                          <Text style={styles.commissionStatLabel}>{t('GANADO', 'EARNED')}</Text>
                          <Text style={styles.commissionStatValue}>${Number(entry.totalEarned).toFixed(2)}</Text>
                        </View>
                        <View style={styles.commissionStat}>
                          <Text style={styles.commissionStatLabel}>{t('PAGADO', 'PAID')}</Text>
                          <Text style={[styles.commissionStatValue, { color: '#10B981' }]}>${Number(entry.totalPaid).toFixed(2)}</Text>
                        </View>
                        {entry.totalTickets != null && (
                          <View style={styles.commissionStat}>
                            <Text style={styles.commissionStatLabel}>{t('TICKETS', 'TICKETS')}</Text>
                            <Text style={styles.commissionStatValue}>{entry.totalTickets}</Text>
                          </View>
                        )}
                      </View>
                      {entry.payouts && entry.payouts.length > 0 && (
                        <View style={styles.payoutHistory}>
                          {entry.payouts.map((p) => (
                            <Text key={p.id} style={styles.payoutHistoryItem}>
                              ${Number(p.amount).toFixed(2)} · {new Date(p.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}{p.note ? ` · ${p.note}` : ''}
                            </Text>
                          ))}
                        </View>
                      )}
                      <TouchableOpacity
                        onPress={() => {
                          if (isPayoutOpen) { setPayoutEntry(null); return; }
                          setPayoutEntry(entry);
                          setPayoutAmount('');
                          setPayoutNote('');
                        }}
                        style={[styles.codePrimaryAction, { marginTop: 10 }]}
                      >
                        <Text style={styles.codePrimaryText}>{isPayoutOpen ? t('CANCELAR', 'CANCEL') : t('REGISTRAR PAGO', 'RECORD PAYOUT')}</Text>
                      </TouchableOpacity>
                      {isPayoutOpen && (
                        <View style={{ marginTop: 10, gap: 8 }}>
                          <TextInput value={payoutAmount} onChangeText={setPayoutAmount} placeholder={t('Monto ($)', 'Amount ($)')} placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" style={styles.inlinePanelInput} />
                          <TextInput value={payoutNote} onChangeText={setPayoutNote} placeholder={t('Nota (opcional)', 'Note (optional)')} placeholderTextColor="#9CA3AF" style={styles.inlinePanelInput} />
                          <TouchableOpacity onPress={recordPayout} style={styles.inlinePanelSave} disabled={payoutSaving}>
                            <Text style={styles.inlinePanelSaveText}>{payoutSaving ? t('REGISTRANDO...', 'RECORDING...') : t('CONFIRMAR PAGO', 'CONFIRM PAYOUT')}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        {active === 'marketing' && (
          <>
            {/* ─── Hero overview ─── */}
            <View style={styles.mktHero}>
              <View style={styles.mktHeroEyebrow}>
                <Ionicons name="megaphone-outline" size={13} color={colors.orange} />
                <Text style={styles.mktHeroEyebrowText}>MARKETING</Text>
              </View>
              <Text style={styles.mktHeroTitle}>{t('Centro de marketing', 'Marketing center')}</Text>
              <Text style={styles.mktHeroCopy}>{t('Administra banners y prepara campanas visuales premium antes de activar envios reales.', 'Manage banners and prepare premium visual campaigns before activating real sends.')}</Text>
              <GradientButton
                label={t('✦ DISEÑAR EMAIL', '✦ DESIGN EMAIL')}
                onPress={() => {}}
                height={46}
                style={{ alignSelf: 'flex-start', minWidth: 170 }}
              />
              <View style={styles.mktStatGrid}>
                {[
                  { label: t('Banners activos', 'Active banners'), value: bannerStatus === 'active' ? '1' : '0', icon: 'image-outline' as const },
                  { label: t('Audiencias', 'Audiences'), value: '0', icon: 'people-outline' as const },
                  { label: t('Campanas', 'Campaigns'), value: emailArtData || campaignName ? '1' : '0', icon: 'stats-chart-outline' as const },
                  { label: t('Clicks', 'Clicks'), value: '0', icon: 'hand-left-outline' as const },
                ].map((s) => (
                  <View key={s.label} style={styles.mktStatCard}>
                    <View style={styles.mktStatCardTop}>
                      <Text style={styles.mktStatLabel}>{s.label}</Text>
                      <View style={styles.mktStatIcon}><Ionicons name={s.icon} size={18} color={colors.orange} /></View>
                    </View>
                    <Text style={styles.mktStatValue}>{s.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ─── Email designer ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktCardHeader}>
                <View style={styles.mktCardIcon}><Ionicons name="mail-outline" size={20} color={colors.orange} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>{t('Diseñador de Email Marketing', 'Email Marketing Designer')}</Text>
                  <Text style={styles.mktCardSub}>{t('Envía correos reales a los destinatarios seleccionados.', 'Send real emails to selected recipients.')}</Text>
                </View>
              </View>

              {/* Steps */}
              <View style={styles.mktStepsRow}>
                {[t('Diseño', 'Design'), t('Prueba', 'Test'), t('Envío', 'Send')].map((step, i) => (
                  <View key={step} style={styles.mktStep}>
                    <Text style={styles.mktStepNum}>{t(`PASO ${i + 1}`, `STEP ${i + 1}`)}</Text>
                    <Text style={styles.mktStepName}>{step}</Text>
                  </View>
                ))}
              </View>

              <TextInput value={campaignName} onChangeText={setCampaignName} placeholder={t('Nombre interno de campaña', 'Internal campaign name')} placeholderTextColor="rgba(226,232,240,0.35)" style={styles.mktInput} />
              <TextInput value={campaignSubjectDraft} onChangeText={setCampaignSubjectDraft} placeholder={t('Asunto del correo', 'Email subject')} placeholderTextColor="rgba(226,232,240,0.35)" style={styles.mktInput} />
              <TextInput value={campaignPreheader} onChangeText={setCampaignPreheader} placeholder={t('Preheader / texto corto bajo el asunto', 'Preheader / short text below subject')} placeholderTextColor="rgba(226,232,240,0.35)" style={styles.mktInput} />

              {/* Audience selector */}
              <View style={styles.mktSelect}>
                <TouchableOpacity onPress={() => setEmailAudience(emailAudience === 'all' ? 'specify' : 'all')} style={styles.mktSelectInner}>
                  <Text style={styles.mktSelectText}>{emailAudience === 'all' ? t('Enviar a todos los usuarios', 'Send to all users') : t('Especificar destinatarios', 'Specify recipients')}</Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(226,232,240,0.5)" />
                </TouchableOpacity>
              </View>

              <TextInput value={campaignLink} onChangeText={setCampaignLink} placeholder={t('Link del botón o evento', 'Button or event link')} placeholderTextColor="rgba(226,232,240,0.35)" autoCapitalize="none" style={styles.mktInput} />

              {/* Upload art */}
              <TouchableOpacity onPress={pickEmailArt} style={styles.mktUploadArt}>
                <Ionicons name="cloud-upload-outline" size={32} color={colors.orange} />
                <Text style={styles.mktUploadTitle}>{t('Subir arte principal del email', 'Upload main email art')}</Text>
                <Text style={styles.mktUploadSub}>{t('Recomendado: 1200 px de ancho, JPG optimizado, menos de 1 MB.', 'Recommended: 1200px wide, optimized JPG, under 1 MB.')}</Text>
              </TouchableOpacity>
              {emailArtFileName ? (
                <View style={styles.mktArtFile}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mktArtFileName} numberOfLines={1}>{emailArtFileName}</Text>
                    <Text style={styles.mktArtFileSub}>{t('Arte cargado para preview', 'Art loaded for preview')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setEmailArtData(''); setEmailArtFileName(''); }} style={styles.mktArtRemove}>
                    <Ionicons name="close" size={16} color="#FCA5A5" />
                  </TouchableOpacity>
                </View>
              ) : null}
              {emailArtData ? <Image source={{ uri: emailArtData }} style={styles.mktArtPreview} resizeMode="contain" /> : null}

              <GradientButton label={sending === 'email' ? t('ENVIANDO...', 'SENDING...') : t('ENVIAR CAMPAÑA POR EMAIL', 'SEND EMAIL CAMPAIGN')} onPress={sendEmailCampaign} height={50} style={{ marginTop: 12 }} />
              <Text style={styles.mktFootNote}>{t('Se envía a todos los usuarios registrados.', 'Sent to all registered users.')}</Text>
            </View>

            {/* ─── Preview premium ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktPreviewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>{t('Preview premium', 'Premium preview')}</Text>
                  <Text style={styles.mktCardSub}>{t('Vista tipo email para aprobar el arte antes de activar pruebas.', 'Email-type view to approve art before activating tests.')}</Text>
                </View>
                <View style={styles.mktPreviewMailBadge}><Text style={styles.mktPreviewMailText}>Mail</Text></View>
              </View>
              <View style={styles.mktEmailPreview}>
                {/* Logo */}
                <View style={styles.mktPreviewLogoRow}>
                  <View style={styles.mktPreviewLogo}>
                    <Text style={styles.mktPreviewLogoText}>≡LP LPTicket</Text>
                  </View>
                </View>
                {/* Art */}
                {emailArtData ? (
                  <Image source={{ uri: emailArtData }} style={styles.mktPreviewArt} resizeMode="contain" />
                ) : (
                  <View style={styles.mktPreviewArtEmpty}>
                    <Ionicons name="image-outline" size={38} color="rgba(226,232,240,0.25)" />
                    <Text style={styles.mktPreviewArtText}>{t('Tu arte de Photoshop aparecerá aquí', 'Your Photoshop art will appear here')}</Text>
                  </View>
                )}
                {/* Body */}
                <View style={styles.mktPreviewBody}>
                  <Text style={styles.mktPreviewBodyTitle}>{campaignName || t('Titulo opcional de campaña', 'Optional campaign title')}</Text>
                  <Text style={styles.mktPreviewBodyCopy}>{campaignPreheader || t('Texto breve opcional para acompañar la imagen principal del email.', 'Optional brief text to accompany the main email image.')}</Text>
                  <View style={styles.mktPreviewBtn}><Text style={styles.mktPreviewBtnText}>{campaignLink ? 'VER DETALLES' : 'VER EVENTO'}</Text></View>
                </View>
              </View>
            </View>

            {/* ─── SMS ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktCardHeader}>
                <View style={[styles.mktCardIcon, { backgroundColor: 'rgba(10,55,90,0.5)' }]}><Ionicons name="phone-portrait-outline" size={20} color="#CBD5E1" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>SMS</Text>
                  <Text style={styles.mktCardSub}>{t('Recordatorios, accesos y promociones urgentes.', 'Reminders, access and urgent promotions.')}</Text>
                </View>
              </View>
              <View style={styles.mktSelect}>
                <View style={styles.mktSelectInner}>
                  <Text style={styles.mktSelectText}>{t('Enviar a todos los usuarios', 'Send to all users')}</Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(226,232,240,0.5)" />
                </View>
              </View>
              <TextInput value={smsMessage} onChangeText={setSmsMessage} placeholder={t('Escribe tu mensaje SMS...', 'Write your SMS message...')} placeholderTextColor="rgba(226,232,240,0.35)" multiline numberOfLines={4} maxLength={320} style={styles.mktTextArea} />
              <Text style={styles.mktCharCount}>{smsMessage.length}/320</Text>
              <GradientButton label={sending === 'sms' ? t('ENVIANDO...', 'SENDING...') : t('ENVIAR SMS', 'SEND SMS')} onPress={sendSms} height={48} style={{ marginTop: 8 }} />
            </View>

            {/* ─── WhatsApp ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktCardHeader}>
                <View style={[styles.mktCardIcon, { backgroundColor: 'rgba(7,94,84,0.25)', borderColor: 'rgba(37,211,102,0.3)' }]}><Ionicons name="logo-whatsapp" size={20} color="#25D366" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>WhatsApp</Text>
                  <Text style={styles.mktCardSub}>{t('Mensajes directos para audiencias segmentadas.', 'Direct messages for segmented audiences.')}</Text>
                </View>
              </View>
              <View style={styles.mktWaLangRow}>
                <Text style={styles.mktWaLangLabel}>{t('Plantilla:', 'Template:')}</Text>
                <TouchableOpacity onPress={() => setWaLang('es')} style={[styles.mktWaLangBtn, waLang === 'es' && styles.mktWaLangBtnActive]}>
                  <Text style={[styles.mktWaLangBtnText, waLang === 'es' && styles.mktWaLangBtnTextActive]}>ES</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setWaLang('en')} style={[styles.mktWaLangBtn, waLang === 'en' && styles.mktWaLangBtnActive]}>
                  <Text style={[styles.mktWaLangBtnText, waLang === 'en' && styles.mktWaLangBtnTextActive]}>EN</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.mktSelect}>
                <View style={styles.mktSelectInner}>
                  <Text style={styles.mktSelectText}>{t('Enviar a todos los usuarios', 'Send to all users')}</Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(226,232,240,0.5)" />
                </View>
              </View>
              <Text style={styles.mktWaHint}>
                {t('Tu texto va en ', 'Your text goes in ')}<Text style={{ color: colors.orange, fontWeight: '800' }}>{'{{2}}'}</Text>{t('. El nombre del cliente se completa solo en ', '. The customer name is filled in ')}<Text style={{ color: colors.orange, fontWeight: '800' }}>{'{{1}}'}</Text>{t('. Si quieres un enlace, escríbelo dentro del mensaje.', '. To add a link, write it inside the message.')}
              </Text>
              <TextInput value={whatsappMessage} onChangeText={setWhatsappMessage} placeholder={waLang === 'es' ? t('Escribe tu mensaje...', 'Write your message...') : 'Write your message...'} placeholderTextColor="rgba(226,232,240,0.35)" multiline numberOfLines={4} maxLength={1000} style={styles.mktTextArea} />
              <Text style={styles.mktCharCount}>{whatsappMessage.length}/1000</Text>
              {/* Preview */}
              <View style={styles.mktWaPreview}>
                <Text style={styles.mktWaPreviewLabel}>{t('VISTA PREVIA', 'PREVIEW')}</Text>
                <View style={styles.mktWaBubble}>
                  <Text style={styles.mktWaBubbleText}>{waLang === 'es' ? `Hola [Nombre] 👋 ${whatsappMessage || t('tu mensaje aquí', 'your message here')}` : `Hi [Name] 👋 ${whatsappMessage || 'your message here'}`}</Text>
                </View>
                <Text style={styles.mktWaPreviewSub}>{t(`Referencial — el marco lo define la plantilla aprobada (${waLang.toUpperCase()}).`, `Referential — the frame is defined by the approved template (${waLang.toUpperCase()}).`)}</Text>
              </View>
              <GradientButton label={sending === 'whatsapp' ? t('ENVIANDO...', 'SENDING...') : t(`ENVIAR WHATSAPP (${waLang.toUpperCase()})`, `SEND WHATSAPP (${waLang.toUpperCase()})`)} onPress={sendWhatsapp} height={48} style={{ marginTop: 8 }} />
            </View>

            {/* ─── Banner Home preview ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktBannerPreviewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktBannerPreviewEyebrow}>BANNER HOME</Text>
                  <Text style={styles.mktCardSub}>{t('Vista compacta del banner publicado en el carrusel principal.', 'Compact view of the banner published in the main carousel.')}</Text>
                </View>
                <View style={[styles.mktStatusBadge, bannerStatus === 'active' ? styles.mktStatusActive : styles.mktStatusDraft]}>
                  <Text style={[styles.mktStatusText, bannerStatus === 'active' ? { color: '#4ADE80' } : { color: colors.orange }]}>{bannerStatus === 'active' ? t('Publicado', 'Published') : t('Borrador', 'Draft')}</Text>
                </View>
              </View>
              {bannerDesktop ? (
                <Image source={{ uri: bannerDesktop.data }} style={styles.mktBannerImg} resizeMode="cover" />
              ) : (
                <View style={styles.mktBannerEmpty}><Text style={styles.mktBannerEmptyText}>{t('Sin banner publicado', 'No published banner')}</Text></View>
              )}
              <Text style={[styles.mktBannerPreviewEyebrow, { marginTop: 14 }]}>MOVIL</Text>
              <Text style={[styles.mktCardSub, { marginBottom: 8 }]}>{t('Formato flyer para celulares.', 'Vertical flyer for mobile devices.')}</Text>
              {bannerMobile ? (
                <Image source={{ uri: bannerMobile.data }} style={styles.mktBannerMobileImg} resizeMode="cover" />
              ) : (
                <View style={[styles.mktBannerEmpty, { aspectRatio: 3 / 4, maxWidth: 180, alignSelf: 'center' }]}><Text style={styles.mktBannerEmptyText}>{t('Sin flyer móvil', 'No mobile flyer')}</Text></View>
              )}
            </View>

            {/* ─── Upload banner ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktCardHeader}>
                <View style={styles.mktCardIcon}><Ionicons name="cloud-upload-outline" size={20} color={colors.orange} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>{t('Subir banner', 'Upload banner')}</Text>
                  <Text style={styles.mktCardSub}>{t('Arte horizontal para Home.', 'Horizontal art for Home.')}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => pickBanner('desktop')} style={styles.mktUploadBox}>
                <Ionicons name="cloud-upload-outline" size={28} color={colors.orange} />
                <Text style={styles.mktUploadBoxTitle}>{t('Cambiar banner', 'Change banner')}</Text>
                <Text style={styles.mktUploadBoxSub}>{t('Recomendado: 1600 × 520 px.', 'Recommended: 1600 × 520 px.')}</Text>
              </TouchableOpacity>
              {bannerDesktop && (
                <View style={styles.mktFileRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mktFileName} numberOfLines={1}>{bannerDesktop.name}</Text>
                    <Text style={styles.mktFileSub}>{t('Estado:', 'Status:')} {bannerStatus === 'active' ? t('Publicado', 'Published') : t('Borrador', 'Draft')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setBannerDesktop(null); setBannerStatus('draft'); }} style={styles.mktFileRemove}>
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ─── Upload banner movil ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktCardHeader}>
                <View style={[styles.mktCardIcon, { backgroundColor: 'rgba(10,55,90,0.5)' }]}><Ionicons name="phone-portrait-outline" size={20} color="#CBD5E1" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>{t('Subir banner móvil', 'Upload mobile banner')}</Text>
                  <Text style={styles.mktCardSub}>{t('Flyer vertical para celulares.', 'Vertical flyer for mobile devices.')}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => pickBanner('mobile')} style={styles.mktUploadBox}>
                <Ionicons name="phone-portrait-outline" size={28} color="#CBD5E1" />
                <Text style={styles.mktUploadBoxTitle}>{t('Cambiar flyer móvil', 'Change mobile flyer')}</Text>
                <Text style={styles.mktUploadBoxSub}>{t('Recomendado: 1080 × 1440 px.', 'Recommended: 1080 × 1440 px.')}</Text>
              </TouchableOpacity>
              {bannerMobile && (
                <View style={styles.mktFileRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mktFileName} numberOfLines={1}>{bannerMobile.name}</Text>
                    <Text style={styles.mktFileSub}>{t('Móvil', 'Mobile')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setBannerMobile(null)} style={styles.mktFileRemove}>
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ─── Publicación ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktCardHeader}>
                <View style={[styles.mktCardIcon, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)' }]}><Ionicons name="checkmark-circle-outline" size={20} color="#34D399" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>{t('Publicación', 'Publication')}</Text>
                  <Text style={styles.mktCardSub}>{t('Guarda el banner en el Home.', 'Save the banner to the Home.')}</Text>
                </View>
              </View>
              <View style={styles.mktRotationCard}>
                <Text style={styles.mktRotationTitle}>{t('Rotación en Home', 'Home Rotation')}</Text>
                <Text style={styles.mktRotationCopy}>{t('El banner se mezcla con eventos destacados y aparece dentro del carrusel.', 'The banner mixes with featured events and appears inside the carousel.')}</Text>
              </View>
              <TouchableOpacity onPress={publishBanner} style={styles.mktPublishBtn}>
                <Text style={styles.mktPublishBtnText}>{publishingBanner ? t('Publicando...', 'Publishing...') : t('Publicar banner', 'Publish banner')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => pickBanner('desktop')} style={styles.mktChangeImgBtn}>
                <Text style={styles.mktChangeImgBtnText}>{t('Cambiar imagen', 'Change image')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}
function PanelCard({ title, eyebrow, copy, children }: { title: string; eyebrow?: string; copy?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.panelCard}>
      {eyebrow && <Text style={styles.formEyebrow}>{eyebrow}</Text>}
      <Text style={styles.panelTitle}>{title}</Text>
      {copy && <Text style={styles.copy}>{copy}</Text>}
      {children}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Activity({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.activity}>
      <View style={styles.activityDot} />
      <View style={styles.activityCopy}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.copy}>{copy}</Text>
      </View>
    </View>
  );
}

function StatusPill({ label, tone, compact }: { label: string; tone: 'green' | 'red' | 'orange' | 'gray' | 'dark'; compact?: boolean }) {
  const styleMap = {
    green: [styles.statusPill, compact && styles.statusPillCompact, styles.statusGreen],
    red: [styles.statusPill, compact && styles.statusPillCompact, styles.statusRed],
    orange: [styles.statusPill, compact && styles.statusPillCompact, styles.statusOrange],
    gray: [styles.statusPill, compact && styles.statusPillCompact, styles.statusGray],
    dark: [styles.statusPill, compact && styles.statusPillCompact, styles.statusDark],
  };

  const textMap = {
    green: [styles.statusText, compact && styles.statusTextCompact, styles.statusTextGreen],
    red: [styles.statusText, compact && styles.statusTextCompact, styles.statusTextRed],
    orange: [styles.statusText, compact && styles.statusTextCompact, styles.statusTextOrange],
    gray: [styles.statusText, compact && styles.statusTextCompact, styles.statusTextGray],
    dark: [styles.statusText, compact && styles.statusTextCompact, styles.statusTextDark],
  };

  return (
    <View style={styleMap[tone]}>
      <Text style={textMap[tone]}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, muted, onPress }: { label: string; muted?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actionButton, muted && styles.actionButtonMuted]}>
      <Text style={[styles.actionButtonText, muted && styles.actionButtonTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MarketingRow({ title, copy, enabled, onToggle }: { title: string; copy: string; enabled: boolean; onToggle: () => void }) {
  return (
    <View style={styles.marketingCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, enabled ? styles.avatarOrange : styles.avatarMuted]}>
          <Text style={styles.avatarText}>{enabled ? 'ON' : 'OFF'}</Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{copy}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <StatusPill label={enabled ? 'ACTIVE' : 'INACTIVE'} tone={enabled ? 'green' : 'gray'} />
      </View>

      <TouchableOpacity onPress={onToggle} style={enabled ? styles.marketingDisableButton : styles.marketingEnableButton}>
        <Text style={enabled ? styles.marketingDisableText : styles.marketingEnableText}>{enabled ? 'DISABLE' : 'ENABLE'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function OrderItem({ index, title }: { index: string; title: string }) {
  const { t } = useLanguage();
  return (
    <View style={styles.orderPremiumItem}>
      <View style={styles.orderPremiumIndex}>
        <Text style={styles.orderPremiumIndexText}>{index}</Text>
      </View>
      <View style={styles.orderPremiumCopy}>
        <Text style={styles.orderPremiumTitle}>{title}</Text>
        <Text style={styles.orderPremiumSub}>{t('Visible en el home movil', 'Visible on mobile home')}</Text>
      </View>
    </View>
  );
}

function AnalyticsBar({ label, value, views }: { label: string; value: `${number}%`; views: number }) {
  const { t } = useLanguage();

  return (
    <View style={styles.analyticsRow}>
      <View style={styles.analyticsTop}>
        <Text style={styles.analyticsLabel}>{label}</Text>
        <Text style={styles.analyticsValue}>{value} · {views} {t('vistas', 'views')}</Text>
      </View>
      <View style={styles.analyticsTrack}>
        <View style={[styles.analyticsFill, { width: value }]} />
      </View>
    </View>
  );
}

function RankItem({ index: _index, title, value, imageUrl }: { index: string; title: string; value: string; imageUrl?: string }) {
  return (
    <View style={styles.rankItem}>
      <View style={styles.rankImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.rankImage} resizeMode="cover" />
        ) : (
          <View style={styles.rankImageFallback}>
            <Ionicons name="image-outline" size={18} color="#F97316" />
          </View>
        )}
      </View>
      <View style={styles.rankCopy}>
        <Text style={styles.rankTitle}>{title}</Text>
        <Text style={styles.rankValue}>{value}</Text>
      </View>
    </View>
  );
}

function titleFor(section: Section, t: (es: string, en: string) => string) {
  const names: Record<Section, string> = {
    dashboard: t('Panel administrativo', 'Admin dashboard'),
    events: t('Eventos', 'Events'),
    users: t('Usuarios', 'Users'),
    categories: t('Categorias', 'Categories'),
    marketing: t('Marketing', 'Marketing'),
    analytics: t('Analiticas', 'Analytics'),
    codes: t('Codigos especiales', 'Special codes'),
  };
  return names[section];
}

function subtitleFor(section: Section, t: (es: string, en: string) => string) {
  const copy: Record<Section, string> = {
    dashboard: t('Resumen de ventas, eventos, usuarios y pagos pendientes.', 'Sales, events, users and pending payouts overview.'),
    events: t('Administra eventos publicados, destacados y visibilidad.', 'Manage published events, featured placement and visibility.'),
    users: t('Gestiona clientes, organizadores, administradores y permisos.', 'Manage customers, organizers, administrators and permissions.'),
    categories: t('Organiza categorias para busqueda, filtros y home.', 'Organize categories for search, filters and home.'),
    marketing: t('Controla banners, promociones y orden visual del home.', 'Control banners, promotions and the visual order of the home screen.'),
    analytics: t('Mide conversion, visitas, checkouts e ingresos.', 'Measure conversion, visits, checkouts and revenue.'),
    codes: t('Crea codigos, comisiones y seguimiento de ventas.', 'Create codes, commissions and sales tracking.'),
  };
  return copy[section];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  tabsShell: { height: 94, marginTop: 44, backgroundColor: 'transparent', justifyContent: 'center', overflow: 'visible' },
  tabsViewport: { height: 62, marginHorizontal: 16, borderRadius: 20, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  tabsScroller: { height: 62, flexGrow: 0, flexShrink: 0, backgroundColor: 'transparent' },
  tabs: { height: 60, paddingLeft: 6, paddingRight: 46, gap: 6, alignItems: 'center', backgroundColor: 'transparent', position: 'relative' },
  adminSlidingPill: { position: 'absolute', top: 7, height: 46, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', zIndex: 0, overflow: 'hidden', shadowColor: '#FFFFFF', shadowOpacity: 0.16, shadowRadius: 13, shadowOffset: { width: 0, height: 6 } },
  tabMotion: { height: 46, justifyContent: 'center', zIndex: 1 },
  tab: { height: 46, minWidth: 124, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  tabActive: {},
  tabText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  tabsDots: { height: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 5 },
  tabsDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.24)' },
  tabsDotActive: { width: 14, backgroundColor: 'rgba(249,115,22,0.72)' },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 140 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#CBD5E1', fontSize: 16, lineHeight: 23, fontWeight: '400', marginBottom: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 24, fontWeight: '700', marginBottom: 4 },
  metricLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '700' },
  panelCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18, marginBottom: 16, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  formEyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  panelTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  eventName: { color: colors.navy, fontSize: 22, fontWeight: '700', marginBottom: 6 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, fontWeight: '400', marginBottom: 14 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusPill: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statusPillCompact: { height: 24, paddingHorizontal: 9 },
  statusGreen: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.34)' },
  statusRed: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.28)' },
  statusOrange: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.34)' },
  statusGray: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  statusDark: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  statusTextCompact: { fontSize: 9 },
  statusTextGreen: { color: '#4ADE80' },
  statusTextRed: { color: '#FCA5A5' },
  statusTextOrange: { color: colors.orange },
  statusTextGray: { color: '#CBD5E1' },
  statusTextDark: { color: '#F8FAFC' },
  adminEventCard: { position: 'relative', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 11, marginBottom: 10 },
  adminEventCardPast: { backgroundColor: 'rgba(3,11,20,0.74)', borderColor: 'rgba(148,163,184,0.18)' },
  adminEventEditButton: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.38)', alignItems: 'center', justifyContent: 'center', zIndex: 5, shadowColor: '#F97316', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  adminEditBack: { alignSelf: 'flex-start', minHeight: 40, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 12, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.32)', justifyContent: 'center' },
  adminEditBackText: { color: '#FDBA74', fontSize: 13, fontWeight: '800' },
  adminEventTop: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  adminEventPosterWrap: { width: 76, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  adminEventPoster: { width: '100%', height: '100%' },
  adminEventPosterFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  adminEventPosterText: { color: colors.orange, fontSize: 9, fontWeight: '700', letterSpacing: 0 },
  adminEventMain: { flex: 1, minWidth: 0, paddingRight: 34 },
  adminEventEyebrow: { color: colors.orange, fontSize: 10, fontWeight: '700', letterSpacing: 0, marginBottom: 4 },
  adminEventTitle: { color: '#F8FAFC', fontSize: 17, lineHeight: 21, fontWeight: '700', marginBottom: 5 },
  adminEventMeta: { color: 'rgba(226,232,240,0.62)', fontSize: 12, lineHeight: 17, fontWeight: '400', marginBottom: 8 },
  adminEventBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  adminApprovalRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  adminApproveBtn: { flex: 1, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.14)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  adminApproveText: { color: '#34D399', fontSize: 11, fontWeight: '800' },
  adminRejectBtn: { width: 96, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,90,69,0.1)', borderWidth: 1, borderColor: 'rgba(255,90,69,0.4)', alignItems: 'center', justifyContent: 'center' },
  adminRejectText: { color: '#FCA5A5', fontSize: 11, fontWeight: '800' },
  adminEventActions: { flexDirection: 'row', gap: 7, marginTop: 10 },
  adminEventPrimaryAction: { flex: 1.12, borderRadius: 10 },
  adminEventPrimaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  adminEventSecondaryAction: { flex: 1, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  adminEventSecondaryText: { color: '#F8FAFC', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  adminEventDangerAction: { flex: 0.72, borderColor: 'rgba(239,68,68,0.24)' },
  adminEventDangerText: { color: '#FCA5A5' },
  userCard: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, marginBottom: 10 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  userInfo: { flex: 1, minWidth: 0, gap: 8 },
  userIdentity: { minWidth: 0 },
  userName: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', marginBottom: 3 },
  userEmail: { color: 'rgba(226,232,240,0.58)', fontSize: 12, fontWeight: '400' },
  userBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  userAvatarBox: { width: 58, height: 58, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  userAvatarImage: { width: '100%', height: '100%' },
  userAvatarFallback: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.025)' },
  userAvatarHead: { width: 17, height: 17, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.72)', marginBottom: 5 },
  userAvatarBody: { width: 31, height: 15, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: 'rgba(226,232,240,0.58)' },
  userActionRow: { flexDirection: 'row', gap: 7 },
  userPrimaryAction: { flex: 1, borderRadius: 10 },
  userPrimaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  userSecondaryAction: { flex: 1, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  userSecondaryText: { color: '#F8FAFC', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  userDangerAction: { borderColor: 'rgba(239,68,68,0.24)' },
  userDangerText: { color: '#FCA5A5' },
  userCountCard: { minHeight: 78, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', backgroundColor: 'rgba(3,11,20,0.86)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 15, paddingVertical: 13, marginBottom: 10, shadowColor: '#ff6800', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  userCountEyebrow: { color: colors.orange, fontSize: 18, fontWeight: '700', letterSpacing: 0, marginBottom: 4 },
  userCountCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  userCountBadge: { minWidth: 82, height: 54, borderRadius: 16, backgroundColor: 'rgba(249,115,22,0.11)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  userCountValue: { color: '#F8FAFC', fontSize: 28, fontWeight: '800', letterSpacing: 0 },
  userSearchBox: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, marginBottom: 10 },
  userSearchIcon: { color: colors.orange, fontSize: 18, fontWeight: '700', width: 18, textAlign: 'center' },
  userSearchInput: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '600', paddingVertical: 0 },
  userEmptyCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 14, marginBottom: 10, alignItems: 'center' },
  userEmptyText: { color: 'rgba(226,232,240,0.62)', fontSize: 13, fontWeight: '600' },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  cardMain: { flex: 1 },
  cardTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardSub: { color: 'rgba(226,232,240,0.64)', fontSize: 14, fontWeight: '400' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  cardPrimaryAction: { flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  cardPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0 },
  cardSecondaryAction: { width: 104, height: 50, borderRadius: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  cardSecondaryText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', letterSpacing: 0 },
  actionButton: { minHeight: 44, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, flexGrow: 1 },
  actionButtonMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  actionButtonTextMuted: { color: '#F8FAFC' },
  fieldLabel: { color: 'rgba(226,232,240,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 7 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 16, color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  createToggle: { alignSelf: 'flex-start', marginBottom: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.1)' },
  createToggleText: { color: '#F97316', fontSize: 13, fontWeight: '800' },
  twoColRow: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  bannerThumb: { width: '100%', height: 88, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 8, backgroundColor: '#030B14' },
  bannerThumbEmpty: { width: '100%', height: 88, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 8, backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  bannerThumbText: { color: 'rgba(226,232,240,0.4)', fontSize: 13, fontWeight: '800' },
  bannerPickBtn: { height: 38, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  bannerPickText: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
  bannerDeleteRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  bannerDeleteBtn: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,90,69,0.3)', backgroundColor: 'rgba(255,90,69,0.08)', alignItems: 'center', justifyContent: 'center' },
  bannerDeleteText: { color: '#ff5a45', fontSize: 12, fontWeight: '700' },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.055)', borderColor: 'rgba(255,255,255,0.24)' },
  segmentActiveOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  segmentDanger: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.34)' },
  segmentText: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: '#FFFFFF' },
  formActions: { marginTop: 4, gap: 10 },
  primaryButton: { height: 56, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  secondaryButton: { height: 54, borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#F8FAFC', fontSize: 13, letterSpacing: 0, fontWeight: '700' },
  createRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  createInput: { flex: 1, height: 56, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 16, color: colors.navy, fontSize: 15, fontWeight: '700' },
  createButton: { width: 78, height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  codeCreateCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 13, marginBottom: 12, shadowColor: '#000000', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  codePanelTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginBottom: 5 },
  codePanelCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 17, fontWeight: '500', marginBottom: 10 },
  codeInput: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  codeAddButton: { width: 82, borderRadius: 10 },
  codeAddButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  codeCard: { backgroundColor: '#030B14', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 11, marginBottom: 8 },
  codeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  codeCardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  codeCardSub: { color: 'rgba(226,232,240,0.62)', fontSize: 11, fontWeight: '500' },
  codeActionRow: { flexDirection: 'row', gap: 7 },
  codePrimaryAction: { flex: 1, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  codePrimaryText: { color: '#F8FAFC', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  codeDeleteAction: { width: 62, height: 34, borderRadius: 10, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(239,68,68,0.24)', alignItems: 'center', justifyContent: 'center' },
  codeDeleteText: { color: '#FCA5A5', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  activity: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', marginTop: 10 },
  activityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, marginTop: 5 },
  activityCopy: { flex: 1 },
  activityTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14, marginTop: 10 },
  dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: colors.orange },
  listText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', flex: 1 },
  bannerPreviewCard: { backgroundColor: '#030B14', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 20, marginTop: 4 },
  bannerPreviewPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16 },
  bannerPreviewPillText: { color: colors.orange, fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  bannerPreviewTitle: { color: '#F8FAFC', fontSize: 23, fontWeight: '700', lineHeight: 29, marginBottom: 8 },
  bannerPreviewCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  avatarOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  avatarMuted: { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.14)' },
  marketingCard: { backgroundColor: '#030B14', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18, marginBottom: 14 },
  marketingEnableButton: { height: 50, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  marketingEnableText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  marketingDisableButton: { height: 50, borderRadius: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  marketingDisableText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', letterSpacing: 0 },
  orderPremiumItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14, marginTop: 10 },
  orderPremiumIndex: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center' },
  orderPremiumIndexText: { color: colors.orange, fontSize: 13, fontWeight: '700' },
  orderPremiumCopy: { flex: 1 },
  orderPremiumTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  orderPremiumSub: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '600' },
  analyticsRow: { marginTop: 12, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  analyticsTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  analyticsLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  analyticsValue: { color: colors.orange, fontSize: 15, fontWeight: '700' },
  analyticsTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  analyticsFill: { height: '100%', borderRadius: 999, backgroundColor: colors.orange },
  rankItem: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14, marginTop: 10 },
  rankImageWrap: { width: 48, height: 48, borderRadius: 15, overflow: 'hidden', backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.30)' },
  rankImage: { width: '100%', height: '100%' },
  rankImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  rankCopy: { flex: 1 },
  rankTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  rankValue: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '600' },
  paymentMixRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14, marginTop: 10 },
  paymentMixLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  paymentMixValue: { color: colors.orange, fontSize: 15, fontWeight: '700' },
  cardSecondaryActionWide: { height: 50, borderRadius: 15, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },

  // Fees / prices inline panel
  adminEventSecondaryActionActive: { backgroundColor: 'rgba(249,115,22,0.18)', borderColor: 'rgba(249,115,22,0.55)' },
  adminEventSecondaryTextActive: { color: '#F97316' },
  inlinePanel: { marginTop: 12, backgroundColor: 'rgba(3,11,20,0.88)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', padding: 14 },
  inlinePanelLoading: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  inlinePanelLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', letterSpacing: 0, marginTop: 8, marginBottom: 4 },
  inlinePanelInput: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', color: '#FFFFFF', fontSize: 13, fontWeight: '700', paddingHorizontal: 12, outlineStyle: 'none' as any },
  inlinePanelSave: { marginTop: 10, height: 40, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  inlinePanelSaveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  feeTabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  feeTab: { flex: 1, height: 34, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  feeTabActive: { backgroundColor: 'rgba(249,115,22,0.18)', borderColor: 'rgba(249,115,22,0.55)' },
  feeTabText: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '700' },
  feeTabTextActive: { color: '#F97316' },
  inlineSectionFee: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 10 },
  inlineSectionFeeTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  inlineFeeRow: { flexDirection: 'row', gap: 8 },
  inlineFeeField: { flex: 1 },

  // Commission / payout
  commissionCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 16, marginBottom: 12 },
  commissionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  commissionOwner: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  commissionEvent: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '400', marginTop: 2 },
  commissionBadge: { alignItems: 'flex-end' },
  commissionBalance: { color: '#F97316', fontSize: 20, fontWeight: '700' },
  commissionBalanceLabel: { color: 'rgba(226,232,240,0.48)', fontSize: 9, fontWeight: '400' },
  commissionStats: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  commissionStat: { flex: 1, backgroundColor: '#030B14', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 10 },
  commissionStatLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '700' },
  commissionStatValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginTop: 4 },
  payoutHistory: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4, gap: 4 },
  payoutHistoryItem: { color: 'rgba(226,232,240,0.52)', fontSize: 11, fontWeight: '400' },

  // Dashboard financial breakdown
  dashRowTwo: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  dashHalfCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  dashCardEyebrow: { color: colors.orange, fontSize: 11, fontWeight: '700', marginBottom: 10 },
  dashMiniGrid: { flexDirection: 'row', gap: 8 },
  dashMiniStat: { flex: 1, backgroundColor: '#030B14', borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center' },
  dashMiniValue: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  dashMiniLabel: { color: 'rgba(226,232,240,0.58)', fontSize: 10, fontWeight: '700' },
  finGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  finCard: { width: '48%', backgroundColor: '#030B14', borderRadius: 14, borderWidth: 1, padding: 12 },
  finCardGreen: { borderColor: 'rgba(34,197,94,0.28)' },
  finCardLabel: { color: 'rgba(226,232,240,0.52)', fontSize: 9, fontWeight: '700', marginBottom: 6 },
  finCardValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  finCardNote: { color: 'rgba(226,232,240,0.44)', fontSize: 10, fontWeight: '500' },
  finEventPill: { height: 32, borderRadius: 99, paddingHorizontal: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  finEventPillActive: { backgroundColor: 'rgba(249,115,22,0.14)', borderColor: 'rgba(249,115,22,0.5)' },
  finEventPillText: { color: 'rgba(226,232,240,0.62)', fontSize: 12, fontWeight: '700' },
  finEventPillTextActive: { color: colors.orange },

  // Analytics day selector
  analyticsDayRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  analyticsDayPill: { height: 36, borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  analyticsDayPillActive: { backgroundColor: 'rgba(249,115,22,0.14)', borderColor: 'rgba(249,115,22,0.5)' },
  analyticsDayText: { color: 'rgba(226,232,240,0.62)', fontSize: 13, fontWeight: '700' },
  analyticsDayTextActive: { color: colors.orange },

  // Recent activity (analytics)
  recentToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentViewRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 10 },
  recentViewPath: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 5 },
  recentViewMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recentViewTag: { backgroundColor: '#030B14', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, color: 'rgba(226,232,240,0.62)', fontSize: 11, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  recentViewTime: { color: 'rgba(226,232,240,0.44)', fontSize: 11, fontWeight: '400' },

  // User v2 cards
  userRoleFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  createUserBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: 12, paddingHorizontal: 16, backgroundColor: 'rgba(10,55,90,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignSelf: 'flex-start', marginBottom: 12 },
  createUserBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0 },
  userCard2: { backgroundColor: '#030B14', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 14, marginBottom: 10 },
  userCard2Top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  userInitialsAvatar: { width: 42, height: 42, borderRadius: 999, backgroundColor: 'rgba(249,115,22,0.14)', borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.4)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  userInitialsText: { color: colors.orange, fontSize: 14, fontWeight: '800' },
  userInitialsAvatarLg: { width: 52, height: 52, borderRadius: 999, backgroundColor: 'rgba(249,115,22,0.14)', borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.4)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  userInitialsTextLg: { color: colors.orange, fontSize: 18, fontWeight: '800' },
  userCard2Name: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  userCard2Username: { color: 'rgba(226,232,240,0.48)', fontSize: 11, fontWeight: '700' },
  userCard2EmailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  userCard2Email: { color: 'rgba(226,232,240,0.55)', fontSize: 12, fontWeight: '400', flex: 1 },
  userCard2StatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  userCard2Date: { color: 'rgba(226,232,240,0.4)', fontSize: 11, fontWeight: '500', fontStyle: 'italic' },
  userCard2Actions: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10 },
  userRoleDropdown: { flex: 1, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  userRoleDropdownText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  userActionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  // User detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3,11,20,0.72)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  userModal: { width: '100%', maxHeight: '88%', backgroundColor: '#0d1f33', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  userModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)' },
  userModalName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  userModalSub: { color: 'rgba(226,232,240,0.52)', fontSize: 11, fontWeight: '600' },
  userModalClose: { width: 34, height: 34, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  userModalSectionLabel: { color: 'rgba(226,232,240,0.44)', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  userModalInfoCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 14, gap: 12 },
  userModalInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  userModalInfoText: { color: '#CBD5E1', fontSize: 13, fontWeight: '500', flex: 1 },
  userModalEmptyText: { color: 'rgba(226,232,240,0.44)', fontSize: 13, fontWeight: '400', textAlign: 'center', paddingVertical: 8 },
  userModalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' },
  userModalEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userModalEditBtnText: { color: colors.orange, fontSize: 14, fontWeight: '700' },
  userModalCloseBtn: { height: 40, paddingHorizontal: 20, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  userModalCloseBtnText: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },

  // Event filter tabs
  eventFilterRow: { marginBottom: 10 },
  eventFilterContent: { paddingRight: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  eventFilterPill: { height: 38, borderRadius: 12, paddingHorizontal: 14, backgroundColor: 'rgba(8,31,51,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  eventFilterPillActive: { backgroundColor: 'rgba(249,115,22,0.9)', borderColor: 'rgba(255,151,45,0.62)' },
  eventFilterText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  eventFilterTextActive: { color: '#FFFFFF' },

  // Owner user search (special codes)
  ownerSearchBox: { position: 'relative', marginBottom: 6 },
  ownerSearchingText: { color: colors.orange, fontSize: 11, fontWeight: '700', marginTop: 4 },
  ownerResultsList: { backgroundColor: '#030B14', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 8, overflow: 'hidden' },
  ownerResultRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  ownerResultName: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  ownerResultEmail: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '400' },
  ownerSelectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,197,94,0.24)', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  ownerSelectedText: { flex: 1, color: '#4ADE80', fontSize: 12, fontWeight: '600' },

  // Categories redesign
  catHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  catCount: { flex: 1, color: '#CBD5E1', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  catNewBtn: { backgroundColor: colors.orange, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', minWidth: 100 },
  catNewBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center', lineHeight: 15 },
  catCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, marginBottom: 10 },
  catCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  catIconBox: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  catIconText: { fontSize: 24 },
  catCardName: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  catCardSlug: { color: 'rgba(226,232,240,0.44)', fontSize: 11, fontWeight: '500', marginBottom: 6 },
  catCardActions: { flexDirection: 'row', gap: 8 },
  catActionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  // Category form (create/edit modals)
  catIconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  catIconPicker: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  catSelectedIconBox: { alignSelf: 'flex-start', width: 52, height: 52, borderRadius: 14, borderWidth: 2, borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  catColorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  catColorSwatch: { width: 36, height: 36, borderRadius: 999 },
  catColorSwatchSelected: { borderWidth: 3, borderColor: '#FFFFFF' },
  catColorHex: { color: 'rgba(226,232,240,0.55)', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  catColorHexBox: { width: 36, height: 36, borderRadius: 8, marginBottom: 4 },
  catImageRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  catImageThumb: { width: 64, height: 64, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  catImageEmpty: { width: 64, height: 64, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  catImagePickBtn: { height: 40, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  catImagePickText: { color: colors.orange, fontSize: 13, fontWeight: '700' },
  catPreviewPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  catPreviewPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Special codes redesign
  codeStatRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  codeStatCard: { flex: 1, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  codeStatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  codeStatLabel: { color: 'rgba(226,232,240,0.52)', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  codeStatValue: { color: '#F8FAFC', fontSize: 28, fontWeight: '800' },
  codeCreateHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  codeCreateIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center' },
  codeCreateTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  codeCreateSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  codeEventPicker: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 6 },
  codeEventPickerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  codeEventPickerText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', flex: 1 },
  codeEventPill: { height: 32, borderRadius: 99, paddingHorizontal: 12, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  codeEventPillActive: { backgroundColor: 'rgba(249,115,22,0.14)', borderColor: 'rgba(249,115,22,0.5)' },
  codeEventPillText: { color: 'rgba(226,232,240,0.62)', fontSize: 12, fontWeight: '700', maxWidth: 120 },
  codeEventPillTextActive: { color: colors.orange },
  codeActiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  codeActiveCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  codeActiveCheckOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  codeActiveLabel: { color: '#CBD5E1', fontSize: 14, fontWeight: '700' },
  createdCodesHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  createdCodesTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  createdCodesSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  codeCard2: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 14, marginBottom: 10 },
  codeCard2Label: { color: 'rgba(226,232,240,0.6)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 3 },
  codeCard2Code: { color: '#F8FAFC', fontSize: 22, fontWeight: '900', marginBottom: 10 },
  codeCard2OwnerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  codeCard2OwnerName: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  codeCard2OwnerEmail: { color: 'rgba(226,232,240,0.48)', fontSize: 11, fontWeight: '400', marginBottom: 10 },
  codeCard2Event: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  codeCard2Actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  codeEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.08)' },
  codeEditBtnText: { color: colors.orange, fontSize: 12, fontWeight: '700' },
  codeDeleteBtn: { height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)', alignItems: 'center', justifyContent: 'center' },
  codeDeleteBtnText: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },
  codeStatusBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  codeStatusBtnActive: { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' },
  codeStatusBtnInactive: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' },
  codeStatusBtnText: { fontSize: 12, fontWeight: '700' },

  // Event rewards
  eventRewardsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, marginBottom: 12 },
  eventRewardsIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center' },
  eventRewardsTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  eventRewardsSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400', flex: 1 },
  eventRewardCard: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 14, marginBottom: 10 },
  eventRewardFieldLabel: { color: 'rgba(226,232,240,0.6)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 3 },
  eventRewardEventTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  eventRewardOrgName: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  eventRewardCurrent: { color: '#4ADE80', fontSize: 16, fontWeight: '800', marginBottom: 10 },

  // ── Marketing ─────────────────────────────────────────────────────────────
  mktHero: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', marginBottom: 16 },
  mktHeroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  mktHeroEyebrowText: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  mktHeroTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  mktHeroCopy: { color: 'rgba(226,232,240,0.65)', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  mktStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  mktStatCard: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14' },
  mktStatCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  mktStatLabel: { color: 'rgba(226,232,240,0.55)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  mktStatIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' },
  mktStatValue: { color: '#F8FAFC', fontSize: 26, fontWeight: '800' },
  mktCard: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', marginBottom: 16 },
  mktCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  mktCardIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  mktCardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  mktCardSub: { color: 'rgba(226,232,240,0.55)', fontSize: 12, lineHeight: 18 },
  mktStepsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  mktStep: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center' },
  mktStepNum: { color: '#F97316', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  mktStepName: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  mktInput: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  mktSelect: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 10, justifyContent: 'center' },
  mktSelectInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, justifyContent: 'space-between' },
  mktSelectText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  mktTextArea: { minHeight: 100, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingTop: 14, color: '#F8FAFC', fontSize: 14, fontWeight: '600', textAlignVertical: 'top' },
  mktCharCount: { color: 'rgba(226,232,240,0.4)', fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 6 },
  mktUploadArt: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(249,115,22,0.4)', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.04)', marginBottom: 10 },
  mktUploadTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  mktUploadSub: { color: 'rgba(226,232,240,0.45)', fontSize: 11, textAlign: 'center' },
  mktArtFile: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 8, gap: 10 },
  mktArtFileName: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  mktArtFileSub: { color: 'rgba(226,232,240,0.45)', fontSize: 11, marginTop: 2 },
  mktArtRemove: { width: 28, height: 28, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(252,165,165,0.3)', backgroundColor: 'rgba(252,165,165,0.08)', alignItems: 'center', justifyContent: 'center' },
  mktArtPreview: { width: '100%', height: 160, borderRadius: 14, marginBottom: 10 },
  mktFootNote: { color: 'rgba(226,232,240,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 },
  mktPreviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  mktPreviewMailBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)' },
  mktPreviewMailText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  mktEmailPreview: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0a1628', overflow: 'hidden' },
  mktPreviewLogoRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  mktPreviewLogo: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.06)' },
  mktPreviewLogoText: { color: '#F97316', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  mktPreviewArt: { width: '100%', height: 140 },
  mktPreviewArtEmpty: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.03)' },
  mktPreviewArtText: { color: 'rgba(226,232,240,0.3)', fontSize: 12, textAlign: 'center' },
  mktPreviewBody: { padding: 16, gap: 8 },
  mktPreviewBodyTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  mktPreviewBodyCopy: { color: 'rgba(226,232,240,0.65)', fontSize: 12, lineHeight: 18 },
  mktPreviewBtn: { marginTop: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center' },
  mktPreviewBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  mktWaLangRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  mktWaLangLabel: { color: 'rgba(226,232,240,0.65)', fontSize: 12, fontWeight: '700' },
  mktWaLangBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14' },
  mktWaLangBtnActive: { borderColor: 'rgba(37,211,102,0.5)', backgroundColor: 'rgba(37,211,102,0.1)' },
  mktWaLangBtnText: { color: 'rgba(226,232,240,0.6)', fontSize: 12, fontWeight: '700' },
  mktWaLangBtnTextActive: { color: '#25D366' },
  mktWaHint: { color: 'rgba(226,232,240,0.5)', fontSize: 11, lineHeight: 17, marginBottom: 10 },
  mktWaPreview: { marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(37,211,102,0.2)', backgroundColor: 'rgba(37,211,102,0.04)' },
  mktWaPreviewLabel: { color: '#25D366', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  mktWaBubble: { alignSelf: 'flex-start', maxWidth: '85%', padding: 12, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: '#075e54', marginBottom: 8 },
  mktWaBubbleText: { color: '#FFFFFF', fontSize: 13, lineHeight: 19 },
  mktWaPreviewSub: { color: 'rgba(226,232,240,0.35)', fontSize: 10, fontStyle: 'italic' },
  mktBannerPreviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  mktBannerPreviewEyebrow: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  mktStatusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  mktStatusActive: { borderColor: 'rgba(74,222,128,0.35)', backgroundColor: 'rgba(74,222,128,0.1)' },
  mktStatusDraft: { borderColor: 'rgba(249,115,22,0.35)', backgroundColor: 'rgba(249,115,22,0.08)' },
  mktStatusText: { fontSize: 12, fontWeight: '700' },
  mktBannerImg: { width: '100%', height: 130, borderRadius: 14, marginBottom: 10 },
  mktBannerMobileImg: { width: 120, height: 160, borderRadius: 14, alignSelf: 'center', marginBottom: 10 },
  mktBannerEmpty: { width: '100%', aspectRatio: 2.5, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.02)' },
  mktBannerEmptyText: { color: 'rgba(226,232,240,0.35)', fontSize: 12 },
  mktUploadBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 10 },
  mktUploadBoxTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  mktUploadBoxSub: { color: 'rgba(226,232,240,0.4)', fontSize: 11, textAlign: 'center' },
  mktFileRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', gap: 10 },
  mktFileName: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  mktFileSub: { color: 'rgba(226,232,240,0.45)', fontSize: 11, marginTop: 2 },
  mktFileRemove: { width: 28, height: 28, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  mktRotationCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', backgroundColor: 'rgba(16,185,129,0.05)', marginBottom: 14 },
  mktRotationTitle: { color: '#34D399', fontSize: 14, fontWeight: '800', marginBottom: 6 },
  mktRotationCopy: { color: 'rgba(226,232,240,0.6)', fontSize: 12, lineHeight: 18 },
  mktPublishBtn: { height: 50, borderRadius: 16, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  mktPublishBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  mktChangeImgBtn: { height: 44, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  mktChangeImgBtnText: { color: 'rgba(226,232,240,0.8)', fontSize: 14, fontWeight: '700' },

  // ── Analytics redesign ────────────────────────────────────────────────────
  anHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  anTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '800', marginBottom: 4 },
  anSubtitle: { color: 'rgba(226,232,240,0.55)', fontSize: 13, fontWeight: '500' },
  anDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 4 },
  anDayBtnText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  anStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  anStatCard: { flex: 1, minWidth: '47%', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)' },
  anStatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  anStatLabel: { color: 'rgba(226,232,240,0.6)', fontSize: 12, fontWeight: '600', flex: 1 },
  anStatIconBox: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.35)', backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' },
  anStatValue: { color: '#F8FAFC', fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  anSection: { padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', marginBottom: 12 },
  anSectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginBottom: 14 },
  anRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  anRankNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  anRankNumText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  anRankTitle: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  anRankMeta: { color: 'rgba(226,232,240,0.5)', fontSize: 12, fontWeight: '500', flexShrink: 0 },
  anRecentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  anRecentCount: { color: 'rgba(226,232,240,0.5)', fontSize: 13, fontWeight: '500' },
  anRecentToggle: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  anTableScroll: { maxHeight: 280 },
  anTableInner: { minWidth: 520 },
  anTableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', marginBottom: 4 },
  anTableCol: { color: 'rgba(226,232,240,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  anTableColPath: { color: 'rgba(226,232,240,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', width: 300, paddingRight: 12 },
  anTableColEvent: { color: 'rgba(226,232,240,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', width: 180 },
  anTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  anTablePath: { color: '#F8FAFC', fontSize: 13, fontWeight: '500', width: 300, paddingRight: 12 },
  anTableEvent: { color: 'rgba(226,232,240,0.5)', fontSize: 12, fontWeight: '500', width: 180 },
});
