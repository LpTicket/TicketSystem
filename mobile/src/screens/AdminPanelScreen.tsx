import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { apiDelete, apiGet, apiPatch, apiPost, getImageUrl } from '../services/api';
import { GradientButton } from '../components/GradientButton';
import { OrganizerDetailsMobile } from '../components/organizer/OrganizerEventForms';

export type Section = 'dashboard' | 'events' | 'users' | 'categories' | 'marketing' | 'analytics' | 'codes' | 'payments';
type AdminUser = { id: string; name: string; email: string; role: 'client' | 'organizer' | 'admin'; suspended: boolean; avatarUrl?: string };
type Category = { id: string; name: string; active: boolean; featured: boolean };

type AnalyticsSummary = {
  days: number;
  totalViews: number;
  uniqueVisitors: number;
  topEvents: { eventSlug: string; eventTitle?: string | null; views: number; visitors: number }[];
  daily: { date: string; views: number; visitors: number }[];
};

type ApiSpecialCode = {
  id: string;
  code: string;
  ownerUserId: string;
  owner?: { firstName?: string; lastName?: string; email?: string };
  commissionFixed: number;
  isActive: boolean;
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
  totalEvents?: number;
  publishedEvents?: number;
  totalOrders?: number;
  paidOrders?: number;
  totalRevenue?: number;
  totalTickets?: number;
  ticketSales?: number;
  serviceFees?: number;
  lpticketProfit?: number;
};

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
    email: user.email || '',
    role: user.role === 'admin' ? 'admin' : user.role === 'organizer' ? 'organizer' : 'client',
    suspended: user.isActive === false || user.suspended === true,
    avatarUrl: getImageUrl(user.avatarUrl || user.profileImageUrl || user.photoUrl || user.imageUrl),
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
  { id: 'payments', label: 'Pagos' },
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

  const [adminStats, setAdminStats] = useState<AdminStats>({});
  const [adminEvents, setAdminEvents] = useState<any[]>([]);
  const [editingAdminEvent, setEditingAdminEvent] = useState<any | null>(null);
  const [adminEditTitle, setAdminEditTitle] = useState('');
  const [adminEditVenue, setAdminEditVenue] = useState('');
  const [adminEditStatus, setAdminEditStatus] = useState<'draft' | 'published'>('published');

  // Lazy-loaded section data
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
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
  const [specialCodeOwnerDraft, setSpecialCodeOwnerDraft] = useState('');
  const [usersApiError, setUsersApiError] = useState('');
  const [usersTotal, setUsersTotal] = useState<number | null>(null);

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

  const loadUsers = async () => {
    try {
      setUsersApiError('');
      const data = await apiGet<any>('/admin/users?page=1&limit=20');
      setUsers(listFrom(data).map(toAdminUser));
      setUsersTotal(typeof data?.total === 'number' ? data.total : listFrom(data).length);
    } catch (err: any) {
      setUsersApiError(err?.message || 'Could not load users');
    }
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
    ]).then(([statsRes, eventsRes, usersRes, categoriesRes]) => {
      if (!mounted) return;

      if (statsRes.status === 'fulfilled') setAdminStats(statsRes.value || {});

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
          name: category.name || category.label || 'Category',
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
    { id: '1', name: 'Sundin Galue', email: 'sundin@example.com', role: 'admin', suspended: false },
    { id: '2', name: 'Fidel Genre', email: 'fidel@example.com', role: 'organizer', suspended: false },
    { id: '3', name: 'Maria Lopez', email: 'maria@example.com', role: 'client', suspended: false },
  ]);

  useEffect(() => {
    if (active === 'users') loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const normalizedUserSearch = userSearchQuery.trim().toLowerCase();
  const visibleUsers = normalizedUserSearch
    ? users.filter((user) => {
        const haystack = `${user.name} ${user.email} ${user.role} ${user.suspended ? 'suspended suspendido' : 'active activo'}`.toLowerCase();
        return haystack.includes(normalizedUserSearch);
      })
    : users;

  const [categories, setCategories] = useState<Category[]>([
    { id: '1', name: 'Concert', active: true, featured: true },
    { id: '2', name: 'Private Event', active: true, featured: true },
    { id: '3', name: 'Theater', active: true, featured: false },
    { id: '4', name: 'Workshop', active: false, featured: false },
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

  // Lazy-load analytics when that section is first opened
  useEffect(() => {
    if (active !== 'analytics' || analyticsSummary !== null || analyticsLoading) return;
    setAnalyticsLoading(true);
    apiGet<AnalyticsSummary>('/analytics/summary?days=7')
      .then(setAnalyticsSummary)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [active, analyticsSummary, analyticsLoading]);

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
      setHomeBanner(bannerRes.status === 'fulfilled' ? (bannerRes.value || false) : false);
      if (recipientsRes.status === 'fulfilled') setRecipientsCount((recipientsRes.value || []).length);
    });
  }, [active, homeBanner]);

  // Lazy-load orders/financials when payments section is opened
  useEffect(() => {
    if (active !== 'payments' || ordersLoaded || ordersLoading) return;
    setOrdersLoading(true);
    setOrdersError('');
    apiGet<any>('/admin/orders?page=1&limit=20')
      .then((data) => setAdminOrders(listFrom(data)))
      .catch((err: any) => setOrdersError(err?.message || 'Could not load orders'))
      .finally(() => {
        setOrdersLoaded(true);
        setOrdersLoading(false);
      });
  }, [active, ordersLoaded, ordersLoading]);

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

  const addCategory = async () => {
    const name = categoryDraft.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    try {
      const result = await apiPost<any>('/categories', { slug, labelEs: name, labelEn: name });
      setCategories((current) => [...current, { id: String(result.id || Date.now()), name, active: true, featured: false }]);
      setCategoryDraft('');
    } catch {
      Alert.alert(t('Error', 'Error'), t('No se pudo crear la categoría.', 'Could not create category.'));
    }
  };

  const saveCategoryToApi = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    const slug = cat.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    try {
      await apiPatch(`/categories/${id}`, { slug, labelEs: cat.name, labelEn: cat.name, isActive: cat.active });
      setEditingCategoryId(null);
    } catch {
      Alert.alert(t('Error', 'Error'), t('No se pudo guardar la categoría.', 'Could not save category.'));
    }
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

  const addSpecialCode = async () => {
    const code = specialCodeDraft.trim().toUpperCase();
    const ownerUserId = specialCodeOwnerDraft.trim();
    if (!code || !ownerUserId) {
      Alert.alert(t('Campos requeridos', 'Required fields'), t('Ingresa el código y el ID del dueño.', 'Enter the code and owner user ID.'));
      return;
    }
    try {
      const result = await apiPost<ApiSpecialCode>('/special-codes', { code, ownerUserId, isActive: true, commissionFixed: 0 });
      setApiCodes((current) => [result, ...current]);
      setSpecialCodeDraft('');
      setSpecialCodeOwnerDraft('');
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo crear el código.', 'Could not create code.'));
    }
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
    const subject = campaignSubjectDraft.trim();
    const body = campaignBodyDraft.trim();
    if (!subject) {
      Alert.alert(t('Asunto requerido', 'Subject required'), t('Ingresa un asunto para el email.', 'Enter a subject for the email.'));
      return;
    }
    try {
      const result = await apiPost<{ sent: number; failed: number; total: number }>('/marketing/admin/email-campaign', { subject, title: subject, preheader: body });
      Alert.alert(t('Campaña enviada', 'Campaign sent'), t(`Enviados: ${result.sent} / ${result.total}`, `Sent: ${result.sent} / ${result.total}`));
      setCampaignSubjectDraft('');
      setCampaignBodyDraft('');
    } catch {
      Alert.alert(t('Error', 'Error'), t('No se pudo enviar la campaña.', 'Could not send campaign.'));
    }
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
              <Metric label={t('Ventas plataforma', 'Platform sales')} value={money(adminStats.totalRevenue ?? 0)} />
              <Metric label={t('Eventos activos', 'Active events')} value={String(adminStats.publishedEvents ?? adminStats.totalEvents ?? 0)} />
              <Metric label={t('Usuarios', 'Users')} value={String(adminStats.totalUsers ?? 0)} />
              <Metric label={t('Ganancia LPTicket', 'LPTicket profit')} value={money(adminStats.lpticketProfit ?? adminStats.serviceFees ?? 0)} />
            </View>

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
            {adminEvents.length === 0 && (
              <PanelCard title={t('Sin eventos todavía', 'No events yet')} copy={t('Cuando se publiquen eventos aparecerán aquí.', 'Published events will appear here.')} />
            )}
            {[...adminEvents].sort(sortAdminEventsBySchedule).map((item: any) => (
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
          editingUserId ? (
            users.filter((user) => user.id === editingUserId).map((user) => (
              <PanelCard key={user.id} title={t('Editar usuario', 'Edit user')} eyebrow={t('CONFIGURACION DE USUARIO', 'USER SETTINGS')} copy={t('Gestiona la informacion, permisos y estado de la cuenta.', 'Manage account information, permissions and status.')}>
                <FieldLabel label={t('Nombre completo', 'Full name')} />
                <TextInput value={user.name} onChangeText={(value) => updateUser(user.id, 'name', value)} style={styles.input} />

                <FieldLabel label={t('Email', 'Email')} />
                <TextInput value={user.email} onChangeText={(value) => updateUser(user.id, 'email', value)} autoCapitalize="none" keyboardType="email-address" style={styles.input} />

                <FieldLabel label={t('Rol', 'Role')} />
                <View style={styles.segmentGroup}>
                  {(['client', 'organizer', 'admin'] as const).map((role) => (
                    <TouchableOpacity key={role} onPress={() => updateUser(user.id, 'role', role)} style={[styles.segment, user.role === role && styles.segmentActive]}>
                      <Text style={[styles.segmentText, user.role === role && styles.segmentTextActive]}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FieldLabel label={t('Estado', 'Status')} />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateUser(user.id, 'suspended', false)} style={[styles.segment, !user.suspended && styles.segmentActiveOrange]}>
                    <Text style={[styles.segmentText, !user.suspended && styles.segmentTextActive]}>{t('Activo', 'Active')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateUser(user.id, 'suspended', true)} style={[styles.segment, user.suspended && styles.segmentDanger]}>
                    <Text style={[styles.segmentText, user.suspended && styles.segmentTextActive]}>{t('Suspendido', 'Suspended')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => saveUserToApi(user.id)} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>{t('GUARDAR USUARIO', 'SAVE USER')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingUserId(null)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{t('CANCELAR', 'CANCEL')}</Text>
                  </TouchableOpacity>
                </View>
              </PanelCard>
            ))
          ) : (
            <>
              <View style={styles.userCountCard}>
                <View>
                  <Text style={styles.userCountEyebrow}>{t('USUARIOS ACTUALES', 'CURRENT USERS')}</Text>
                  <Text style={styles.userCountCopy}>
                    {userSearchQuery.trim()
                      ? t('Coincidencias visibles en la búsqueda', 'Visible search matches')
                      : t('Total registrado en la plataforma', 'Total registered on the platform')}
                  </Text>
                </View>
                <View style={styles.userCountBadge}>
                  <Text style={styles.userCountValue}>
                    {userSearchQuery.trim() ? visibleUsers.length : (usersTotal ?? users.length)}
                  </Text>
                </View>
              </View>
              <View style={styles.userSearchBox}>
                <Text style={styles.userSearchIcon}>⌕</Text>
                <TextInput
                  value={userSearchQuery}
                  onChangeText={setUserSearchQuery}
                  placeholder={t('Buscar usuarios', 'Search users')}
                  placeholderTextColor="rgba(226,232,240,0.38)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.userSearchInput}
                />
              </View>

              <TouchableOpacity onPress={() => setShowCreateUser((v) => !v)} style={styles.createToggle}>
                <Text style={styles.createToggleText}>{showCreateUser ? t('✕ Cancelar', '✕ Cancel') : t('+ Crear usuario', '+ Create user')}</Text>
              </TouchableOpacity>

              {showCreateUser && (
                <PanelCard title={t('Nuevo usuario', 'New user')} eyebrow={t('CREAR', 'CREATE')} copy={t('Crea una cuenta manualmente.', 'Create an account manually.')}>
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
                  <GradientButton label={creatingUser ? t('CREANDO...', 'CREATING...') : t('CREAR USUARIO', 'CREATE USER')} onPress={createUserApi} height={48} style={{ marginTop: 12 }} />
                </PanelCard>
              )}
              {usersApiError ? (
                <View style={styles.userEmptyCard}>
                  <Text style={styles.userEmptyText}>{t('No se pudo actualizar la lista real de usuarios.', 'Could not refresh the real users list.')}</Text>
                  <Text style={styles.userEmptyText}>{usersApiError}</Text>
                </View>
              ) : null}
              {visibleUsers.length === 0 && (
                <View style={styles.userEmptyCard}>
                  <Text style={styles.userEmptyText}>{t('No se encontraron usuarios', 'No users found')}</Text>
                </View>
              )}
              {visibleUsers.map((user) => (
                <View key={user.id} style={styles.userCard}>
                  <View style={styles.userHeader}>
                    <View style={styles.userInfo}>
                      <View style={styles.userIdentity}>
                        <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                      </View>
                      <View style={styles.userBadges}>
                        <StatusPill label={user.suspended ? 'SUSPENDED' : 'ACTIVE'} tone={user.suspended ? 'red' : 'green'} compact />
                        <StatusPill label={user.role.toUpperCase()} tone={user.role === 'admin' ? 'dark' : user.role === 'organizer' ? 'orange' : 'gray'} compact />
                      </View>
                    </View>
                    <View style={styles.userAvatarBox}>
                      {user.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={styles.userAvatarImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.userAvatarFallback}>
                          <View style={styles.userAvatarHead} />
                          <View style={styles.userAvatarBody} />
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.userActionRow}>
                    <GradientButton
                      label={t('EDITAR', 'EDIT')}
                      onPress={() => setEditingUserId(user.id)}
                      height={36}
                      style={styles.userPrimaryAction}
                      textStyle={styles.userPrimaryText}
                    />
                    <TouchableOpacity onPress={() => toggleUserActiveApi(user.id)} style={styles.userSecondaryAction}>
                      <Text style={styles.userSecondaryText}>{user.suspended ? 'ENABLE' : 'SUSPEND'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteUserApi(user.id)} style={[styles.userSecondaryAction, styles.userDangerAction]}>
                      <Text style={[styles.userSecondaryText, styles.userDangerText]}>DEL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )
        )}

        {active === 'categories' && (
          editingCategoryId ? (
            categories.filter((category) => category.id === editingCategoryId).map((category) => (
              <PanelCard key={category.id} title={t('Editar categoria', 'Edit category')} eyebrow={t('CONFIGURACION DE CATEGORIA', 'CATEGORY SETTINGS')} copy={t('Ajusta visibilidad, nombre y posicionamiento en el home.', 'Adjust visibility, name and home placement.')}>
                <FieldLabel label={t('Nombre de categoria', 'Category name')} />
                <TextInput value={category.name} onChangeText={(value) => updateCategory(category.id, 'name', value)} style={styles.input} />

                <FieldLabel label={t('Visibilidad', 'Visibility')} />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'active', true)} style={[styles.segment, category.active && styles.segmentActive]}>
                    <Text style={[styles.segmentText, category.active && styles.segmentTextActive]}>{t('Activo', 'Active')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'active', false)} style={[styles.segment, !category.active && styles.segmentDanger]}>
                    <Text style={[styles.segmentText, !category.active && styles.segmentTextActive]}>{t('Inactivo', 'Inactive')}</Text>
                  </TouchableOpacity>
                </View>

                <FieldLabel label={t('Ubicacion en home', 'Home placement')} />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'featured', true)} style={[styles.segment, category.featured && styles.segmentActiveOrange]}>
                    <Text style={[styles.segmentText, category.featured && styles.segmentTextActive]}>{t('Destacado', 'Featured')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'featured', false)} style={[styles.segment, !category.featured && styles.segmentActive]}>
                    <Text style={[styles.segmentText, !category.featured && styles.segmentTextActive]}>{t('Estandar', 'Standard')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => saveCategoryToApi(category.id)} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>{t('GUARDAR CATEGORIA', 'SAVE CATEGORY')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingCategoryId(null)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{t('CANCELAR', 'CANCEL')}</Text>
                  </TouchableOpacity>
                </View>
              </PanelCard>
            ))
          ) : (
            <>
              <PanelCard title={t('Categorias', 'Categories')} eyebrow={t('GESTOR DE CATEGORIAS', 'CATEGORY MANAGER')} copy={t('Crea y organiza categorias para filtros, busqueda y eventos destacados.', 'Create and organize categories for filters, search and featured events.')}>
                <View style={styles.createRow}>
                  <TextInput value={categoryDraft} onChangeText={setCategoryDraft} placeholder={t('Nueva categoria', 'New category')} placeholderTextColor="#9CA3AF" style={styles.createInput} />
                  <TouchableOpacity onPress={addCategory} style={styles.createButton}>
                    <Text style={styles.createButtonText}>{t('AGREGAR', 'ADD')}</Text>
                  </TouchableOpacity>
                </View>
              </PanelCard>

              {categories.map((category) => (
                <View key={category.id} style={styles.userCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{category.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.cardTitle}>{category.name}</Text>
                      <Text style={styles.cardSub}>{t('Filtros, discovery y home.', 'Filters, discovery and home.')}</Text>
                    </View>
                  </View>

                  <View style={styles.statusRow}>
                    <StatusPill label={category.active ? 'ACTIVE' : 'INACTIVE'} tone={category.active ? 'green' : 'red'} />
                    <StatusPill label={category.featured ? 'FEATURED' : 'STANDARD'} tone={category.featured ? 'orange' : 'gray'} />
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => setEditingCategoryId(category.id)} style={styles.cardPrimaryAction}>
                      <Text style={styles.cardPrimaryText}>{t('EDITAR', 'EDIT')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleCategoryActiveApi(category.id)} style={styles.cardSecondaryAction}>
                      <Text style={styles.cardSecondaryText}>{category.active ? 'DISABLE' : 'ENABLE'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCategoryApi(category.id)} style={[styles.cardSecondaryAction, { borderColor: 'rgba(239,68,68,0.28)' }]}>
                      <Text style={[styles.cardSecondaryText, { color: '#FCA5A5' }]}>DEL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )
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
            {analyticsLoading && <PanelCard title={t('Cargando...', 'Loading...')} />}
            {analyticsSummary && (
              <>
                <View style={styles.metricsGrid}>
                  <Metric label={t('Vistas totales', 'Total views')} value={analyticsSummary.totalViews >= 1000 ? `${(analyticsSummary.totalViews / 1000).toFixed(1)}k` : String(analyticsSummary.totalViews)} />
                  <Metric label={t('Visitantes únicos', 'Unique visitors')} value={analyticsSummary.uniqueVisitors >= 1000 ? `${(analyticsSummary.uniqueVisitors / 1000).toFixed(1)}k` : String(analyticsSummary.uniqueVisitors)} />
                  <Metric label={t('Órdenes pagadas', 'Paid orders')} value={String(adminStats.paidOrders ?? adminStats.totalOrders ?? 0)} />
                  <Metric label={t('Ingresos', 'Revenue')} value={money(adminStats.totalRevenue ?? 0)} />
                </View>

                {analyticsSummary.topEvents.length > 0 && (
                  <PanelCard title={t('Eventos más vistos', 'Most viewed events')} eyebrow={t('EVENTOS TOP', 'TOP EVENTS')} copy={t(`Últimos ${analyticsSummary.days ?? 7} días`, `Last ${analyticsSummary.days ?? 7} days`)}>
                    {analyticsSummary.topEvents.slice(0, 5).map((ev, i) => (
                      <RankItem
                        key={ev.eventSlug}
                        index={String(i + 1).padStart(2, '0')}
                        imageUrl={analyticsEventImage(ev, adminEvents)}
                        title={ev.eventTitle || formatEventSlug(ev.eventSlug)}
                        value={`${ev.views} ${t('vistas', 'views')}`}
                      />
                    ))}
                  </PanelCard>
                )}

                {analyticsSummary.daily.length > 0 && (
                  <PanelCard title={t('Vistas por día', 'Daily views')} eyebrow={t('ACTIVIDAD', 'ACTIVITY')}>
                    {analyticsSummary.daily.map((d) => {
                      const maxViews = Math.max(...analyticsSummary.daily.map((r) => r.views), 1);
                      const pct = Math.round((d.views / maxViews) * 100);
                      return <AnalyticsBar key={d.date} label={d.date.slice(5)} value={`${pct}%` as `${number}%`} views={d.views} />;
                    })}
                  </PanelCard>
                )}
              </>
            )}
            {!analyticsLoading && !analyticsSummary && (
              <PanelCard title={t('Sin datos todavía', 'No data yet')} copy={t('Las analíticas aparecerán aquí cuando haya actividad.', 'Analytics will appear here once there is activity.')} />
            )}
          </>
        )}
        {active === 'codes' && (
          <>
            <View style={styles.codeCreateCard}>
              <Text style={styles.formEyebrow}>{t('CODIGOS ESPECIALES', 'SPECIAL CODES')}</Text>
              <Text style={styles.codePanelTitle}>{t('Codigos especiales', 'Special codes')}</Text>
              <Text style={styles.codePanelCopy}>{t('Crea codigos, asigna comisiones y monitorea ventas generadas.', 'Create codes, assign commissions and monitor generated sales.')}</Text>
              <TextInput value={specialCodeDraft} onChangeText={setSpecialCodeDraft} placeholder={t('Codigo (ej: LPVIP)', 'Code (e.g. LPVIP)')} placeholderTextColor="#9CA3AF" autoCapitalize="characters" style={[styles.codeInput, { marginBottom: 8 }]} />
              <View style={styles.createRow}>
                <TextInput value={specialCodeOwnerDraft} onChangeText={setSpecialCodeOwnerDraft} placeholder={t('ID del dueño (UUID)', 'Owner user ID (UUID)')} placeholderTextColor="#9CA3AF" autoCapitalize="none" style={styles.codeInput} />
                <GradientButton label={t('AGREGAR', 'ADD')} onPress={addSpecialCode} height={44} style={styles.codeAddButton} textStyle={styles.codeAddButtonText} />
              </View>
            </View>

            {codesLoading && <PanelCard title={t('Cargando...', 'Loading...')} />}
            {!codesLoading && codesError ? (
              <PanelCard title={t('No se pudieron cargar los códigos', 'Could not load codes')} copy={codesError} />
            ) : null}

            {!codesLoading && (
              <View style={styles.metricsGrid}>
                <Metric label={t('Generado', 'Generated')} value={money(commissionSummary.reduce((s, e) => s + (e.totalEarned || 0), 0))} />
                <Metric label={t('Pagado', 'Paid out')} value={money(commissionSummary.reduce((s, e) => s + (e.totalPaid || 0), 0))} />
                <Metric label={t('Codigos', 'Codes')} value={String(apiCodes.length)} />
                <Metric label={t('Activos', 'Active')} value={String(apiCodes.filter((c) => c.isActive).length)} />
              </View>
            )}

            {apiCodes.map((item) => {
              const ownerName = [item.owner?.firstName, item.owner?.lastName].filter(Boolean).join(' ') || item.owner?.email || item.ownerUserId.slice(0, 8);
              return (
                <View key={item.id} style={styles.codeCard}>
                  <View style={styles.codeCardTop}>
                    <View style={styles.cardMain}>
                      <Text style={styles.codeCardTitle}>{item.code}</Text>
                      <Text style={styles.codeCardSub}>{ownerName} · ${Number(item.commissionFixed).toFixed(0)} commission</Text>
                    </View>
                    <StatusPill label={item.isActive ? 'ACTIVE' : 'INACTIVE'} tone={item.isActive ? 'green' : 'gray'} compact />
                  </View>

                  <View style={styles.codeActionRow}>
                    <TouchableOpacity onPress={() => toggleSpecialCode(item.id)} style={styles.codePrimaryAction}>
                      <Text style={styles.codePrimaryText}>{item.isActive ? 'DISABLE' : 'ENABLE'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCodeApi(item.id)} style={styles.codeDeleteAction}>
                      <Text style={styles.codeDeleteText}>DEL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

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
                          <TextInput
                            value={payoutAmount}
                            onChangeText={setPayoutAmount}
                            placeholder={t('Monto ($)', 'Amount ($)')}
                            placeholderTextColor="#9CA3AF"
                            keyboardType="decimal-pad"
                            style={styles.inlinePanelInput}
                          />
                          <TextInput
                            value={payoutNote}
                            onChangeText={setPayoutNote}
                            placeholder={t('Nota (opcional)', 'Note (optional)')}
                            placeholderTextColor="#9CA3AF"
                            style={styles.inlinePanelInput}
                          />
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
            <PanelCard
              title={t('Banner home', 'Home banner')}
              eyebrow={t('BANNER ACTUAL', 'CURRENT BANNER')}
              copy={homeBanner === null
                ? t('Cargando...', 'Loading...')
                : homeBanner
                  ? t(`Activo — ${(homeBanner as any).title || 'Banner home'}`, `Active — ${(homeBanner as any).title || 'Home banner'}`)
                  : t('Sin banner activo.', 'No active banner.')}
            />

            <PanelCard title={t('Campaña de email', 'Email campaign')} eyebrow={`RECIPIENTS: ${recipientsCount}`} copy={t('Se enviará a todos los usuarios activos.', 'Will be sent to all active users.')}>
              <TextInput
                value={campaignSubjectDraft}
                onChangeText={setCampaignSubjectDraft}
                placeholder={t('Asunto del email', 'Email subject')}
                placeholderTextColor="#9CA3AF"
                style={[styles.createInput, { marginBottom: 10 }]}
              />
              <TextInput
                value={campaignBodyDraft}
                onChangeText={setCampaignBodyDraft}
                placeholder={t('Mensaje / preheader (opcional)', 'Message / preheader (optional)')}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                style={[styles.createInput, { height: 80, textAlignVertical: 'top', paddingTop: 14 }]}
              />
              <TouchableOpacity onPress={sendEmailCampaign} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{t('ENVIAR CAMPAÑA', 'SEND CAMPAIGN')}</Text>
              </TouchableOpacity>
            </PanelCard>

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
          </>
        )}

        {active === 'payments' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label={t('Total órdenes', 'Total orders')} value={String(adminStats.totalOrders ?? adminOrders.length)} />
              <Metric label={t('Órdenes pagadas', 'Paid orders')} value={String(adminStats.paidOrders ?? 0)} />
              <Metric label={t('Ingresos', 'Revenue')} value={money(adminStats.totalRevenue ?? 0)} />
              <Metric label={t('Ganancia LP', 'LP profit')} value={money(adminStats.lpticketProfit ?? adminStats.serviceFees ?? 0)} />
            </View>

            {ordersLoading && <PanelCard title={t('Cargando órdenes...', 'Loading orders...')} />}
            {!ordersLoading && ordersError ? (
              <PanelCard title={t('No se pudieron cargar los pagos', 'Could not load payments')} copy={ordersError} />
            ) : null}

            {adminOrders.slice(0, 15).map((order) => {
              const buyer = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || order.user?.email || '—';
              const date = order.paidAt || order.createdAt;
              const dateStr = date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
              return (
                <View key={order.id} style={styles.userCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{buyer.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.cardTitle}>{order.event?.title || t('Evento', 'Event')}</Text>
                      <Text style={styles.cardSub}>{buyer} · {dateStr}</Text>
                    </View>
                  </View>
                  <View style={styles.statusRow}>
                    <StatusPill label={(order.status || 'paid').toUpperCase()} tone={order.status === 'paid' ? 'green' : order.status === 'cancelled' ? 'red' : 'gray'} />
                    <StatusPill label={money(order.totalAmount ?? 0)} tone="orange" />
                  </View>
                </View>
              );
            })}

            {!ordersLoading && adminOrders.length === 0 && (
              <PanelCard title={t('Sin órdenes todavía', 'No orders yet')} copy={t('Las órdenes pagadas aparecerán aquí.', 'Paid orders will appear here.')} />
            )}
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
    payments: t('Pagos', 'Payments'),
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
    payments: t('Revisa pagos, saldos y reportes financieros.', 'Review payouts, balances and financial reports.'),
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
  fieldLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400', marginBottom: 8 },
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
  codeInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', paddingHorizontal: 12, color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
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
});
