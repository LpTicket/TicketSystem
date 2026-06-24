import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { apiDelete, apiGet, apiPatch, apiPost, getImageUrl } from '../services/api';
import { GradientButton } from '../components/GradientButton';
import { OrganizerPanelScreen } from './OrganizerPanelScreen';
import { OrganizerAnalyticsMobile } from '../components/organizer/OrganizerAnalyticsMobile';

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
type Category = { id: string; name: string; labelEs: string; labelEn: string; subtitleEs?: string; subtitleEn?: string; slug: string; icon: string; color: string; sortOrder: number; imageData?: string; active: boolean; featured: boolean };
type MarketingRecipient = { id: string; name: string; email: string; phone?: string };
type MarketingHomeBanner = {
  id: string;
  title?: string;
  imageData?: string | null;
  imageUrl?: string | null;
  mobileImageData?: string | null;
  mobileImageUrl?: string | null;
  fileName?: string | null;
  mobileFileName?: string | null;
  bannerType?: 'banner' | 'ad' | string;
  displayMode?: 'once' | 'every3' | 'every5' | string;
  sortOrder?: number;
  isActive?: boolean;
};

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

type AnalyticsEventTarget = {
  id?: string;
  slug?: string;
  title: string;
  imageUrl?: string;
  venue?: string;
  date?: string;
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

const BANNER_DESKTOP_DISABLED_KEY = 'lp_admin_banner_desktop_disabled';
const BANNER_MOBILE_DISABLED_KEY = 'lp_admin_banner_mobile_disabled';

function resolveMarketingBannerImage(value?: string | null) {
  if (!value) return '';
  if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) return value;
  return getImageUrl(value) || value;
}

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
const ADMIN_USERS_LIMIT = 500;

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

function adminEventSlug(event: any) {
  return String(event?.slug || event?.eventSlug || '').trim();
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

type AdminProps = { section?: Section; onSectionChange?: (s: Section) => void; scrollToTopSignal?: number };

export function AdminPanelScreen({ section, onSectionChange, scrollToTopSignal = 0 }: AdminProps = {}) {
  const { t } = useLanguage();
  const adminIndicatorX = useRef(new Animated.Value(0)).current;
  const adminIndicatorWidth = useRef(new Animated.Value(118)).current;
  const userRoleIndicatorX = useRef(new Animated.Value(0)).current;
  const financialIndicatorX = useRef(new Animated.Value(0)).current;
  const financialIndicatorWidth = useRef(new Animated.Value(62)).current;
  const financialScrollRef = useRef<ScrollView>(null);
  const eventFilterIndicatorX = useRef(new Animated.Value(0)).current;
  const eventFilterIndicatorWidth = useRef(new Animated.Value(64)).current;
  const eventFilterScrollRef = useRef<ScrollView>(null);
  const adminScrollRef = useRef<ScrollView>(null);
  const active: Section = section ?? 'dashboard';
  const [tabLayouts] = useState<Partial<Record<Section, { x: number; width: number }>>>({});
  const [userRoleFilterWidth, setUserRoleFilterWidth] = useState(0);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserPasswordConfirm, setEditUserPasswordConfirm] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [marketingPromoEnabled, setMarketingPromoEnabled] = useState(false);
  const [specialCodeDraft, setSpecialCodeDraft] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'' | 'client' | 'admin'>('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedUserTickets, setSelectedUserTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    if (!scrollToTopSignal) return;
    adminScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopSignal]);

  const [adminStats, setAdminStats] = useState<AdminStats>({});
  const [adminEvents, setAdminEvents] = useState<any[]>([]);
  const [eventFilter, setEventFilter] = useState<'all' | 'pending_approval' | 'draft' | 'published' | 'cancelled'>('published');
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilterLayouts, setEventFilterLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const [eventFilterViewportWidth, setEventFilterViewportWidth] = useState(0);
  const [editingAdminEvent, setEditingAdminEvent] = useState<any | null>(null);
  const [adminEditTitle, setAdminEditTitle] = useState('');
  const [adminEditVenue, setAdminEditVenue] = useState('');
  const [adminEditStatus, setAdminEditStatus] = useState<'draft' | 'published' | 'cancelled'>('published');

  // Lazy-loaded section data
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRecentOpen, setAnalyticsRecentOpen] = useState(false);
  const [selectedAnalyticsEvent, setSelectedAnalyticsEvent] = useState<AnalyticsEventTarget | null>(null);
  const [selectedAnalyticsSales, setSelectedAnalyticsSales] = useState<any | null>(null);
  const [selectedAnalyticsAttendees, setSelectedAnalyticsAttendees] = useState<any[]>([]);
  const [selectedAnalyticsSections, setSelectedAnalyticsSections] = useState<any[]>([]);
  const [selectedAnalyticsLoading, setSelectedAnalyticsLoading] = useState(false);
  const [eventFinancials, setEventFinancials] = useState<EventFinancial[]>([]);
  const [selectedFinancialEventId, setSelectedFinancialEventId] = useState('');
  const [financialTabLayouts, setFinancialTabLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const [financialViewportWidth, setFinancialViewportWidth] = useState(0);
  const [apiCodes, setApiCodes] = useState<ApiSpecialCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesLoaded, setCodesLoaded] = useState(false);
  const [codesError, setCodesError] = useState('');
  const [commissionSummary, setCommissionSummary] = useState<CommissionEntry[]>([]);
  const [homeBanner, setHomeBanner] = useState<{ title?: string; isActive?: boolean } | null | false>(null);
  const [marketingHomeBanners, setMarketingHomeBanners] = useState<MarketingHomeBanner[]>([]);
  const [recipientsCount, setRecipientsCount] = useState(0);
  const [marketingRecipients, setMarketingRecipients] = useState<MarketingRecipient[]>([]);
  const [pushLiveEvents, setPushLiveEvents] = useState<any[]>([]);
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
  const [emailRecipientIds, setEmailRecipientIds] = useState<string[]>([]);
  const [emailRecipientSearch, setEmailRecipientSearch] = useState('');
  const [emailRecipientPickerOpen, setEmailRecipientPickerOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushLink, setPushLink] = useState('');
  const [pushDestination, setPushDestination] = useState<'none' | 'event' | 'external'>('none');
  const [pushEventId, setPushEventId] = useState('');
  const [pushEventPickerOpen, setPushEventPickerOpen] = useState(false);
  const [pushAudience, setPushAudience] = useState<'all' | 'user'>('all');
  const [pushRecipientId, setPushRecipientId] = useState('');
  const [pushRecipientPickerOpen, setPushRecipientPickerOpen] = useState(false);
  const [pushRecipientSearch, setPushRecipientSearch] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [waLang, setWaLang] = useState<'es' | 'en'>('es');
  const [waAudience, setWaAudience] = useState<'all' | 'specify'>('all');
  const [waSel, setWaSel] = useState<string[]>([]);
  const [waSearch, setWaSearch] = useState('');
  const [waPickerOpen, setWaPickerOpen] = useState(false);
  const [sending, setSending] = useState<'' | 'email' | 'sms' | 'push' | 'whatsapp'>('');
  const [bannerStatus, setBannerStatus] = useState<'draft' | 'active'>('draft');
  const [bannerType, setBannerType] = useState<'banner' | 'ad'>('banner');
  const [bannerDisplayMode, setBannerDisplayMode] = useState<'once' | 'every3' | 'every5'>('once');
  const [selectedMarketingBannerId, setSelectedMarketingBannerId] = useState<string | null>(null);
  const [specialCodeOwnerDraft, setSpecialCodeOwnerDraft] = useState('');
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerSearchResults, setOwnerSearchResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [ownerSearching, setOwnerSearching] = useState(false);
  const [usersApiError, setUsersApiError] = useState('');
  const [usersTotal, setUsersTotal] = useState<number | null>(null);

  // Category form (create + edit modals)
  const emptyCategForm = { labelEs: '', labelEn: '', subtitleEs: '', subtitleEn: '', slug: '', icon: '🎫', color: colors.orange, sortOrder: 0, imageData: '' as string };
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
      const params = role ? `?role=${role}&page=1&limit=${ADMIN_USERS_LIMIT}` : `?page=1&limit=${ADMIN_USERS_LIMIT}`;
      const data = await apiGet<any>(`/admin/users${params}`);
      setUsers(listFrom(data).map(toAdminUser));
      setUsersTotal(typeof data?.total === 'number' ? data.total : listFrom(data).length);
    } catch (err: any) {
      setUsersApiError(err?.message || 'Could not load users');
    }
  };

  const usersToMarketingRecipients = (rawUsers: any[]): MarketingRecipient[] => {
    const seen = new Set<string>();
    return rawUsers
      .map((u: any) => ({
        id: String(u.id || u._id || ''),
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.username || u.email || '',
        email: u.email || '',
        phone: (u.phone || '').trim(),
      }))
      .filter((recipient) => {
        if (!recipient.id || seen.has(recipient.id)) return false;
        seen.add(recipient.id);
        return true;
      });
  };

  const selectedPushRecipient = marketingRecipients.find((item) => item.id === pushRecipientId);
  const emailRecipients = marketingRecipients.filter((recipient) => !!recipient.email);
  const filteredEmailRecipients = emailRecipients.filter((recipient) => {
    const query = emailRecipientSearch.trim().toLowerCase();
    if (!query) return true;
    return `${recipient.name} ${recipient.email}`.toLowerCase().includes(query);
  });
  const selectedEmailRecipients = emailRecipients.filter((item) => emailRecipientIds.includes(item.id));
  const visibleMarketingHomeBanners = marketingHomeBanners.filter((item) => (item.bannerType === 'ad' ? 'ad' : 'banner') === bannerType);
  const filteredPushRecipients = marketingRecipients.filter((recipient) => {
    const query = pushRecipientSearch.trim().toLowerCase();
    if (!query) return true;
    return `${recipient.name} ${recipient.email} ${recipient.phone || ''}`.toLowerCase().includes(query);
  });
  const pushDestinationEvents = [...(pushLiveEvents.length > 0 ? pushLiveEvents : adminEvents)]
    .filter((event) => (event?.status ? event.status === 'published' : true) && !isAdminEventPast(event))
    .sort(sortAdminEventsBySchedule);
  const selectedPushEvent = pushDestinationEvents.find((event) => String(event.id) === pushEventId);

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

  const openEditUser = (userId: string) => {
    setSelectedUser(null);
    setEditUserPassword('');
    setEditUserPasswordConfirm('');
    setEditingUserId(String(userId));
  };

  // ── Create user (admin) ────────────────────────────────────────────────────
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [cuForm, setCuForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', phone: '', role: 'client' as 'client' | 'organizer' | 'admin' });
  const [cuPasswordConfirm, setCuPasswordConfirm] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const setCu = (k: keyof typeof cuForm, v: string) => setCuForm((f) => ({ ...f, [k]: v }));
  const createUserApi = async () => {
    if (!cuForm.firstName.trim() || !cuForm.lastName.trim() || !cuForm.username.trim() || !cuForm.email.trim()) {
      Alert.alert(t('Faltan datos', 'Missing info'), t('Nombre, apellido, usuario y correo son requeridos.', 'First name, last name, username and email are required.'));
      return;
    }
    if (cuForm.password.trim() || cuPasswordConfirm.trim()) {
      if (cuForm.password !== cuPasswordConfirm) {
        Alert.alert(t('Contraseñas no coinciden', 'Passwords do not match'), t('La contraseña y la confirmación deben ser iguales.', 'The password and confirmation must match.'));
        return;
      }
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
      setCuPasswordConfirm('');
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
      apiGet<any>(`/admin/users?page=1&limit=${ADMIN_USERS_LIMIT}`),
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
          subtitleEs: category.subtitleEs || '',
          subtitleEn: category.subtitleEn || '',
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
        const haystack = `${user.name} ${user.firstName} ${user.lastName} ${user.username} ${user.email} ${user.phone || ''} ${user.address || ''} ${user.role} ${user.suspended ? 'suspended suspendido' : 'active activo'}`.toLowerCase();
        return haystack.includes(normalizedUserSearch);
      })
    : users;
  const userRoleTabs = [
    { key: '', label: t('Todos', 'All') },
    { key: 'client', label: t('Clientes', 'Clients') },
    { key: 'admin', label: t('Admins', 'Admins') },
  ] as const;
  const userRoleIndex = userRoleFilter === 'client' ? 1 : userRoleFilter === 'admin' ? 2 : 0;
  const userRolePillWidth = Math.max(0, (userRoleFilterWidth - 8) / 3);
  const userCountDisplay = usersTotal ?? users.length;

  useEffect(() => {
    Animated.spring(userRoleIndicatorX, {
      toValue: userRoleIndex * userRolePillWidth,
      useNativeDriver: true,
      damping: 20,
      stiffness: 260,
      mass: 0.7,
    }).start();
  }, [userRoleIndex, userRoleIndicatorX, userRolePillWidth]);

  const selectedFinancialKey = selectedFinancialEventId || 'global';
  const financialOptions = [
    { id: 'global', title: t('Global', 'Global') },
    ...eventFinancials.map((event) => ({ id: event.id, title: event.title })),
  ];
  const activeFinancialIndex = Math.max(0, financialOptions.findIndex((option) => option.id === selectedFinancialKey));

  useEffect(() => {
    const layout = financialTabLayouts[selectedFinancialKey];
    if (!layout) return;

    Animated.parallel([
      Animated.spring(financialIndicatorX, {
        toValue: layout.x,
        useNativeDriver: false,
        damping: 18,
        stiffness: 210,
        mass: 0.68,
      }),
      Animated.spring(financialIndicatorWidth, {
        toValue: layout.width,
        useNativeDriver: false,
        damping: 18,
        stiffness: 210,
        mass: 0.68,
      }),
    ]).start();

    if (financialViewportWidth > 0) {
      const targetX = Math.max(0, layout.x + layout.width / 2 - financialViewportWidth / 2);
      financialScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }
  }, [financialIndicatorWidth, financialIndicatorX, financialTabLayouts, financialViewportWidth, selectedFinancialKey]);

  const selectFinancialEvent = (id: string) => {
    setSelectedFinancialEventId(id === 'global' ? '' : id);
    const layout = financialTabLayouts[id];
    if (layout && financialViewportWidth > 0) {
      const targetX = Math.max(0, layout.x + layout.width / 2 - financialViewportWidth / 2);
      financialScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }
  };

  const stepFinancialEvent = (direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(financialOptions.length - 1, activeFinancialIndex + direction));
    const next = financialOptions[nextIndex];
    if (next) selectFinancialEvent(next.id);
  };

  const eventFilterOptions = [
    { key: 'all' as const, label: t('Todos', 'All') },
    { key: 'pending_approval' as const, label: t('Por aprobar', 'Pending Approval') },
    { key: 'draft' as const, label: t('Borradores', 'Drafts') },
    { key: 'published' as const, label: t('Publicados', 'Published') },
    { key: 'cancelled' as const, label: t('Rechazados', 'Rejected') },
  ];
  const activeEventFilterIndex = Math.max(0, eventFilterOptions.findIndex((option) => option.key === eventFilter));

  useEffect(() => {
    const layout = eventFilterLayouts[eventFilter];
    if (!layout) return;

    Animated.parallel([
      Animated.spring(eventFilterIndicatorX, {
        toValue: layout.x,
        useNativeDriver: false,
        damping: 18,
        stiffness: 210,
        mass: 0.68,
      }),
      Animated.spring(eventFilterIndicatorWidth, {
        toValue: layout.width,
        useNativeDriver: false,
        damping: 18,
        stiffness: 210,
        mass: 0.68,
      }),
    ]).start();

    if (eventFilterViewportWidth > 0) {
      const targetX = Math.max(0, layout.x + layout.width / 2 - eventFilterViewportWidth / 2);
      eventFilterScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }
  }, [eventFilter, eventFilterIndicatorWidth, eventFilterIndicatorX, eventFilterLayouts, eventFilterViewportWidth]);

  const selectEventFilter = (key: typeof eventFilter) => {
    setEventFilter(key);
    const layout = eventFilterLayouts[key];
    if (layout && eventFilterViewportWidth > 0) {
      const targetX = Math.max(0, layout.x + layout.width / 2 - eventFilterViewportWidth / 2);
      eventFilterScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }
  };

  const stepEventFilter = (direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(eventFilterOptions.length - 1, activeEventFilterIndex + direction));
    const next = eventFilterOptions[nextIndex];
    if (next) selectEventFilter(next.key);
  };

  const [categories, setCategories] = useState<Category[]>([
    { id: '1', name: 'Concert', labelEs: 'Concierto', labelEn: 'Concert', subtitleEs: '', subtitleEn: '', slug: 'concierto', icon: '🎵', color: '#f97316', sortOrder: 0, active: true, featured: true },
    { id: '2', name: 'Private Event', labelEs: 'Evento Privado', labelEn: 'Private Event', subtitleEs: '', subtitleEn: '', slug: 'evento-privado', icon: '🎫', color: '#6366f1', sortOrder: 1, active: true, featured: true },
    { id: '3', name: 'Theater', labelEs: 'Teatro', labelEn: 'Theater', subtitleEs: '', subtitleEn: '', slug: 'teatro', icon: '🎭', color: '#8b5cf6', sortOrder: 2, active: true, featured: false },
    { id: '4', name: 'Workshop', labelEs: 'Taller', labelEn: 'Workshop', subtitleEs: '', subtitleEn: '', slug: 'taller', icon: '🎪', color: '#6b7280', sortOrder: 3, active: false, featured: false },
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

  useEffect(() => {
    adminScrollRef.current?.scrollTo({ y: 0, animated: false });
    if (active === 'events') {
      setEventFilter('published');
    }
  }, [active]);

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
    if (selectedAnalyticsEvent && !selectedAnalyticsEvent.slug) {
      setAnalyticsSummary({ days: analyticsDays, totalViews: 0, uniqueVisitors: 0, topEvents: [], topPages: [], daily: [], recentViews: [] });
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsSummary(null);
    const eventParam = selectedAnalyticsEvent?.slug ? `&eventSlug=${encodeURIComponent(selectedAnalyticsEvent.slug)}` : '';
    apiGet<AnalyticsSummary>(`/analytics/summary?days=${analyticsDays}${eventParam}`)
      .then(setAnalyticsSummary)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [active, analyticsDays, selectedAnalyticsEvent?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const eventId = selectedAnalyticsEvent?.id;
    if (active !== 'analytics' || !eventId) {
      setSelectedAnalyticsSales(null);
      setSelectedAnalyticsAttendees([]);
      setSelectedAnalyticsSections([]);
      return;
    }

    let mounted = true;
    setSelectedAnalyticsLoading(true);
    Promise.all([
      apiGet<any>(`/orders/event/${eventId}/sales`).catch(() => null),
      apiGet<any>(`/orders/event/${eventId}/attendees`).catch(() => []),
      apiGet<any[]>(`/events/${eventId}/seatmap`)
        .catch(() => apiGet<any[]>(`/events/${eventId}/sections`).catch(() => [])),
    ])
      .then(([sales, attendees, sections]) => {
        if (!mounted) return;
        setSelectedAnalyticsSales(sales || null);
        setSelectedAnalyticsAttendees(listFrom(attendees));
        setSelectedAnalyticsSections(Array.isArray(sections) ? sections : []);
      })
      .finally(() => {
        if (mounted) setSelectedAnalyticsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [active, selectedAnalyticsEvent?.id]);

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
      apiGet<MarketingHomeBanner[]>('/marketing/admin/banners/home?includeData=true'),
      apiGet<any[]>('/marketing/admin/recipients'),
      apiGet<any>('/admin/users?page=1&limit=200'),
      apiGet<any>('/events'),
      AsyncStorage.getItem(BANNER_DESKTOP_DISABLED_KEY),
      AsyncStorage.getItem(BANNER_MOBILE_DISABLED_KEY),
    ]).then(([bannerRes, recipientsRes, usersRes, eventsRes, desktopDisabledRes, mobileDisabledRes]) => {
      const banners = bannerRes.status === 'fulfilled' ? (Array.isArray(bannerRes.value) ? bannerRes.value : []) : [];
      const banner = banners[0] || false;
      const desktopDisabled = desktopDisabledRes.status === 'fulfilled' && desktopDisabledRes.value === '1';
      const mobileDisabled = mobileDisabledRes.status === 'fulfilled' && mobileDisabledRes.value === '1';
      setMarketingHomeBanners(banners);
      setHomeBanner(banner);
      if (banner) {
        setBannerStatus('active');
        setSelectedMarketingBannerId((banner as any).id || null);
        setBannerType((banner as any).bannerType === 'ad' ? 'ad' : 'banner');
        setBannerDisplayMode(['once', 'every3', 'every5'].includes((banner as any).displayMode) ? (banner as any).displayMode : 'once');
        const desktopUrl = resolveMarketingBannerImage((banner as any).imageData || (banner as any).imageUrl);
        if (desktopUrl) {
          setBannerDesktop({ data: desktopUrl, name: (banner as any).fileName || 'banner-desktop' });
          setBannerDesktopEnabled(!desktopDisabled);
        }
        const mobileUrl = resolveMarketingBannerImage((banner as any).mobileImageData || (banner as any).mobileImageUrl);
        if (mobileUrl) {
          setBannerMobile({ data: mobileUrl, name: (banner as any).mobileFileName || 'banner-mobile' });
          setBannerMobileEnabled(!mobileDisabled);
        }
      }
      const recipients = recipientsRes.status === 'fulfilled' ? (recipientsRes.value || []) : [];
      const adminUsers = usersRes.status === 'fulfilled' ? listFrom(usersRes.value) : [];
      // recipients first so dedup keeps their phone data over adminUsers entries
      const merged = usersToMarketingRecipients([...recipients, ...adminUsers]);
      if (merged.length > 0 || recipientsRes.status === 'fulfilled' || usersRes.status === 'fulfilled') {
        const nextRecipients = merged.length > 0 ? merged : recipients;
        setRecipientsCount(nextRecipients.length);
        setMarketingRecipients(nextRecipients);
      }
      if (eventsRes.status === 'fulfilled') {
        setPushLiveEvents(listFrom(eventsRes.value));
      }
    });
  }, [active, homeBanner]);


  // ── User actions ───────────────────────────────────────────────────────────

  const updateUser = (id: string, key: keyof AdminUser, value: string | boolean) => {
    setUsers((current) => current.map((user) => {
      if (user.id !== id) return user;
      const next = { ...user, [key]: value };
      if (key === 'firstName' || key === 'lastName') {
        next.name = [next.firstName, next.lastName].filter(Boolean).join(' ').trim() || next.username || next.email;
      }
      return next;
    }));
  };

  const saveUserToApi = async (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;
    if (!user.firstName.trim() || !user.lastName.trim() || !user.email.trim()) {
      Alert.alert(t('Faltan datos', 'Missing info'), t('Nombre, apellido y correo son requeridos.', 'First name, last name and email are required.'));
      return;
    }
    if (editUserPassword.trim() || editUserPasswordConfirm.trim()) {
      if (editUserPassword !== editUserPasswordConfirm) {
        Alert.alert(t('Contraseñas no coinciden', 'Passwords do not match'), t('La nueva contraseña y la confirmación deben ser iguales.', 'The new password and confirmation must match.'));
        return;
      }
    }
    try {
      const payload: any = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
      };
      if (editUserPassword.trim()) payload.password = editUserPassword;
      await apiPatch(`/admin/users/${id}`, payload);
      await apiPatch(`/admin/users/${id}/role`, { role: user.role });
      setEditUserPassword('');
      setEditUserPasswordConfirm('');
      setEditingUserId(null);
      await loadUsers();
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

  const openCreateCategoryModal = () => {
    setCategoryForm({ ...emptyCategForm });
    setShowCreateCategory(true);
  };

  const openEditCategoryModal = (category: Category) => {
    setEditCategoryForm({
      labelEs: category.labelEs || category.name || '',
      labelEn: category.labelEn || category.name || '',
      subtitleEs: category.subtitleEs || '',
      subtitleEn: category.subtitleEn || '',
      slug: category.slug || slugify(category.labelEs || category.name || ''),
      icon: category.icon || '🎫',
      color: category.color || colors.orange,
      sortOrder: category.sortOrder || 0,
      imageData: category.imageData || '',
    });
    setEditingCategoryModal(category);
  };

  const addCategory = async () => {
    const labelEs = categoryForm.labelEs.trim();
    const labelEn = categoryForm.labelEn.trim() || labelEs;
    const subtitleEs = categoryForm.subtitleEs.trim();
    const subtitleEn = categoryForm.subtitleEn.trim() || subtitleEs;
    if (!labelEs) return;
    const slug = slugify(categoryForm.slug.trim() || labelEs);
    setSavingCategory(true);
    try {
      const result = await apiPost<any>('/categories', {
        slug, labelEs, labelEn, subtitleEs, subtitleEn,
        icon: categoryForm.icon,
        color: categoryForm.color,
        sortOrder: Number(categoryForm.sortOrder) || 0,
        ...(categoryForm.imageData ? { imageData: categoryForm.imageData } : {}),
      });
      setCategories((current) => [...current, {
        id: String(result.id || Date.now()),
        name: labelEs, labelEs, labelEn, subtitleEs, subtitleEn,
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
    const subtitleEs = editCategoryForm.subtitleEs.trim();
    const subtitleEn = editCategoryForm.subtitleEn.trim() || subtitleEs;
    const slug = slugify(editCategoryForm.slug.trim() || labelEs);
    setSavingCategory(true);
    try {
      await apiPatch(`/categories/${id}`, {
        slug, labelEs, labelEn, subtitleEs, subtitleEn,
        icon: editCategoryForm.icon,
        color: editCategoryForm.color,
        sortOrder: Number(editCategoryForm.sortOrder) || 0,
        isActive: editingCategoryModal?.active ?? true,
        ...(editCategoryForm.imageData ? { imageData: editCategoryForm.imageData } : {}),
      });
      setCategories((current) => current.map((c) => c.id === id ? {
        ...c, name: labelEs, labelEs, labelEn, subtitleEs, subtitleEn, slug,
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
    const recipients = emailAudience === 'specify'
      ? selectedEmailRecipients.map((recipient) => recipient.email).filter(Boolean)
      : undefined;
    if (emailAudience === 'specify' && (!recipients || recipients.length === 0)) {
      Alert.alert(t('Selecciona destinatarios', 'Select recipients'), t('Elige al menos un usuario con email.', 'Choose at least one user with email.'));
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
        recipients,
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

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushMessage.trim()) {
      Alert.alert(t('Campos requeridos', 'Required fields'), t('Escribe un título y un mensaje.', 'Write a title and a message.'));
      return;
    }
    if (pushAudience === 'user' && !pushRecipientId) {
      Alert.alert(t('Usuario requerido', 'User required'), t('Selecciona un usuario para enviar la notificación.', 'Select a user to send the notification.'));
      return;
    }
    if (pushDestination === 'event' && !selectedPushEvent) {
      Alert.alert(t('Evento requerido', 'Event required'), t('Selecciona el evento que quieres abrir.', 'Select the event you want to open.'));
      return;
    }
    const link = pushDestination === 'event'
      ? `lpticket://event/${selectedPushEvent?.slug || selectedPushEvent?.id}`
      : pushDestination === 'external'
        ? pushLink.trim()
        : '';
    if (pushDestination === 'external' && link && !/^https?:\/\//i.test(link)) {
      Alert.alert(t('Link inválido', 'Invalid link'), t('Usa un link que empiece con https://', 'Use a link that starts with https://'));
      return;
    }

    setSending('push');
    try {
      const result = await apiPost<{ sent: number; failed: number; total: number; error?: string }>('/marketing/admin/push-campaign', {
        title: pushTitle.trim(),
        message: pushMessage.trim(),
        audience: pushAudience,
        userId: pushAudience === 'user' ? pushRecipientId : undefined,
        link: link || undefined,
      });
      Alert.alert(
        t('Push enviado', 'Push sent'),
        result.error
          ? `${t('Enviados', 'Sent')}: ${result.sent} / ${result.total}\n${result.error}`
          : `${t('Enviados', 'Sent')}: ${result.sent} / ${result.total}`,
      );
      setPushTitle('');
      setPushMessage('');
      setPushLink('');
      setPushEventId('');
      setPushDestination('none');
      setPushEventPickerOpen(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo enviar la notificación push.', 'Could not send the push notification.'));
    } finally { setSending(''); }
  };

  const sendWhatsapp = async () => {
    if (!whatsappMessage.trim()) { Alert.alert(t('Mensaje vacío', 'Empty message'), t('Escribe un mensaje.', 'Write a message.')); return; }
    if (waAudience === 'specify' && waSel.length === 0) {
      Alert.alert(t('Sin destinatarios', 'No recipients'), t('Selecciona al menos un usuario.', 'Select at least one user.'));
      return;
    }
    setSending('whatsapp');
    try {
      const recipients = waAudience === 'specify'
        ? marketingRecipients.filter((u) => waSel.includes(u.id) && u.phone).map((u) => u.phone!)
        : undefined;
      const result = await apiPost<{ sent: number; failed: number; total: number }>('/marketing/admin/whatsapp-campaign', { message: whatsappMessage, lang: waLang, recipients });
      Alert.alert(t('WhatsApp enviado', 'WhatsApp sent'), t(`Enviados: ${result.sent} / ${result.total}`, `Sent: ${result.sent} / ${result.total}`));
      setWhatsappMessage('');
      setWaSel([]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo enviar el WhatsApp.', 'Could not send WhatsApp.'));
    } finally { setSending(''); }
  };

  // ── Home banner management (base64 data URLs, like the web) ────────────────
  const [bannerDesktop, setBannerDesktop] = useState<{ data: string; name: string } | null>(null);
  const [bannerMobile, setBannerMobile] = useState<{ data: string; name: string } | null>(null);
  const [bannerDesktopEnabled, setBannerDesktopEnabled] = useState(false);
  const [bannerMobileEnabled, setBannerMobileEnabled] = useState(false);
  const [publishingBanner, setPublishingBanner] = useState(false);

  const pickBanner = async (which: 'desktop' | 'mobile') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('Permiso necesario', 'Permission needed'), t('Concede acceso a tus fotos.', 'Grant photo access.')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, base64: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    const dataUrl = a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri;
    const entry = { data: dataUrl, name: a.fileName || `banner-${which}` };
    if (which === 'desktop') {
      setBannerDesktop(entry);
      setBannerDesktopEnabled(false);
      void AsyncStorage.setItem(BANNER_DESKTOP_DISABLED_KEY, '1');
    } else {
      setBannerMobile(entry);
      setBannerMobileEnabled(false);
      void AsyncStorage.setItem(BANNER_MOBILE_DISABLED_KEY, '1');
    }
    setBannerStatus('draft');
  };

  const publishBanner = async () => {
    if (!bannerDesktop) { Alert.alert(t('Imagen requerida', 'Image required'), t('Selecciona la imagen del banner.', 'Select the banner image.')); return; }
    setPublishingBanner(true);
    try {
      const saved = await apiPost<MarketingHomeBanner>('/marketing/admin/banners/home', {
        id: selectedMarketingBannerId || undefined,
        title: bannerType === 'ad' ? t('Publicidad Home', 'Home Ad') : t('Banner Home', 'Home Banner'),
        imageData: bannerDesktop.data,
        fileName: bannerDesktop.name,
        mobileImageData: bannerMobile?.data || null,
        mobileFileName: bannerMobile?.name || null,
        bannerType,
        displayMode: bannerDisplayMode,
        sortOrder: marketingHomeBanners.length,
        isActive: true,
      });
      Alert.alert(t('Publicado', 'Published'), t('Banner publicado en el home.', 'Banner published on the home page.'));
      setHomeBanner({ isActive: true });
      setSelectedMarketingBannerId(saved.id);
      setMarketingHomeBanners((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setBannerStatus('active');
      setBannerDesktopEnabled(true);
      setBannerMobileEnabled(!!bannerMobile);
      await AsyncStorage.removeItem(BANNER_DESKTOP_DISABLED_KEY);
      if (bannerMobile) await AsyncStorage.removeItem(BANNER_MOBILE_DISABLED_KEY);
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('No se pudo publicar el banner.', 'Could not publish the banner.'));
    } finally {
      setPublishingBanner(false);
    }
  };

  const deleteBanner = async (which: 'home' | 'home-mobile') => {
    try {
      const currentBannerId = selectedMarketingBannerId || (which === 'home' ? marketingHomeBanners[0]?.id : '');
      if (currentBannerId && which === 'home') await apiDelete(`/marketing/admin/banners/home/${currentBannerId}`);
      else if (currentBannerId && which === 'home-mobile') await apiPatch(`/marketing/admin/banners/home/${currentBannerId}`, { mobileImageData: null, mobileFileName: null });
      else await apiDelete(`/marketing/admin/banner/${which}`);
      if (which === 'home') {
        setBannerDesktop(null);
        setBannerDesktopEnabled(false);
        setHomeBanner(false);
        setMarketingHomeBanners((current) => currentBannerId ? current.filter((item) => item.id !== currentBannerId) : current);
        setSelectedMarketingBannerId(null);
        setBannerStatus('draft');
        await AsyncStorage.removeItem(BANNER_DESKTOP_DISABLED_KEY);
      } else {
        setBannerMobile(null);
        setBannerMobileEnabled(false);
        setMarketingHomeBanners((current) => current.map((item) => (
          item.id === currentBannerId ? { ...item, mobileImageData: null, mobileImageUrl: null, mobileFileName: null } : item
        )));
        await AsyncStorage.removeItem(BANNER_MOBILE_DISABLED_KEY);
      }
      Alert.alert(t('Listo', 'Done'), t('Banner eliminado.', 'Banner removed.'));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error');
    }
  };

  const selectMarketingBanner = (item: MarketingHomeBanner) => {
    const desktopUrl = resolveMarketingBannerImage(item.imageData || item.imageUrl);
    const mobileUrl = resolveMarketingBannerImage(item.mobileImageData || item.mobileImageUrl);
    setSelectedMarketingBannerId(item.id);
    setBannerType(item.bannerType === 'ad' ? 'ad' : 'banner');
    setBannerDisplayMode(['once', 'every3', 'every5'].includes(item.displayMode || '') ? item.displayMode as 'once' | 'every3' | 'every5' : 'once');
    setBannerDesktop(desktopUrl ? { data: desktopUrl, name: item.fileName || 'banner-desktop' } : null);
    setBannerMobile(mobileUrl ? { data: mobileUrl, name: item.mobileFileName || 'banner-mobile' } : null);
    setBannerDesktopEnabled(item.isActive !== false && !!desktopUrl);
    setBannerMobileEnabled(item.isActive !== false && !!mobileUrl);
    setBannerStatus(item.isActive === false ? 'draft' : 'active');
  };

  const createNewMarketingBanner = (nextType = bannerType) => {
    setSelectedMarketingBannerId(null);
    setBannerType(nextType);
    setBannerDisplayMode('once');
    setBannerDesktop(null);
    setBannerMobile(null);
    setBannerDesktopEnabled(false);
    setBannerMobileEnabled(false);
    setBannerStatus('draft');
  };

  const toggleBannerEnabled = async (which: 'desktop' | 'mobile') => {
    if (which === 'desktop' && bannerDesktop) {
      const nextEnabled = !bannerDesktopEnabled;
      setBannerDesktopEnabled(nextEnabled);
      if (nextEnabled) await AsyncStorage.removeItem(BANNER_DESKTOP_DISABLED_KEY);
      else await AsyncStorage.setItem(BANNER_DESKTOP_DISABLED_KEY, '1');
    }
    if (which === 'mobile' && bannerMobile) {
      const nextEnabled = !bannerMobileEnabled;
      setBannerMobileEnabled(nextEnabled);
      if (nextEnabled) await AsyncStorage.removeItem(BANNER_MOBILE_DISABLED_KEY);
      else await AsyncStorage.setItem(BANNER_MOBILE_DISABLED_KEY, '1');
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

  const openAdminEventEditor = async (event: any) => {
    // Set basic data immediately so the editor opens fast
    setEditingAdminEvent(event);
    setAdminEditTitle(adminEventTitle(event));
    setAdminEditVenue(adminEventVenue(event));
    setAdminEditStatus(event?.status === 'draft' ? 'draft' : 'published');
    // Then load full event details in background and replace the stub
    const eventId = event?.id || event?.slug;
    if (eventId) {
      try {
        const full = await apiGet<any>(`/events/${eventId}`);
        if (full && full.id) {
          setEditingAdminEvent(full);
          setAdminEditTitle(full.title || adminEventTitle(event));
          setAdminEditVenue(full.venueName || full.venue || adminEventVenue(event));
          setAdminEditStatus(full.status === 'draft' ? 'draft' : 'published');
        }
      } catch {
        /* keep the list data already shown */
      }
    }
  };

  const openEventAnalytics = (event: any) => {
    setSelectedAnalyticsEvent({
      id: event?.id ? String(event.id) : undefined,
      slug: adminEventSlug(event),
      title: adminEventTitle(event),
      imageUrl: adminEventImage(event),
      venue: adminEventVenue(event),
      date: adminEventDate(event),
    });
    onSectionChange?.('analytics');
    setTimeout(() => adminScrollRef.current?.scrollTo({ y: 0, animated: false }), 0);
  };

  const backToAdminEventsFromAnalytics = () => {
    setSelectedAnalyticsEvent(null);
    onSectionChange?.('events');
    setTimeout(() => adminScrollRef.current?.scrollTo({ y: 0, animated: false }), 0);
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

  const selectedAnalyticsFinancial = selectedAnalyticsEvent
    ? eventFinancials.find((event) => event.id === selectedAnalyticsEvent.id)
    : undefined;
  const selectedAnalyticsPaidOrders = ((selectedAnalyticsSales?.orders || []) as any[])
    .filter((order) => Number(order.subtotal ?? order.total ?? 0) > 0);
  const selectedAnalyticsPaidTickets = selectedAnalyticsPaidOrders.reduce((sum, order) => {
    const tickets = Array.isArray(order.tickets) ? order.tickets : [];
    if (tickets.length > 0) {
      return sum + tickets.filter((ticket: any) => Number(ticket.price ?? order.subtotal ?? order.total ?? 0) > 0).length;
    }
    return sum + Number(order.ticketCount || 0);
  }, 0);

  return (
    <View style={styles.root}>
      <ScrollView ref={adminScrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
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
                    <>
                    <View style={styles.finTabsRow}>
                      <TouchableOpacity
                        style={[styles.finArrowBtn, activeFinancialIndex <= 0 && styles.finArrowBtnDisabled]}
                        disabled={activeFinancialIndex <= 0}
                        onPress={() => stepFinancialEvent(-1)}
                        activeOpacity={0.65}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={18}
                          color={activeFinancialIndex <= 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.86)'}
                        />
                      </TouchableOpacity>

                      <View style={styles.finTabsShell} onLayout={(event) => setFinancialViewportWidth(event.nativeEvent.layout.width)}>
                        <ScrollView
                          ref={financialScrollRef}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.finTabsScroller}
                          contentContainerStyle={styles.finTabsContent}
                          scrollEventThrottle={16}
                        >
                          <Animated.View
                            pointerEvents="none"
                            style={[
                              styles.finSlidingPill,
                              {
                                left: financialIndicatorX,
                                width: financialIndicatorWidth,
                              },
                            ]}
                          >
                            <View style={styles.finSlidingShine} />
                          </Animated.View>
                          {financialOptions.map((option, index) => {
                            const activeFinancial = option.id === selectedFinancialKey;
                            return (
                              <TouchableOpacity
                                key={`${option.id || 'financial-option'}-${index}`}
                                onPress={() => selectFinancialEvent(option.id)}
                                onLayout={(event) => {
                                  const { x, width } = event.nativeEvent.layout;
                                  setFinancialTabLayouts((current) => ({ ...current, [option.id]: { x, width } }));
                                }}
                                style={styles.finEventPill}
                              >
                                <Text style={[styles.finEventPillText, activeFinancial && styles.finEventPillTextActive]} numberOfLines={1}>{option.title}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                        <LinearGradient
                          pointerEvents="none"
                          colors={['rgba(3,11,20,0.96)', 'rgba(3,11,20,0)']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={[styles.finTabsFade, styles.finTabsFadeLeft]}
                        />
                        <LinearGradient
                          pointerEvents="none"
                          colors={['rgba(3,11,20,0)', 'rgba(3,11,20,0.96)']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={[styles.finTabsFade, styles.finTabsFadeRight]}
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.finArrowBtn, activeFinancialIndex >= financialOptions.length - 1 && styles.finArrowBtnDisabled]}
                        disabled={activeFinancialIndex >= financialOptions.length - 1}
                        onPress={() => stepFinancialEvent(1)}
                        activeOpacity={0.65}
                      >
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={activeFinancialIndex >= financialOptions.length - 1 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.86)'}
                        />
                      </TouchableOpacity>
                    </View>
                    <View pointerEvents="none" style={styles.finTabsDots}>
                      {financialOptions.map((option, index) => (
                        <View key={`${option.id || 'financial-dot'}-${index}`} style={[styles.finTabsDot, activeFinancialIndex === index && styles.finTabsDotActive]} />
                      ))}
                    </View>
                    </>
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
            <OrganizerPanelScreen
              adminEvent={editingAdminEvent}
              onAdminBack={closeAdminEventEditor}
            />
          ) : (
            <>
            {/* Status filter tabs */}
            <View style={styles.eventFilterWrap}>
              <View style={styles.eventFilterRow}>
                <TouchableOpacity
                  style={[styles.eventFilterArrowBtn, activeEventFilterIndex <= 0 && styles.eventFilterArrowBtnDisabled]}
                  disabled={activeEventFilterIndex <= 0}
                  onPress={() => stepEventFilter(-1)}
                  activeOpacity={0.65}
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={activeEventFilterIndex <= 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.86)'}
                  />
                </TouchableOpacity>

                <View style={styles.eventFilterShell} onLayout={(event) => setEventFilterViewportWidth(event.nativeEvent.layout.width)}>
                  <ScrollView
                    ref={eventFilterScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.eventFilterScroller}
                    contentContainerStyle={styles.eventFilterContent}
                    scrollEventThrottle={16}
                  >
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.eventFilterSlidingPill,
                        {
                          left: eventFilterIndicatorX,
                          width: eventFilterIndicatorWidth,
                        },
                      ]}
                    >
                      <View style={styles.eventFilterSlidingShine} />
                    </Animated.View>
                    {eventFilterOptions.map((f, index) => {
                      const activeFilter = eventFilter === f.key;
                      return (
                        <TouchableOpacity
                          key={`${f.key}-${index}`}
                          onPress={() => selectEventFilter(f.key)}
                          onLayout={(event) => {
                            const { x, width } = event.nativeEvent.layout;
                            setEventFilterLayouts((current) => ({ ...current, [f.key]: { x, width } }));
                          }}
                          style={styles.eventFilterPill}
                        >
                          <Text style={[styles.eventFilterText, activeFilter && styles.eventFilterTextActive]} numberOfLines={1}>{f.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(3,11,20,0.96)', 'rgba(3,11,20,0)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.eventFilterFade, styles.eventFilterFadeLeft]}
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(3,11,20,0)', 'rgba(3,11,20,0.96)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.eventFilterFade, styles.eventFilterFadeRight]}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.eventFilterArrowBtn, activeEventFilterIndex >= eventFilterOptions.length - 1 && styles.eventFilterArrowBtnDisabled]}
                  disabled={activeEventFilterIndex >= eventFilterOptions.length - 1}
                  onPress={() => stepEventFilter(1)}
                  activeOpacity={0.65}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={activeEventFilterIndex >= eventFilterOptions.length - 1 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.86)'}
                  />
                </TouchableOpacity>
              </View>
              <View pointerEvents="none" style={styles.eventFilterDots}>
                {eventFilterOptions.map((f, index) => (
                  <View key={`${f.key}-dot-${index}`} style={[styles.eventFilterDot, activeEventFilterIndex === index && styles.eventFilterDotActive]} />
                ))}
              </View>
            </View>

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
            {[...adminEvents].filter((e) => !eventSearch || (e.title || '').toLowerCase().includes(eventSearch.toLowerCase())).sort(sortAdminEventsBySchedule).map((item: any, index) => (
              <View key={`${String(item.id || item.slug || adminEventTitle(item) || 'event')}-${index}`} style={[styles.adminEventCard, isAdminEventPast(item) && styles.adminEventCardPast]}>
                <TouchableOpacity
                  onPress={() => openAdminEventEditor(item)}
                  style={styles.adminEventEditButton}
                  accessibilityLabel={t('Editar evento', 'Edit event')}
                >
                  <Ionicons name="pencil" size={15} color="#F97316" />
                </TouchableOpacity>
                <View style={styles.adminEventTop}>
                  <TouchableOpacity
                    onPress={() => openEventAnalytics(item)}
                    style={styles.adminEventPosterWrap}
                    activeOpacity={0.86}
                    accessibilityLabel={t('Ver estadísticas del evento', 'View event analytics')}
                  >
                    {adminEventImage(item) ? (
                      <Image source={{ uri: adminEventImage(item) }} style={styles.adminEventPoster} resizeMode="cover" />
                    ) : (
                      <View style={styles.adminEventPosterFallback}>
                        <Text style={styles.adminEventPosterText}>EVENT</Text>
                      </View>
                    )}
                    <View style={styles.adminEventStatsTab}>
                      <Ionicons name="stats-chart" size={13} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>

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
                          feeConfig.sections.map((sec, index) => (
                            <View key={`${sec.id || sec.name || 'fee-section'}-${index}`} style={styles.inlineSectionFee}>
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
                        priceConfig.sections.map((sec, index) => (
                          <View key={`${sec.id || sec.name || 'price-section'}-${index}`} style={styles.inlineSectionFee}>
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
            <View style={styles.userFilterCard}>
              <View style={styles.userCountCompact}>
                <Text style={styles.userCountCompactValue}>{userCountDisplay}</Text>
                <Text style={styles.userCountCompactLabel}>{t('usuarios', 'users')}</Text>
              </View>
              <View
                style={styles.userRoleFilterShell}
                onLayout={(event) => setUserRoleFilterWidth(event.nativeEvent.layout.width)}
              >
                {userRolePillWidth > 0 && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.userRoleSlidingPill,
                      { width: userRolePillWidth, transform: [{ translateX: userRoleIndicatorX }] },
                    ]}
                  >
                    <LinearGradient
                      colors={['#ff8a18', '#f46c00', '#c93f00']}
                      locations={[0, 0.46, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View pointerEvents="none" style={styles.userRoleSlidingShine}>
                      <LinearGradient
                        colors={['rgba(255,235,205,0)', 'rgba(255,235,205,0.85)', 'rgba(255,235,205,0)']}
                        locations={[0, 0.5, 1]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  </Animated.View>
                )}
                {userRoleTabs.map((f) => (
                  <TouchableOpacity key={f.key || 'all'} onPress={() => setUserRoleFilter(f.key)} style={styles.userRoleSegment}>
                    <Text style={[styles.userRoleSegmentText, userRoleFilter === f.key && styles.userRoleSegmentTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
            <GradientButton onPress={() => setShowCreateUser(true)} height={42} style={styles.createUserBtn}>
              <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
              <Text style={styles.createUserBtnText}>{t('CREAR USUARIO', 'CREATE USER')}</Text>
              <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
            </GradientButton>

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

            {visibleUsers.map((user, index) => {
              const dateStr = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
              return (
                <TouchableOpacity key={`${user.id || user.email || 'user'}-${index}`} onPress={() => openUserDetail(user)} style={styles.userCard2} activeOpacity={0.8}>
                  {/* Top row: avatar + name + role badge */}
                  <View style={styles.userCard2Top}>
                    <View style={styles.userInitialsAvatar}>
                      {user.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 999 }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="person-outline" size={19} color="rgba(248,250,252,0.82)" />
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
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); openEditUser(user.id); }} style={styles.userActionIcon}>
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
                    <Ionicons name="person-outline" size={23} color="rgba(248,250,252,0.84)" />
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
                          <Text style={[styles.userModalInfoText, { fontWeight: '600' }]} numberOfLines={1}>{tk.event?.title || tk.eventTitle || t('Evento', 'Event')}</Text>
                          <Text style={[styles.userModalInfoText, { fontSize: 11, color: 'rgba(226,232,240,0.5)' }]}>{tk.seatLabel || tk.seat || ''} · ${tk.price ?? ''}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Footer */}
              <View style={styles.userModalFooter}>
                <TouchableOpacity onPress={() => openEditUser(selectedUser.id)} style={styles.userModalEditBtn}>
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

      {/* ── Edit User Modal ──────────────────────────────────────────────── */}
      {editingUserId && (() => {
        const eu = users.find((u) => String(u.id) === String(editingUserId));
        if (!eu) return null;
        return (
          <Modal visible transparent animationType="slide" onRequestClose={() => setEditingUserId(null)}>
            <View style={styles.modalOverlay}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setEditingUserId(null)} activeOpacity={1} />
              <View style={[styles.userModal, styles.userEditModal]}>
                <View style={styles.userModalHeader}>
                  <View style={styles.userInitialsAvatarLg}>
                    <Ionicons name="pencil-outline" size={20} color={colors.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userModalName}>{t('Editar usuario', 'Edit user')}</Text>
                    <Text style={styles.userModalSub}>{eu.email}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setEditingUserId(null)} style={styles.userModalClose}>
                    <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 10 }}>
                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      <FieldLabel label={t('Nombre', 'First name')} />
                      <TextInput
                        value={eu.firstName}
                        onChangeText={(v) => updateUser(eu.id, 'firstName', v)}
                        style={styles.input}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                    <View style={styles.col}>
                      <FieldLabel label={t('Apellido', 'Last name')} />
                      <TextInput
                        value={eu.lastName}
                        onChangeText={(v) => updateUser(eu.id, 'lastName', v)}
                        style={styles.input}
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                  <FieldLabel label={t('Email', 'Email')} />
                  <TextInput
                    value={eu.email}
                    onChangeText={(v) => updateUser(eu.id, 'email', v)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <FieldLabel label={t('Teléfono', 'Phone')} />
                  <TextInput
                    value={eu.phone || ''}
                    onChangeText={(v) => updateUser(eu.id, 'phone', v)}
                    keyboardType="phone-pad"
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <FieldLabel label={t('Dirección', 'Address')} />
                  <TextInput
                    value={eu.address || ''}
                    onChangeText={(v) => updateUser(eu.id, 'address', v)}
                    style={styles.input}
                    placeholderTextColor="#9CA3AF"
                  />
                  <FieldLabel label={t('Nueva contraseña (opcional)', 'New password (optional)')} />
                  <TextInput
                    value={editUserPassword}
                    onChangeText={setEditUserPassword}
                    secureTextEntry
                    style={styles.input}
                    placeholder={t('Dejar en blanco para no cambiar', 'Leave blank to keep current')}
                    placeholderTextColor="#9CA3AF"
                  />
                  <FieldLabel label={t('Repetir contraseña', 'Repeat password')} />
                  <TextInput
                    value={editUserPasswordConfirm}
                    onChangeText={setEditUserPasswordConfirm}
                    secureTextEntry
                    style={styles.input}
                    placeholder={t('Repite la nueva contraseña', 'Repeat the new password')}
                    placeholderTextColor="#9CA3AF"
                  />
                  <FieldLabel label={t('Rol', 'Role')} />
                  <View style={styles.segmentGroup}>
                    {(['client', 'organizer', 'admin'] as const).map((role) => (
                      <TouchableOpacity key={role} onPress={() => updateUser(eu.id, 'role', role)} style={[styles.segment, eu.role === role && styles.segmentActive]}>
                        <Text style={[styles.segmentText, eu.role === role && styles.segmentTextActive]}>{role}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <View style={[styles.userModalFooter, { gap: 10 }]}>
                  <TouchableOpacity onPress={() => setEditingUserId(null)} style={[styles.userModalCloseBtn, styles.userModalSecondaryBtn]}>
                    <Text style={styles.userModalCloseBtnText}>{t('Cancelar', 'Cancel')}</Text>
                  </TouchableOpacity>
                  <GradientButton onPress={() => saveUserToApi(eu.id)} height={44} style={styles.userModalPrimaryBtn}>
                    <View style={styles.userModalPrimaryContent}>
                      <Text style={styles.userModalPrimaryText}>{t('GUARDAR', 'SAVE')}</Text>
                      <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                    </View>
                  </GradientButton>
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showCreateUser && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowCreateUser(false)}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => { setShowCreateUser(false); setCuPasswordConfirm(''); }} activeOpacity={1} />
            <View style={[styles.userModal, styles.userCreateModal]}>
              <View style={styles.userModalHeader}>
                <View style={[styles.userInitialsAvatarLg, { backgroundColor: 'rgba(249,115,22,0.12)' }]}>
                  <Ionicons name="person-add-outline" size={22} color={colors.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userModalName}>{t('Nuevo usuario', 'New user')}</Text>
                  <Text style={styles.userModalSub}>{t('Crea una cuenta manualmente', 'Create an account manually')}</Text>
                </View>
                <TouchableOpacity onPress={() => { setShowCreateUser(false); setCuPasswordConfirm(''); }} style={styles.userModalClose}>
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
                <FieldLabel label={t('Repetir contraseña', 'Repeat password')} />
                <TextInput
                  value={cuPasswordConfirm}
                  onChangeText={setCuPasswordConfirm}
                  secureTextEntry
                  style={styles.input}
                  placeholder={t('Repite la contraseña', 'Repeat the password')}
                  placeholderTextColor="#9CA3AF"
                />
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
                <TouchableOpacity onPress={() => { setShowCreateUser(false); setCuPasswordConfirm(''); }} style={[styles.userModalCloseBtn, styles.userModalSecondaryBtn]}>
                  <Text style={styles.userModalCloseBtnText}>{t('Cancelar', 'Cancel')}</Text>
                </TouchableOpacity>
                <GradientButton onPress={createUserApi} height={44} style={styles.userModalPrimaryBtn}>
                  <View style={styles.userModalPrimaryContent}>
                    <Text style={styles.userModalPrimaryText}>{creatingUser ? t('CREANDO...', 'CREATING...') : t('CREAR USUARIO', 'CREATE USER')}</Text>
                    <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                  </View>
                </GradientButton>
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
            <View style={styles.catFormModal}>
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(14,35,61,0.92)', 'rgba(5,14,26,0.96)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.userModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userModalName}>{t('Nueva categoría', 'New category')}</Text>
                  <Text style={styles.userModalSub}>{t('Agrega foto, título y subtítulo', 'Add photo, title and subtitle')}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCreateCategory(false)} style={styles.userModalClose}>
                  <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={styles.catFormContent}>
                <FieldLabel label={t('Foto de la categoría', 'Category photo')} />
                <TouchableOpacity onPress={() => pickCategoryImage('create')} activeOpacity={0.86} style={styles.catPhotoPicker}>
                  {categoryForm.imageData ? (
                    <Image source={{ uri: categoryForm.imageData }} style={styles.catPhotoPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.catPhotoEmpty}>
                      <Ionicons name="image-outline" size={30} color="rgba(255,255,255,0.45)" />
                      <Text style={styles.catPhotoEmptyText}>{t('Subir foto', 'Upload photo')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <FieldLabel label={t('Título', 'Title')} />
                <TextInput
                  value={categoryForm.labelEs}
                  onChangeText={(v) => setCategoryForm((f) => ({ ...f, labelEs: v, labelEn: v, slug: f.slug || slugify(v) }))}
                  placeholder={t('Ej. Concierto', 'E.g. Concert')}
                  placeholderTextColor="#6B7280"
                  style={styles.catFormInput}
                />
                <FieldLabel label={t('Subtítulo', 'Subtitle')} />
                <TextInput
                  value={categoryForm.subtitleEs}
                  onChangeText={(v) => setCategoryForm((f) => ({ ...f, subtitleEs: v, subtitleEn: v }))}
                  placeholder={t('Ej. Música en vivo', 'E.g. Live music')}
                  placeholderTextColor="#6B7280"
                  style={styles.catFormInput}
                />
                <FieldLabel label={t('Slug interno', 'Internal slug')} />
                <TextInput
                  value={categoryForm.slug}
                  onChangeText={(v) => setCategoryForm((f) => ({ ...f, slug: slugify(v) }))}
                  placeholder={t('ej. concierto', 'e.g. concert')}
                  placeholderTextColor="#6B7280"
                  style={styles.catFormInput}
                />
                <FieldLabel label={t('Color de acento', 'Accent color')} />
                <View style={styles.catColorGrid}>
                  {PRESET_COLORS.map((color, index) => (
                    <TouchableOpacity key={`${color}-${index}`} onPress={() => setCategoryForm((f) => ({ ...f, color }))} style={[styles.catColorSwatch, { backgroundColor: color }, categoryForm.color === color && styles.catColorSwatchSelected]} />
                  ))}
                </View>
                <FieldLabel label={t('Vista previa:', 'Preview:')} />
                <View style={styles.catFormPreviewCard}>
                  <View style={[styles.catCardAccent, { backgroundColor: categoryForm.color || colors.orange }]} />
                  <View style={[styles.catIconBox, { backgroundColor: `${categoryForm.color}22`, borderColor: `${categoryForm.color}66` }]}>
                    {categoryForm.imageData ? (
                      <Image source={{ uri: categoryForm.imageData }} style={styles.catCardImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="image-outline" size={22} color="rgba(226,232,240,0.5)" />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.catCardName} numberOfLines={1}>{categoryForm.labelEs || t('Título', 'Title')}</Text>
                    <Text style={styles.catCardSlug} numberOfLines={1}>{categoryForm.subtitleEs || categoryForm.slug || t('subtítulo', 'subtitle')}</Text>
                  </View>
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
            <View style={styles.catFormModal}>
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(14,35,61,0.92)', 'rgba(5,14,26,0.96)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.userModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userModalName}>{t('Editar categoría', 'Edit category')}</Text>
                  <Text style={styles.userModalSub}>{editingCategoryModal.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingCategoryModal(null)} style={styles.userModalClose}>
                  <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={styles.catFormContent}>
                <FieldLabel label={t('Foto de la categoría', 'Category photo')} />
                <TouchableOpacity onPress={() => pickCategoryImage('edit')} activeOpacity={0.86} style={styles.catPhotoPicker}>
                  {editCategoryForm.imageData ? (
                    <Image source={{ uri: editCategoryForm.imageData }} style={styles.catPhotoPreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.catPhotoEmpty}>
                      <Ionicons name="image-outline" size={30} color="rgba(255,255,255,0.45)" />
                      <Text style={styles.catPhotoEmptyText}>{t('Cambiar foto', 'Change photo')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <FieldLabel label={t('Título', 'Title')} />
                <TextInput
                  value={editCategoryForm.labelEs}
                  onChangeText={(v) => setEditCategoryForm((f) => ({ ...f, labelEs: v, labelEn: v }))}
                  placeholder={t('Ej. Concierto', 'E.g. Concert')}
                  placeholderTextColor="#6B7280"
                  style={styles.catFormInput}
                />
                <FieldLabel label={t('Subtítulo', 'Subtitle')} />
                <TextInput
                  value={editCategoryForm.subtitleEs}
                  onChangeText={(v) => setEditCategoryForm((f) => ({ ...f, subtitleEs: v, subtitleEn: v }))}
                  placeholder={t('Ej. Música en vivo', 'E.g. Live music')}
                  placeholderTextColor="#6B7280"
                  style={styles.catFormInput}
                />
                <FieldLabel label={t('Slug interno', 'Internal slug')} />
                <TextInput
                  value={editCategoryForm.slug}
                  onChangeText={(v) => setEditCategoryForm((f) => ({ ...f, slug: slugify(v) }))}
                  placeholder={t('ej. concierto', 'e.g. concert')}
                  placeholderTextColor="#6B7280"
                  style={styles.catFormInput}
                />
                <FieldLabel label={t('Color de acento', 'Accent color')} />
                <View style={styles.catColorGrid}>
                  {PRESET_COLORS.map((color, index) => (
                    <TouchableOpacity key={`${color}-${index}`} onPress={() => setEditCategoryForm((f) => ({ ...f, color }))} style={[styles.catColorSwatch, { backgroundColor: color }, editCategoryForm.color === color && styles.catColorSwatchSelected]} />
                  ))}
                </View>
                <FieldLabel label={t('Vista previa:', 'Preview:')} />
                <View style={styles.catFormPreviewCard}>
                  <View style={[styles.catCardAccent, { backgroundColor: editCategoryForm.color || colors.orange }]} />
                  <View style={[styles.catIconBox, { backgroundColor: `${editCategoryForm.color}22`, borderColor: `${editCategoryForm.color}66` }]}>
                    {editCategoryForm.imageData ? (
                      <Image source={{ uri: editCategoryForm.imageData }} style={styles.catCardImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="image-outline" size={22} color="rgba(226,232,240,0.5)" />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.catCardName} numberOfLines={1}>{editCategoryForm.labelEs || t('Título', 'Title')}</Text>
                    <Text style={styles.catCardSlug} numberOfLines={1}>{editCategoryForm.subtitleEs || editCategoryForm.slug || t('subtítulo', 'subtitle')}</Text>
                  </View>
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
                <FieldLabel label={t('DUEÑO DEL CÓDIGO', 'CODE OWNER')} />
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
                    {editCodeOwnerResults.map((u, index) => (
                      <TouchableOpacity key={`${u.id || u.email || 'edit-owner'}-${index}`} onPress={() => { setEditCodeForm((f) => ({ ...f, ownerUserId: u.id, ownerName: u.name, ownerEmail: u.email })); setEditCodeOwnerQuery(`${u.name} (${u.email})`); setEditCodeOwnerResults([]); }} style={styles.ownerResultRow}>
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
                    {adminEvents.slice(0, 10).map((ev, index) => (
                      <TouchableOpacity key={`${ev.id || ev.slug || 'edit-code-event'}-${index}`} onPress={() => setEditCodeForm((f) => ({ ...f, eventId: ev.id }))} style={[styles.codeEventPill, editCodeForm.eventId === ev.id && styles.codeEventPillActive]}>
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
              <GradientButton onPress={openCreateCategoryModal} height={44} style={styles.catNewBtn}>
                <Text style={styles.catNewBtnText}>{t('NUEVA\nCATEGORÍA', 'NEW\nCATEGORY')}</Text>
              </GradientButton>
            </View>

            {categories.map((category, index) => (
              <View key={`${category.id || category.slug || category.name || 'category'}-${index}`} style={styles.catCard}>
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(255,255,255,0.035)', 'rgba(255,255,255,0.010)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={[styles.catCardAccent, { backgroundColor: category.color || colors.orange }]} />
                <View style={styles.catCardLeft}>
                  <View style={[styles.catIconBox, { backgroundColor: `${category.color}22`, borderColor: `${category.color}66` }]}>
                    {category.imageData ? (
                      <Image source={{ uri: category.imageData }} style={styles.catCardImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.catIconText}>{category.icon?.trim() || '🎫'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.catCardName} numberOfLines={1}>{category.name}</Text>
                    <Text style={styles.catCardSlug} numberOfLines={1}>{category.subtitleEs || category.slug}</Text>
                    <View style={[styles.catStatusBadge, category.active ? styles.catStatusBadgeActive : styles.catStatusBadgeInactive]}>
                      <View style={[styles.catStatusDot, category.active ? styles.catStatusDotActive : styles.catStatusDotInactive]} />
                      <Text style={[styles.catStatusText, category.active ? styles.catStatusTextActive : styles.catStatusTextInactive]}>
                        {category.active ? t('Activa', 'Active') : t('Inactiva', 'Inactive')}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.catCardActions}>
                  <TouchableOpacity onPress={() => openEditCategoryModal(category)} style={styles.catActionBtn}>
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
            <PanelCard title={t('Gestión de banner', 'Banner management')} eyebrow={t('HOME', 'HOME')} copy={t('Sube la imagen del banner del home (escritorio y móvil).', 'Upload the home banner image (desktop and mobile).')}>
              <View style={styles.bannerOptionBlock}>
                <FieldLabel label={t('Qué quieres gestionar', 'What do you want to manage')} />
                <View style={styles.bannerSegmentRow}>
                  {([
                    { id: 'banner', label: t('Banner', 'Banner') },
                    { id: 'ad', label: t('Publicidad', 'Ad') },
                  ] as const).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => {
                        const firstItem = marketingHomeBanners.find((banner) => (banner.bannerType === 'ad' ? 'ad' : 'banner') === item.id);
                        if (firstItem) selectMarketingBanner(firstItem);
                        else createNewMarketingBanner(item.id);
                      }}
                      style={[styles.bannerSegmentBtn, bannerType === item.id && styles.bannerSegmentBtnActive]}
                    >
                      <Text style={[styles.bannerSegmentText, bannerType === item.id && styles.bannerSegmentTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bannerPickerScroll} contentContainerStyle={styles.bannerPickerContent}>
                  <TouchableOpacity
                    onPress={() => createNewMarketingBanner(bannerType)}
                    style={[styles.bannerPickerCard, !selectedMarketingBannerId && styles.bannerPickerCardActive]}
                    activeOpacity={0.86}
                  >
                    <View style={styles.bannerPickerAdd}>
                      <Ionicons name="add" size={18} color={colors.orange} />
                    </View>
                    <Text style={styles.bannerPickerTitle}>{bannerType === 'ad' ? t('Nueva publicidad', 'New ad') : t('Nuevo banner', 'New banner')}</Text>
                    <Text style={styles.bannerPickerMeta}>{t('Subir fotos', 'Upload photos')}</Text>
                  </TouchableOpacity>
                  {visibleMarketingHomeBanners.map((item, index) => {
                    const img = resolveMarketingBannerImage(item.imageData || item.imageUrl);
                    const activeItem = selectedMarketingBannerId === item.id;
                    const frequencyLabel = item.displayMode === 'every3'
                      ? t('Cada 3', 'Every 3')
                      : item.displayMode === 'every5'
                        ? t('Cada 5', 'Every 5')
                        : t('Una vez', 'Once');
                    return (
                      <TouchableOpacity
                        key={item.id || index}
                        onPress={() => selectMarketingBanner(item)}
                        style={[styles.bannerPickerCard, activeItem && styles.bannerPickerCardActive]}
                        activeOpacity={0.86}
                      >
                        {img ? <Image source={{ uri: img }} style={styles.bannerPickerImage} resizeMode="cover" /> : <View style={styles.bannerPickerImage} />}
                        <Text style={styles.bannerPickerTitle} numberOfLines={1}>{bannerType === 'ad' ? t('Publicidad', 'Ad') : t('Banner', 'Banner')}</Text>
                        <Text style={styles.bannerPickerMeta} numberOfLines={1}>{frequencyLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={styles.twoColRow}>
                <View style={[styles.col, { paddingTop: 4 }]}>
                  <FieldLabel label={t('Escritorio', 'Desktop')} />
                  <BannerPublishBadge published={!!bannerDesktop && bannerDesktopEnabled} />
                  {bannerDesktop ? <Image source={{ uri: bannerDesktop.data }} style={styles.bannerThumb} resizeMode="cover" /> : <View style={styles.bannerThumbEmpty}><Text style={styles.bannerThumbText}>16:9</Text></View>}
                  <TouchableOpacity onPress={() => pickBanner('desktop')} style={styles.bannerPickBtn}><Text style={styles.bannerPickText}>{bannerDesktop ? t('CAMBIAR FOTO', 'CHANGE PHOTO') : t('SUBIR DESDE FOTOS', 'UPLOAD FROM PHOTOS')}</Text></TouchableOpacity>
                </View>
                <View style={[styles.col, { paddingTop: 4 }]}>
                  <FieldLabel label={t('Móvil', 'Mobile')} />
                  <BannerPublishBadge published={!!bannerMobile && bannerMobileEnabled} />
                  {bannerMobile ? <Image source={{ uri: bannerMobile.data }} style={styles.bannerThumb} resizeMode="cover" /> : <View style={styles.bannerThumbEmpty}><Text style={styles.bannerThumbText}>9:16</Text></View>}
                  <TouchableOpacity onPress={() => pickBanner('mobile')} style={styles.bannerPickBtn}><Text style={styles.bannerPickText}>{bannerMobile ? t('CAMBIAR FOTO', 'CHANGE PHOTO') : t('SUBIR DESDE FOTOS', 'UPLOAD FROM PHOTOS')}</Text></TouchableOpacity>
                </View>
              </View>
              <View style={styles.bannerOptionBlock}>
                <FieldLabel label={t('Frecuencia en el carrusel', 'Carousel frequency')} />
                <View style={styles.bannerSegmentRow}>
                  {([
                    { id: 'once', label: t('Una vez', 'Once') },
                    { id: 'every3', label: t('Cada 3', 'Every 3') },
                    { id: 'every5', label: t('Cada 5', 'Every 5') },
                  ] as const).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setBannerDisplayMode(item.id)}
                      style={[styles.bannerSegmentBtn, bannerDisplayMode === item.id && styles.bannerSegmentBtnActive]}
                    >
                      <Text style={[styles.bannerSegmentText, bannerDisplayMode === item.id && styles.bannerSegmentTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <GradientButton label={publishingBanner ? t('PUBLICANDO...', 'PUBLISHING...') : selectedMarketingBannerId ? t('GUARDAR CAMBIOS', 'SAVE CHANGES') : t('PUBLICAR BANNER', 'PUBLISH BANNER')} onPress={publishBanner} height={48} style={{ marginTop: 12 }} />
              <View style={styles.bannerDeleteRow}>
                <TouchableOpacity
                  onPress={() => toggleBannerEnabled('desktop')}
                  disabled={!bannerDesktop}
                  style={[
                    styles.bannerToggleBtn,
                    bannerDesktop && bannerDesktopEnabled ? styles.bannerToggleBtnOn : styles.bannerToggleBtnOff,
                    !bannerDesktop && styles.bannerToggleBtnDisabled,
                  ]}
                >
                  <Text style={[
                    styles.bannerToggleText,
                    bannerDesktop && bannerDesktopEnabled ? styles.bannerToggleTextOn : styles.bannerToggleTextOff,
                  ]}>
                    {bannerDesktopEnabled ? t('Desactivar escritorio', 'Disable desktop') : t('Activar escritorio', 'Activate desktop')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleBannerEnabled('mobile')}
                  disabled={!bannerMobile}
                  style={[
                    styles.bannerToggleBtn,
                    bannerMobile && bannerMobileEnabled ? styles.bannerToggleBtnOn : styles.bannerToggleBtnOff,
                    !bannerMobile && styles.bannerToggleBtnDisabled,
                  ]}
                >
                  <Text style={[
                    styles.bannerToggleText,
                    bannerMobile && bannerMobileEnabled ? styles.bannerToggleTextOn : styles.bannerToggleTextOff,
                  ]}>
                    {bannerMobileEnabled ? t('Desactivar móvil', 'Disable mobile') : t('Activar móvil', 'Activate mobile')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.bannerDeleteRow}>
                <TouchableOpacity onPress={() => deleteBanner('home')} style={styles.bannerDeleteBtn}><Text style={styles.bannerDeleteText}>{t('Borrar escritorio', 'Delete desktop')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => deleteBanner('home-mobile')} style={styles.bannerDeleteBtn}><Text style={styles.bannerDeleteText}>{t('Borrar móvil', 'Delete mobile')}</Text></TouchableOpacity>
              </View>
              <View style={styles.bannerList}>
                <Text style={styles.bannerListTitle}>{t('Banners y publicidades activos', 'Active banners and ads')}</Text>
                {marketingHomeBanners.length === 0 ? (
                  <Text style={styles.bannerListEmpty}>{t('Todavía no hay banners publicados desde esta nueva gestión.', 'No banners have been published from this new manager yet.')}</Text>
                ) : (
                  marketingHomeBanners.slice(0, 6).map((item, index) => {
                    const img = resolveMarketingBannerImage(item.imageData || item.imageUrl);
                    const frequencyLabel = item.displayMode === 'every3'
                      ? t('Cada 3 banners', 'Every 3 banners')
                      : item.displayMode === 'every5'
                        ? t('Cada 5 banners', 'Every 5 banners')
                        : t('Una sola vez', 'Once');
                    return (
                      <View key={item.id || index} style={styles.bannerListItem}>
                        {img ? <Image source={{ uri: img }} style={styles.bannerListThumb} resizeMode="cover" /> : <View style={styles.bannerListThumb} />}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.bannerListName} numberOfLines={1}>{item.bannerType === 'ad' ? t('Publicidad', 'Ad') : t('Banner', 'Banner')}</Text>
                          <Text style={styles.bannerListMeta} numberOfLines={1}>{frequencyLabel}</Text>
                        </View>
                        <BannerPublishBadge published={item.isActive !== false} />
                      </View>
                    );
                  })
                )}
              </View>
            </PanelCard>

            <MarketingRow
              title={t('Promociones', 'Promotions')}
              copy={t('Activa mensajes comerciales, descuentos o campanas.', 'Enable commercial messages, discounts or campaigns.')}
              enabled={marketingPromoEnabled}
              onToggle={() => setMarketingPromoEnabled(!marketingPromoEnabled)}
            />

          </>
        )}
        {active === 'analytics' && (
          <>
            {/* ─── Header ─── */}
            <View style={styles.anHeader}>
              {selectedAnalyticsEvent && (
                <TouchableOpacity
                  onPress={backToAdminEventsFromAnalytics}
                  style={styles.anBackBtn}
                  activeOpacity={0.84}
                  accessibilityLabel={t('Volver a eventos', 'Back to events')}
                >
                  <Ionicons name="chevron-back" size={19} color="#F97316" />
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.anTitle}>{selectedAnalyticsEvent ? t('Analíticas del evento', 'Event analytics') : t('Analíticas', 'Analytics')}</Text>
                <Text style={styles.anSubtitle}>{selectedAnalyticsEvent?.title || t('Visitas del sitio y eventos más vistos', 'Site visits and most viewed events')}</Text>
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

            {selectedAnalyticsEvent && (
              <View style={styles.anSelectedEventCard}>
                <View style={styles.anSelectedImageWrap}>
                  {selectedAnalyticsEvent.imageUrl ? (
                    <Image source={{ uri: selectedAnalyticsEvent.imageUrl }} style={styles.anSelectedImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.anSelectedImageFallback}>
                      <Ionicons name="calendar-outline" size={24} color="rgba(249,115,22,0.75)" />
                    </View>
                  )}
                </View>
                <View style={styles.anSelectedCopy}>
                  <Text style={styles.anSelectedEyebrow}>{t('EVENTO SELECCIONADO', 'SELECTED EVENT')}</Text>
                  <Text style={styles.anSelectedTitle} numberOfLines={2}>{selectedAnalyticsEvent.title}</Text>
                  <Text style={styles.anSelectedMeta} numberOfLines={1}>{selectedAnalyticsEvent.date || selectedAnalyticsEvent.venue || selectedAnalyticsEvent.slug}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedAnalyticsEvent(null)} style={styles.anSelectedClear}>
                  <Ionicons name="close" size={16} color="rgba(226,232,240,0.72)" />
                </TouchableOpacity>
              </View>
            )}

            {/* ─── Stat cards 2-col grid ─── */}
            <View style={styles.anStatGrid}>
              {(selectedAnalyticsEvent ? [
                { label: t('Vistas del evento', 'Event views'), value: analyticsSummary?.totalViews ?? 0, icon: 'eye-outline' as const },
                { label: t('Visitantes', 'Visitors'), value: analyticsSummary?.uniqueVisitors ?? 0, icon: 'people-outline' as const },
                { label: t('Actividad reciente', 'Recent activity'), value: analyticsSummary?.recentViews.length ?? 0, icon: 'flash-outline' as const },
                { label: t('Páginas vistas', 'Viewed pages'), value: analyticsSummary?.topPages.length ?? 0, icon: 'bar-chart-outline' as const },
              ] : [
                { label: t('Vistas totales', 'Total views'), value: analyticsSummary?.totalViews ?? 0, icon: 'eye-outline' as const },
                { label: t('Visitantes únicos', 'Unique visitors'), value: analyticsSummary?.uniqueVisitors ?? 0, icon: 'people-outline' as const },
                { label: t('Eventos vistos', 'Viewed events'), value: analyticsSummary?.topEvents.length ?? 0, icon: 'flash-outline' as const },
                { label: t('Páginas vistas', 'Viewed pages'), value: (analyticsSummary?.topPages ?? []).length, icon: 'bar-chart-outline' as const },
              ]).map((s, index) => (
                <View key={`${s.label}-${index}`} style={styles.anStatCard}>
                  <View style={styles.anStatTop}>
                    <Text style={styles.anStatLabel}>{s.label}</Text>
                    <View style={styles.anStatIconBox}><Ionicons name={s.icon} size={16} color={colors.orange} /></View>
                  </View>
                  <Text style={styles.anStatValue}>{s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : String(s.value)}</Text>
                </View>
              ))}
            </View>

            {selectedAnalyticsEvent && (
              <>
                <View style={styles.anStatGrid}>
                  {[
                    { label: t('Facturado total', 'Total charged'), value: `$${Number(selectedAnalyticsFinancial?.totalCharged ?? selectedAnalyticsSales?.totalRevenue ?? 0).toFixed(2)}`, icon: 'card-outline' as const },
                    { label: t('Ingresos entradas', 'Ticket sales'), value: `$${Number(selectedAnalyticsFinancial?.ticketSales ?? selectedAnalyticsSales?.totalRevenue ?? 0).toFixed(2)}`, icon: 'cash-outline' as const },
                    { label: t('Órdenes', 'Orders'), value: selectedAnalyticsPaidOrders.length || selectedAnalyticsFinancial?.orders || 0, icon: 'receipt-outline' as const },
                    { label: t('Tickets vendidos', 'Tickets sold'), value: selectedAnalyticsPaidTickets || 0, icon: 'ticket-outline' as const },
                  ].map((s, index) => (
                    <View key={`${s.label}-${index}`} style={styles.anStatCard}>
                      <View style={styles.anStatTop}>
                        <Text style={styles.anStatLabel}>{s.label}</Text>
                        <View style={styles.anStatIconBox}><Ionicons name={s.icon} size={16} color={colors.orange} /></View>
                      </View>
                      <Text style={styles.anStatValue}>{typeof s.value === 'number' && s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : String(s.value)}</Text>
                    </View>
                  ))}
                </View>

                {selectedAnalyticsLoading ? (
                  <View style={styles.anStatCard}><Text style={styles.anStatLabel}>{t('Cargando analítica del evento...', 'Loading event analytics...')}</Text></View>
                ) : (
                  <OrganizerAnalyticsMobile
                    sales={selectedAnalyticsSales}
                    attendees={selectedAnalyticsAttendees}
                    sections={selectedAnalyticsSections}
                    eventTitle={selectedAnalyticsEvent.title}
                  />
                )}
              </>
            )}

            {analyticsLoading && (
              <View style={styles.anStatCard}><Text style={styles.anStatLabel}>{t('Cargando...', 'Loading...')}</Text></View>
            )}

            {/* ─── Top events ─── */}
            {!selectedAnalyticsEvent && (analyticsSummary?.topEvents ?? []).length > 0 && (
              <View style={styles.anSection}>
                <Text style={styles.anSectionTitle}>{t('Eventos más vistos', 'Top events')}</Text>
                {(analyticsSummary?.topEvents ?? []).slice(0, 5).map((ev, i) => (
                  <View key={`${ev.eventSlug || ev.eventTitle || 'top-event'}-${i}`} style={styles.anRankRow}>
                    <View style={styles.anRankNum}><Text style={styles.anRankNumText}>{i + 1}</Text></View>
                    <Text style={styles.anRankTitle} numberOfLines={1}>{ev.eventTitle || formatEventSlug(ev.eventSlug)}</Text>
                    <Text style={styles.anRankMeta}>{ev.views} {t('vistas', 'views')} · {ev.visitors} {t('visitantes', 'visitors')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ─── Top pages ─── */}
            {!selectedAnalyticsEvent && (analyticsSummary?.topPages ?? []).length > 0 && (
              <View style={styles.anSection}>
                <Text style={styles.anSectionTitle}>{t('Páginas más vistas', 'Top pages')}</Text>
                {(analyticsSummary?.topPages ?? []).slice(0, 5).map((page, i) => (
                  <View key={`${page.path || 'top-page'}-${i}`} style={styles.anRankRow}>
                    <View style={styles.anRankNum}><Text style={styles.anRankNumText}>{i + 1}</Text></View>
                    <Text style={styles.anRankTitle} numberOfLines={1}>{page.path}</Text>
                    <Text style={styles.anRankMeta}>{page.views} {t('vistas', 'views')} · {page.visitors} {t('visitantes', 'visitors')}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* ─── Recent activity ─── */}
            {!selectedAnalyticsEvent && (analyticsSummary?.recentViews ?? []).length > 0 && (
              <View style={styles.anSection}>
                <TouchableOpacity onPress={() => setAnalyticsRecentOpen((v) => !v)} style={styles.anRecentHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.anSectionTitle}>{t('Actividad reciente', 'Recent activity')}</Text>
                    <Text style={styles.anRecentCount}>{analyticsSummary!.recentViews.length} {t('vistas', 'views')}</Text>
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
                          <Text style={styles.anTableColPath}>{t('RUTA', 'PATH')}</Text>
                          <Text style={styles.anTableColEvent}>{t('EVENTO', 'EVENT')}</Text>
                        </View>
                        {analyticsSummary!.recentViews.map((view, i) => (
                          <View key={`${view.id || view.path || 'recent-view'}-${i}`} style={styles.anTableRow}>
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
            <GradientButton label={codesLoading ? t('Actualizando...', 'Updating...') : t('Actualizar', 'Refresh')} onPress={() => { setCodesLoaded(false); setCodesLoading(false); }} height={42} style={{ marginBottom: 14 }} />

            {!codesLoading && (
              <>
                <View style={styles.codeStatRow}>
                  <View style={styles.codeStatCard}>
                    <View style={styles.codeStatTop}><Text style={styles.codeStatLabel}>{t('TOTAL', 'TOTAL')}</Text><Ionicons name="pricetag-outline" size={18} color={colors.orange} /></View>
                    <Text style={styles.codeStatValue}>{apiCodes.length}</Text>
                  </View>
                  <View style={styles.codeStatCard}>
                    <View style={styles.codeStatTop}><Text style={styles.codeStatLabel}>{t('ACTIVO', 'ACTIVE')}</Text><Ionicons name="checkmark-circle-outline" size={18} color="#4ADE80" /></View>
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
                  <Text style={styles.codeCreateTitle}>{t('Crear código', 'Create code')}</Text>
                  <Text style={styles.codeCreateSub}>{t('La recompensa se configura por evento y se paga manualmente.', 'Reward is configured per event and paid manually.')}</Text>
                </View>
              </View>

              <FieldLabel label={t('CÓDIGO', 'CODE')} />
              <TextInput value={specialCodeDraft} onChangeText={(v) => setSpecialCodeDraft(v.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="MARIA" placeholderTextColor="#9CA3AF" autoCapitalize="characters" style={styles.codeInput} />

              <FieldLabel label={t('DUEÑO DEL CÓDIGO', 'CODE OWNER')} />
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
                  {ownerSearchResults.map((u, index) => (
                    <TouchableOpacity key={`${u.id || u.email || 'owner'}-${index}`} onPress={() => { setSpecialCodeOwnerDraft(u.id); setOwnerSearchQuery(`${u.name} (${u.email})`); setOwnerSearchResults([]); }} style={styles.ownerResultRow}>
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

              <FieldLabel label={t('EVENTO', 'EVENT')} />
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
                    {adminEvents.slice(0, 10).map((ev, index) => (
                      <TouchableOpacity key={`${ev.id || ev.slug || 'code-event'}-${index}`} onPress={() => setCodeEventId(ev.id)} style={[styles.codeEventPill, codeEventId === ev.id && styles.codeEventPillActive]}>
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

              <GradientButton label={t('+ CREAR CÓDIGO', '+ CREATE CODE')} onPress={addSpecialCode} height={48} style={{ marginTop: 8 }} />
            </View>

            {/* Created codes list */}
            <View style={styles.createdCodesHeader}>
              <View>
                <Text style={styles.createdCodesTitle}>{t('Códigos creados', 'Created codes')}</Text>
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
            }).map((item, index) => {
              const ownerName = [item.owner?.firstName, item.owner?.lastName].filter(Boolean).join(' ') || item.owner?.email || item.ownerUserId.slice(0, 8);
              return (
                <View key={`${item.id || item.code || 'code'}-${index}`} style={styles.codeCard2}>
                  <Text style={styles.codeCard2Label}>{t('CÓDIGO', 'CODE')}</Text>
                  <Text style={styles.codeCard2Code}>{item.code}</Text>
                  <Text style={styles.codeCard2Label}>{t('DUEÑO', 'OWNER')}</Text>
                  <View style={styles.codeCard2OwnerRow}>
                    <Ionicons name="person-outline" size={13} color="rgba(226,232,240,0.5)" />
                    <Text style={styles.codeCard2OwnerName}>{ownerName}</Text>
                  </View>
                  {item.owner?.email ? <Text style={styles.codeCard2OwnerEmail}>{item.owner.email}</Text> : null}
                  <Text style={styles.codeCard2Label}>{t('EVENTO', 'EVENT')}</Text>
                  <Text style={styles.codeCard2Event}>{item.event?.title || t('Todos', 'All')}</Text>
                  <View style={styles.codeCard2Actions}>
                    <TouchableOpacity onPress={() => { setEditingCode(item); setEditCodeForm({ code: item.code, ownerUserId: item.ownerUserId, ownerName: ownerName, ownerEmail: item.owner?.email || '', eventId: item.eventId || '', isActive: item.isActive }); setEditCodeOwnerQuery(`${ownerName}${item.owner?.email ? ` (${item.owner.email})` : ''}`); setEditCodeOwnerResults([]); }} style={styles.codeEditBtn}>
                      <Ionicons name="pencil-outline" size={15} color={colors.orange} />
                      <Text style={styles.codeEditBtnText}>{t('Editar', 'Edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteCodeApi(item.id)} style={styles.codeDeleteBtn}>
                      <Text style={styles.codeDeleteBtnText}>{t('Eliminar', 'Delete')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleSpecialCode(item.id)} style={[styles.codeStatusBtn, item.isActive ? styles.codeStatusBtnActive : styles.codeStatusBtnInactive]}>
                      <Ionicons name={item.isActive ? 'checkmark-circle-outline' : 'close-circle-outline'} size={14} color={item.isActive ? '#4ADE80' : '#94A3B8'} />
                      <Text style={[styles.codeStatusBtnText, { color: item.isActive ? '#4ADE80' : '#94A3B8' }]}>{item.isActive ? t('Activo', 'Active') : t('Inactivo', 'Inactive')}</Text>
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
                    <Text style={styles.eventRewardsTitle}>{t('Recompensas por evento', 'Event rewards')}</Text>
                    <Text style={styles.eventRewardsSub}>{t('Administra la recompensa base por evento cuando se usa un código de creador.', 'Manage the base reward per event when creator codes are used.')}</Text>
                  </View>
                </View>
                {adminEvents.map((ev, index) => {
                  const orgName = [ev.organizer?.firstName, ev.organizer?.lastName].filter(Boolean).join(' ') || ev.organizerName || '-';
                  const current = Number(ev.creatorCommission || 0);
                  const rewardVal = eventRewards[ev.id] !== undefined ? eventRewards[ev.id] : current.toFixed(2);
                  return (
                    <View key={`${ev.id || ev.slug || 'reward-event'}-${index}`} style={styles.eventRewardCard}>
                      <Text style={styles.eventRewardFieldLabel}>{t('EVENTO', 'EVENT')}</Text>
                      <Text style={styles.eventRewardEventTitle}>{adminEventTitle(ev)}</Text>
                      <Text style={styles.eventRewardFieldLabel}>{t('ORGANIZADOR', 'ORGANIZER')}</Text>
                      <Text style={styles.eventRewardOrgName}>{orgName}</Text>
                      <Text style={styles.eventRewardFieldLabel}>{t('ACTUAL', 'CURRENT')}</Text>
                      <Text style={styles.eventRewardCurrent}>${current.toFixed(2)}</Text>
                      <Text style={styles.eventRewardFieldLabel}>{t('RECOMPENSA BASE ($)', 'BASE REWARD ($)')}</Text>
                      <TextInput
                        value={rewardVal}
                        onChangeText={(v) => setEventRewards((prev) => ({ ...prev, [ev.id]: v }))}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                      />
                      <GradientButton
                        label={savingEventReward === ev.id ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR', 'SAVE')}
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
                          {entry.payouts.map((p, index) => (
                            <Text key={`${p.id || 'payout'}-${index}`} style={styles.payoutHistoryItem}>
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
                ].map((s, index) => (
                  <View key={`${s.label}-${index}`} style={styles.mktStatCard}>
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
                <TouchableOpacity
                  onPress={() => {
                    if (emailAudience === 'all') {
                      setEmailAudience('specify');
                      setEmailRecipientPickerOpen(true);
                    } else {
                      setEmailRecipientPickerOpen((open) => !open);
                    }
                  }}
                  style={styles.mktSelectInner}
                >
                  <Text style={styles.mktSelectText}>
                    {emailAudience === 'all'
                      ? t('Enviar a todos los usuarios', 'Send to all users')
                      : selectedEmailRecipients.length > 0
                        ? t(`${selectedEmailRecipients.length} destinatarios seleccionados`, `${selectedEmailRecipients.length} selected recipients`)
                        : t('Especificar destinatarios', 'Specify recipients')}
                  </Text>
                  <Ionicons name={emailAudience === 'specify' && emailRecipientPickerOpen ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(226,232,240,0.5)" />
                </TouchableOpacity>
              </View>
              {emailAudience === 'specify' && emailRecipientPickerOpen ? (
                <View style={styles.mktEmailRecipientPanel}>
                  <View style={styles.mktEmailRecipientHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mktEmailRecipientTitle}>{t('Destinatarios', 'Recipients')}</Text>
                      <Text style={styles.mktEmailRecipientSub}>{t(`${selectedEmailRecipients.length} seleccionados`, `${selectedEmailRecipients.length} selected`)}</Text>
                    </View>
                    {emailRecipientIds.length > 0 ? (
                      <TouchableOpacity onPress={() => setEmailRecipientIds([])} style={styles.mktEmailRecipientClear} activeOpacity={0.82}>
                        <Text style={styles.mktEmailRecipientClearText}>{t('Limpiar', 'Clear')}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => {
                        setEmailAudience('all');
                        setEmailRecipientPickerOpen(false);
                      }}
                      style={styles.mktEmailRecipientClear}
                      activeOpacity={0.82}
                    >
                      <Text style={styles.mktEmailRecipientClearText}>{t('Todos', 'All')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.mktPushSearchBox}>
                    <Ionicons name="search" size={16} color={colors.orange} />
                    <TextInput
                      value={emailRecipientSearch}
                      onChangeText={setEmailRecipientSearch}
                      placeholder={t('Buscar por nombre o email...', 'Search by name or email...')}
                      placeholderTextColor="rgba(226,232,240,0.38)"
                      style={styles.mktPushSearchInput}
                      autoCapitalize="none"
                    />
                    {emailRecipientSearch ? (
                      <TouchableOpacity onPress={() => setEmailRecipientSearch('')} activeOpacity={0.8}>
                        <Ionicons name="close-circle" size={16} color="rgba(226,232,240,0.5)" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <ScrollView style={styles.mktEmailRecipientList} nestedScrollEnabled showsVerticalScrollIndicator={filteredEmailRecipients.length > 5}>
                    {emailRecipients.length === 0 ? (
                      <View style={styles.mktPushRecipientEmpty}>
                        <Text style={styles.mktPushRecipientEmail}>{t('No hay usuarios con email cargados.', 'No users with email loaded.')}</Text>
                      </View>
                    ) : filteredEmailRecipients.length === 0 ? (
                      <View style={styles.mktPushRecipientEmpty}>
                        <Text style={styles.mktPushRecipientEmail}>{t('No encontramos usuarios con ese texto.', 'No users match that search.')}</Text>
                      </View>
                    ) : filteredEmailRecipients.map((recipient) => {
                      const selected = emailRecipientIds.includes(recipient.id);
                      return (
                        <TouchableOpacity
                          key={recipient.id}
                          onPress={() => {
                            setEmailRecipientIds((current) => (
                              selected ? current.filter((id) => id !== recipient.id) : [...current, recipient.id]
                            ));
                            setEmailRecipientPickerOpen(false);
                          }}
                          style={[styles.mktPushRecipientRow, selected && styles.mktPushRecipientRowActive]}
                          activeOpacity={0.86}
                        >
                          <View style={[styles.mktEmailCheck, selected && styles.mktEmailCheckActive]}>
                            {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                          </View>
                          <View style={styles.mktPushRecipientAvatar}>
                            <Text style={styles.mktPushRecipientAvatarText}>{(recipient.name || recipient.email || '?').trim().slice(0, 1).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.mktPushRecipientName} numberOfLines={1}>{recipient.name || recipient.email}</Text>
                            <Text style={styles.mktPushRecipientEmail} numberOfLines={1}>{recipient.email}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

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
              <Text style={styles.mktFootNote}>{emailAudience === 'all' ? t('Se envía a todos los usuarios registrados.', 'Sent to all registered users.') : t(`Se envía solo a ${selectedEmailRecipients.length} destinatarios seleccionados.`, `Sent only to ${selectedEmailRecipients.length} selected recipients.`)}</Text>
            </View>

            {/* ─── Preview premium ─── */}
            <View style={styles.mktCard}>
              <View style={styles.mktPreviewHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>{t('Preview premium', 'Premium preview')}</Text>
                  <Text style={styles.mktCardSub}>{t('Vista tipo email para aprobar el arte antes de activar pruebas.', 'Email-type view to approve art before activating tests.')}</Text>
                </View>
                <View style={styles.mktPreviewMailBadge}><Text style={styles.mktPreviewMailText}>{t('Correo', 'Mail')}</Text></View>
              </View>
              {/* Outer gray shell — matches web's bg-slate-100 wrapper */}
              <View style={styles.mktEmailShell}>
                {/* Inner white card — matches web's bg-white border shadow card */}
                <View style={styles.mktEmailPreview}>
                  {/* Logo */}
                  <View style={styles.mktPreviewLogoRow}>
                    <Image source={require('../../assets/logo-header.png')} style={styles.mktPreviewLogoImg} resizeMode="contain" />
                  </View>
                  {/* Art */}
                  {emailArtData ? (
                    <Image source={{ uri: emailArtData }} style={styles.mktPreviewArt} resizeMode="contain" />
                  ) : (
                    <View style={styles.mktPreviewArtEmpty}>
                      <Ionicons name="image-outline" size={44} color="rgba(248,250,252,0.72)" />
                      <Text style={styles.mktPreviewArtText}>{t('Tu arte de Photoshop aparecerá aquí', 'Your Photoshop art will appear here')}</Text>
                    </View>
                  )}
                  {/* Body */}
                  <View style={styles.mktPreviewBody}>
                    <Text style={styles.mktPreviewBodyTitle}>{campaignName || t('Titulo opcional de campaña', 'Optional campaign title')}</Text>
                    <Text style={styles.mktPreviewBodyCopy}>{campaignPreheader || t('Texto breve opcional para acompañar la imagen principal del email.', 'Optional brief text to accompany the main email image.')}</Text>
                    <View style={styles.mktPreviewBtn}><Text style={styles.mktPreviewBtnText}>{campaignLink ? t('VER DETALLES', 'VIEW DETAILS') : t('VER EVENTO', 'VIEW EVENT')}</Text></View>
                  </View>
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

            {/* ─── Push Notifications ─── */}
            <View style={styles.mktPushCard}>
              <View style={styles.mktCardHeader}>
                <View style={styles.mktPushIcon}>
                  <Ionicons name="notifications-outline" size={20} color={colors.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mktCardTitle}>{t('Notificaciones push', 'Push notifications')}</Text>
                  <Text style={styles.mktCardSub}>{t('Envía avisos directos a la app, a todos o a un usuario específico.', 'Send direct app alerts to everyone or one specific user.')}</Text>
                </View>
              </View>

              <View style={styles.mktPushModeRow}>
                <TouchableOpacity onPress={() => setPushAudience('all')} style={[styles.mktPushModeBtn, pushAudience === 'all' && styles.mktPushModeBtnActive]} activeOpacity={0.86}>
                  <Ionicons name="people-outline" size={14} color={pushAudience === 'all' ? colors.orange : 'rgba(226,232,240,0.5)'} />
                  <Text style={[styles.mktPushModeText, pushAudience === 'all' && styles.mktPushModeTextActive]}>{t('Todos', 'All')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPushAudience('user')} style={[styles.mktPushModeBtn, pushAudience === 'user' && styles.mktPushModeBtnActive]} activeOpacity={0.86}>
                  <Ionicons name="person-outline" size={14} color={pushAudience === 'user' ? colors.orange : 'rgba(226,232,240,0.5)'} />
                  <Text style={[styles.mktPushModeText, pushAudience === 'user' && styles.mktPushModeTextActive]}>{t('Usuario', 'User')}</Text>
                </TouchableOpacity>
              </View>

              {pushAudience === 'user' ? (
                <View style={styles.mktPushPickerWrap}>
                  <TouchableOpacity onPress={() => setPushRecipientPickerOpen((value) => !value)} style={styles.mktPushUserSelect} activeOpacity={0.86}>
                    <View style={styles.mktPushUserSelectIcon}>
                      <Ionicons name="person-circle-outline" size={17} color={colors.orange} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.mktPushUserSelectTitle} numberOfLines={1}>
                        {selectedPushRecipient?.name || t('Seleccionar usuario', 'Select user')}
                      </Text>
                      <Text style={styles.mktPushUserSelectSub} numberOfLines={1}>
                        {selectedPushRecipient?.email || t(`${marketingRecipients.length} usuarios disponibles`, `${marketingRecipients.length} available users`)}
                      </Text>
                    </View>
                    <Ionicons name={pushRecipientPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(226,232,240,0.58)" />
                  </TouchableOpacity>
                  {pushRecipientPickerOpen ? (
                    <View style={styles.mktPushRecipientPanel}>
                      <View style={styles.mktPushSearchBox}>
                        <Ionicons name="search" size={16} color={colors.orange} />
                        <TextInput
                          value={pushRecipientSearch}
                          onChangeText={setPushRecipientSearch}
                          placeholder={t('Buscar usuario...', 'Search user...')}
                          placeholderTextColor="rgba(226,232,240,0.38)"
                          style={styles.mktPushSearchInput}
                        />
                        {pushRecipientSearch ? (
                          <TouchableOpacity onPress={() => setPushRecipientSearch('')} activeOpacity={0.8}>
                            <Ionicons name="close-circle" size={16} color="rgba(226,232,240,0.5)" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <ScrollView style={styles.mktPushRecipientList} nestedScrollEnabled showsVerticalScrollIndicator={filteredPushRecipients.length > 6}>
                        {marketingRecipients.length === 0 ? (
                        <View style={styles.mktPushRecipientEmpty}>
                          <Text style={styles.mktPushRecipientEmail}>{t('No hay usuarios cargados todavía.', 'No users loaded yet.')}</Text>
                        </View>
                        ) : filteredPushRecipients.length === 0 ? (
                          <View style={styles.mktPushRecipientEmpty}>
                            <Text style={styles.mktPushRecipientEmail}>{t('No encontramos usuarios con ese texto.', 'No users match that search.')}</Text>
                          </View>
                        ) : filteredPushRecipients.map((recipient) => (
                        <TouchableOpacity
                          key={recipient.id}
                          onPress={() => {
                            setPushRecipientId(recipient.id);
                            setPushRecipientPickerOpen(false);
                            setPushRecipientSearch('');
                          }}
                          style={[styles.mktPushRecipientRow, pushRecipientId === recipient.id && styles.mktPushRecipientRowActive]}
                          activeOpacity={0.86}
                        >
                          <View style={styles.mktPushRecipientAvatar}>
                            <Text style={styles.mktPushRecipientAvatarText}>{(recipient.name || recipient.email || '?').trim().slice(0, 1).toUpperCase()}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.mktPushRecipientName} numberOfLines={1}>{recipient.name || recipient.email}</Text>
                            <Text style={styles.mktPushRecipientEmail} numberOfLines={1}>{recipient.email}</Text>
                          </View>
                        </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.mktPushAudienceInfo}>
                  <Ionicons name="radio-outline" size={15} color={colors.orange} />
                  <Text style={styles.mktPushAudienceInfoText}>{t(`${recipientsCount} usuarios registrados`, `${recipientsCount} registered users`)}</Text>
                </View>
              )}

              <TextInput value={pushTitle} onChangeText={setPushTitle} placeholder={t('Título de la notificación', 'Notification title')} placeholderTextColor="rgba(226,232,240,0.35)" style={styles.mktInput} maxLength={80} />
              <TextInput value={pushMessage} onChangeText={setPushMessage} placeholder={t('Mensaje push...', 'Push message...')} placeholderTextColor="rgba(226,232,240,0.35)" multiline numberOfLines={4} maxLength={120} style={styles.mktTextArea} />
              <Text style={styles.mktCharCount}>{pushMessage.length}/120</Text>
              <View style={styles.mktPushDestinationRow}>
                {([
                  ['none', t('Sin destino', 'No destination'), 'remove-circle-outline'],
                  ['event', t('Evento', 'Event'), 'ticket-outline'],
                  ['external', t('Link externo', 'External link'), 'link-outline'],
                ] as const).map(([key, label, icon]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      setPushDestination(key);
                      setPushEventPickerOpen(false);
                    }}
                    style={[styles.mktPushDestinationBtn, pushDestination === key && styles.mktPushDestinationBtnActive]}
                    activeOpacity={0.86}
                  >
                    <Ionicons name={icon as any} size={13} color={pushDestination === key ? colors.orange : 'rgba(226,232,240,0.48)'} />
                    <Text style={[styles.mktPushDestinationText, pushDestination === key && styles.mktPushDestinationTextActive]} numberOfLines={1}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {pushDestination === 'event' ? (
                <View style={styles.mktPushLinkWrap}>
                  <TouchableOpacity onPress={() => setPushEventPickerOpen((value) => !value)} style={styles.mktPushUserSelect} activeOpacity={0.86}>
                    <View style={styles.mktPushUserSelectIcon}>
                      <Ionicons name="ticket-outline" size={15} color={colors.orange} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.mktPushUserSelectTitle} numberOfLines={1}>{selectedPushEvent ? adminEventTitle(selectedPushEvent) : t('Seleccionar evento', 'Select event')}</Text>
                      <Text style={styles.mktPushUserSelectSub} numberOfLines={1}>{selectedPushEvent ? adminEventDate(selectedPushEvent) : t('Abrirá este evento dentro de la app', 'Opens this event inside the app')}</Text>
                    </View>
                    <Ionicons name={pushEventPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(226,232,240,0.58)" />
                  </TouchableOpacity>
                  {pushEventPickerOpen ? (
                    <ScrollView style={styles.mktPushEventList} nestedScrollEnabled showsVerticalScrollIndicator={pushDestinationEvents.length > 5}>
                      {pushDestinationEvents.length === 0 ? (
                        <View style={styles.mktPushRecipientEmpty}>
                          <Text style={styles.mktPushRecipientEmail}>{t('No hay eventos activos disponibles.', 'No active events available.')}</Text>
                        </View>
                      ) : pushDestinationEvents.map((event) => (
                        <TouchableOpacity
                          key={String(event.id || event.slug)}
                          onPress={() => {
                            setPushEventId(String(event.id));
                            setPushEventPickerOpen(false);
                          }}
                          style={[styles.mktPushRecipientRow, pushEventId === String(event.id) && styles.mktPushRecipientRowActive]}
                          activeOpacity={0.86}
                        >
                          <View style={styles.mktPushRecipientAvatar}>
                            <Ionicons name="calendar-outline" size={14} color={colors.orange} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.mktPushRecipientName} numberOfLines={1}>{adminEventTitle(event)}</Text>
                            <Text style={styles.mktPushRecipientEmail} numberOfLines={1}>{adminEventDate(event)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ) : null}

              {pushDestination === 'external' ? (
                <View style={styles.mktPushLinkBox}>
                  <Ionicons name="link-outline" size={16} color={colors.orange} />
                  <TextInput
                    value={pushLink}
                    onChangeText={setPushLink}
                    placeholder={t('https://tu-link.com', 'https://your-link.com')}
                    placeholderTextColor="rgba(226,232,240,0.35)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.mktPushLinkInput}
                  />
                </View>
              ) : null}

              <View style={styles.mktPushPreview}>
                <View style={styles.mktPushPreviewIcon}><Ionicons name="ticket-outline" size={15} color={colors.orange} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.mktPushPreviewTitle} numberOfLines={1}>{pushTitle || t('LPTicket', 'LPTicket')}</Text>
                  <Text style={styles.mktPushPreviewBody} numberOfLines={2}>{pushMessage || t('Tu notificación se verá así.', 'Your notification will look like this.')}</Text>
                </View>
              </View>

              <GradientButton label={sending === 'push' ? t('ENVIANDO...', 'SENDING...') : t('ENVIAR PUSH', 'SEND PUSH')} onPress={sendPush} height={48} style={{ marginTop: 10 }} />
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
              {/* Audience selector */}
              <View style={styles.mktPushModeRow}>
                <TouchableOpacity onPress={() => { setWaAudience('all'); setWaPickerOpen(false); }} style={[styles.mktPushModeBtn, waAudience === 'all' && styles.mktPushModeBtnActive]} activeOpacity={0.86}>
                  <Ionicons name="people-outline" size={14} color={waAudience === 'all' ? colors.orange : 'rgba(226,232,240,0.5)'} />
                  <Text style={[styles.mktPushModeText, waAudience === 'all' && styles.mktPushModeTextActive]}>{t('Todos', 'All')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setWaAudience('specify')} style={[styles.mktPushModeBtn, waAudience === 'specify' && styles.mktPushModeBtnActive]} activeOpacity={0.86}>
                  <Ionicons name="person-outline" size={14} color={waAudience === 'specify' ? colors.orange : 'rgba(226,232,240,0.5)'} />
                  <Text style={[styles.mktPushModeText, waAudience === 'specify' && styles.mktPushModeTextActive]}>{t('Específicos', 'Specific')}</Text>
                </TouchableOpacity>
              </View>

              {waAudience === 'specify' && (
                <View style={styles.mktPushPickerWrap}>
                  <TouchableOpacity onPress={() => setWaPickerOpen((v) => !v)} style={styles.mktPushUserSelect} activeOpacity={0.86}>
                    <View style={styles.mktPushUserSelectIcon}>
                      <Ionicons name="logo-whatsapp" size={17} color="#25D366" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.mktPushUserSelectTitle} numberOfLines={1}>
                        {waSel.length > 0 ? t(`${waSel.length} seleccionado(s)`, `${waSel.length} selected`) : t('Seleccionar usuarios', 'Select users')}
                      </Text>
                      <Text style={styles.mktPushUserSelectSub} numberOfLines={1}>
                        {t(`${marketingRecipients.filter((u) => u.phone).length} con teléfono registrado`, `${marketingRecipients.filter((u) => u.phone).length} with phone registered`)}
                      </Text>
                    </View>
                    <Ionicons name={waPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(226,232,240,0.58)" />
                  </TouchableOpacity>
                  {waPickerOpen && (
                    <View style={styles.mktPushRecipientPanel}>
                      <View style={styles.mktPushSearchBox}>
                        <Ionicons name="search" size={16} color={colors.orange} />
                        <TextInput
                          value={waSearch}
                          onChangeText={setWaSearch}
                          placeholder={t('Buscar usuario...', 'Search user...')}
                          placeholderTextColor="rgba(226,232,240,0.38)"
                          style={styles.mktPushSearchInput}
                        />
                        {waSearch ? (
                          <TouchableOpacity onPress={() => setWaSearch('')} activeOpacity={0.8}>
                            <Ionicons name="close-circle" size={16} color="rgba(226,232,240,0.5)" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6 }}>
                        <TouchableOpacity onPress={() => setWaSel(marketingRecipients.filter((u) => u.phone).map((u) => u.id))}>
                          <Text style={{ color: colors.orange, fontSize: 11, fontWeight: '600' }}>{t('Todos', 'All')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setWaSel([])}>
                          <Text style={{ color: 'rgba(226,232,240,0.5)', fontSize: 11, fontWeight: '600' }}>{t('Ninguno', 'None')}</Text>
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.mktPushRecipientList} nestedScrollEnabled showsVerticalScrollIndicator>
                        {marketingRecipients.length === 0 ? (
                          <View style={styles.mktPushRecipientEmpty}>
                            <Text style={styles.mktPushRecipientEmail}>{t('No hay usuarios cargados.', 'No users loaded.')}</Text>
                          </View>
                        ) : marketingRecipients.filter((u) => {
                            const q = waSearch.toLowerCase();
                            return !q || `${u.name} ${u.email} ${u.phone || ''}`.toLowerCase().includes(q);
                          }).map((u) => {
                            const selected = waSel.includes(u.id);
                            const hasPhone = !!u.phone;
                            return (
                              <TouchableOpacity
                                key={u.id}
                                onPress={() => {
                                  if (!hasPhone) return;
                                  setWaSel((prev) => prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]);
                                }}
                                style={[styles.mktPushRecipientRow, selected && styles.mktPushRecipientRowActive, !hasPhone && { opacity: 0.4 }]}
                                activeOpacity={hasPhone ? 0.86 : 1}
                              >
                                <View style={styles.mktPushRecipientAvatar}>
                                  <Text style={styles.mktPushRecipientAvatarText}>{(u.name || u.email || '?').trim().slice(0, 1).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={styles.mktPushRecipientName} numberOfLines={1}>{u.name || u.email}</Text>
                                  <Text style={styles.mktPushRecipientEmail} numberOfLines={1}>{hasPhone ? u.phone : t('Sin teléfono', 'No phone')}</Text>
                                </View>
                                {selected && <Ionicons name="checkmark-circle" size={18} color={colors.orange} />}
                              </TouchableOpacity>
                            );
                          })
                        }
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.mktWaHint}>
                {t('Tu texto va en ', 'Your text goes in ')}<Text style={{ color: colors.orange, fontWeight: '600' }}>{'{{2}}'}</Text>{t('. El nombre del cliente se completa solo en ', '. The customer name is filled in ')}<Text style={{ color: colors.orange, fontWeight: '600' }}>{'{{1}}'}</Text>{t('. Si quieres un enlace, escríbelo dentro del mensaje.', '. To add a link, write it inside the message.')}
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

function BannerPublishBadge({ published }: { published: boolean }) {
  return (
    <View style={[styles.bannerPublishBadge, published ? styles.bannerPublishBadgeOn : styles.bannerPublishBadgeOff]}>
      <View style={[styles.bannerPublishDot, published ? styles.bannerPublishDotOn : styles.bannerPublishDotOff]} />
      <Text style={[styles.bannerPublishText, published ? styles.bannerPublishTextOn : styles.bannerPublishTextOff]}>
        {published ? 'Publicado' : 'No publicado'}
      </Text>
    </View>
  );
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
    <View style={[styles.marketingCard, enabled && styles.marketingCardActive]}>
      <View style={styles.marketingRowTop}>
        <View style={[styles.marketingStateIcon, enabled ? styles.marketingStateIconOn : styles.marketingStateIconOff]}>
          <Text style={[styles.marketingStateIconText, enabled ? styles.marketingStateIconTextOn : styles.marketingStateIconTextOff]}>{enabled ? 'ON' : 'OFF'}</Text>
        </View>
        <View style={styles.marketingRowCopy}>
          <Text style={styles.marketingRowTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.marketingRowSub} numberOfLines={2}>{copy}</Text>
        </View>
        <View style={[styles.marketingStatusMini, enabled ? styles.marketingStatusMiniOn : styles.marketingStatusMiniOff]}>
          <Text style={[styles.marketingStatusMiniText, enabled ? styles.marketingStatusMiniTextOn : styles.marketingStatusMiniTextOff]}>{enabled ? 'ACTIVE' : 'OFF'}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onToggle} style={[styles.marketingToggleBtn, enabled ? styles.marketingToggleBtnOff : styles.marketingToggleBtnOn]} activeOpacity={0.86}>
        {!enabled && <View pointerEvents="none" style={styles.marketingToggleGlow} />}
        <Text style={[styles.marketingToggleText, enabled ? styles.marketingToggleTextOff : styles.marketingToggleTextOn]}>{enabled ? 'DISABLE' : 'ENABLE'}</Text>
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
  tabText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  tabsDots: { height: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 5 },
  tabsDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.24)' },
  tabsDotActive: { width: 14, backgroundColor: 'rgba(249,115,22,0.72)' },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 140 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 0, fontWeight: '600', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: '600', marginBottom: 8 },
  subtitle: { color: '#CBD5E1', fontSize: 16, lineHeight: 23, fontWeight: '400', marginBottom: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 24, fontWeight: '600', marginBottom: 4 },
  metricLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '600' },
  panelCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18, marginBottom: 16, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  formEyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 8 },
  panelTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '600', marginBottom: 8 },
  eventName: { color: colors.navy, fontSize: 22, fontWeight: '600', marginBottom: 6 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, fontWeight: '400', marginBottom: 14 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusPill: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statusPillCompact: { height: 24, paddingHorizontal: 9 },
  statusGreen: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.34)' },
  statusRed: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.28)' },
  statusOrange: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.34)' },
  statusGray: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  statusDark: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  statusText: { fontSize: 10, fontWeight: '600', letterSpacing: 0 },
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
  adminEditBackText: { color: '#FDBA74', fontSize: 13, fontWeight: '600' },
  adminEventTop: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  adminEventPosterWrap: { width: 76, height: 96, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  adminEventPoster: { width: '100%', height: '100%' },
  adminEventPosterFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  adminEventPosterText: { color: colors.orange, fontSize: 9, fontWeight: '600', letterSpacing: 0 },
  adminEventStatsTab: { position: 'absolute', right: 5, bottom: 5, width: 28, height: 28, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.34)', backgroundColor: 'rgba(249,115,22,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  adminEventMain: { flex: 1, minWidth: 0, paddingRight: 34 },
  adminEventEyebrow: { color: colors.orange, fontSize: 10, fontWeight: '600', letterSpacing: 0, marginBottom: 4 },
  adminEventTitle: { color: '#F8FAFC', fontSize: 17, lineHeight: 21, fontWeight: '600', marginBottom: 5 },
  adminEventMeta: { color: 'rgba(226,232,240,0.62)', fontSize: 12, lineHeight: 17, fontWeight: '400', marginBottom: 8 },
  adminEventBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  adminApprovalRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  adminApproveBtn: { flex: 1, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.14)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  adminApproveText: { color: '#34D399', fontSize: 11, fontWeight: '600' },
  adminRejectBtn: { width: 96, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,90,69,0.1)', borderWidth: 1, borderColor: 'rgba(255,90,69,0.4)', alignItems: 'center', justifyContent: 'center' },
  adminRejectText: { color: '#FCA5A5', fontSize: 11, fontWeight: '600' },
  adminEventActions: { flexDirection: 'row', gap: 7, marginTop: 10 },
  adminEventPrimaryAction: { flex: 1.12, borderRadius: 10 },
  adminEventPrimaryText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', letterSpacing: 0 },
  adminEventSecondaryAction: { flex: 1, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  adminEventSecondaryText: { color: '#F8FAFC', fontSize: 10, fontWeight: '600', letterSpacing: 0 },
  adminEventDangerAction: { flex: 0.72, borderColor: 'rgba(239,68,68,0.24)' },
  adminEventDangerText: { color: '#FCA5A5' },
  userCard: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, marginBottom: 10 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 },
  userInfo: { flex: 1, minWidth: 0, gap: 8 },
  userIdentity: { minWidth: 0 },
  userName: { color: '#F8FAFC', fontSize: 17, fontWeight: '600', marginBottom: 3 },
  userEmail: { color: 'rgba(226,232,240,0.58)', fontSize: 12, fontWeight: '400' },
  userBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  userAvatarBox: { width: 58, height: 58, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  userAvatarImage: { width: '100%', height: '100%' },
  userAvatarFallback: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.025)' },
  userAvatarHead: { width: 17, height: 17, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.72)', marginBottom: 5 },
  userAvatarBody: { width: 31, height: 15, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: 'rgba(226,232,240,0.58)' },
  userActionRow: { flexDirection: 'row', gap: 7 },
  userPrimaryAction: { flex: 1, borderRadius: 10 },
  userPrimaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0 },
  userSecondaryAction: { flex: 1, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  userSecondaryText: { color: '#F8FAFC', fontSize: 10, fontWeight: '600', letterSpacing: 0 },
  userDangerAction: { borderColor: 'rgba(239,68,68,0.24)' },
  userDangerText: { color: '#FCA5A5' },
  userCountCard: { minHeight: 78, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', backgroundColor: 'rgba(3,11,20,0.86)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 15, paddingVertical: 13, marginBottom: 10, shadowColor: '#ff6800', shadowOpacity: 0.13, shadowRadius: 18, shadowOffset: { width: 0, height: 9 } },
  userCountEyebrow: { color: colors.orange, fontSize: 18, fontWeight: '600', letterSpacing: 0, marginBottom: 4 },
  userCountCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 12, lineHeight: 16, fontWeight: '600' },
  userCountBadge: { minWidth: 82, height: 54, borderRadius: 16, backgroundColor: 'rgba(249,115,22,0.11)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  userCountValue: { color: '#F8FAFC', fontSize: 28, fontWeight: '600', letterSpacing: 0 },
  userSearchBox: { height: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, marginBottom: 10 },
  userSearchIcon: { color: colors.orange, fontSize: 27, fontWeight: '600', width: 27, textAlign: 'center' },
  userSearchInput: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '600', paddingVertical: 0 },
  userEmptyCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 14, marginBottom: 10, alignItems: 'center' },
  userEmptyText: { color: 'rgba(226,232,240,0.62)', fontSize: 13, fontWeight: '600' },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#F8FAFC', fontSize: 16, fontWeight: '600' },
  cardMain: { flex: 1 },
  cardTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  cardSub: { color: 'rgba(226,232,240,0.64)', fontSize: 14, fontWeight: '400' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  cardPrimaryAction: { flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  cardPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  cardSecondaryAction: { width: 104, height: 50, borderRadius: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  cardSecondaryText: { color: '#F8FAFC', fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  actionButton: { minHeight: 44, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, flexGrow: 1 },
  actionButtonMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  actionButtonTextMuted: { color: '#F8FAFC' },
  fieldLabel: { color: 'rgba(226,232,240,0.85)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 7 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 16, color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  createToggle: { alignSelf: 'flex-start', marginBottom: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.1)' },
  createToggleText: { color: '#F97316', fontSize: 13, fontWeight: '600' },
  twoColRow: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  bannerThumb: { width: '100%', height: 88, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 8, backgroundColor: '#030B14' },
  bannerThumbEmpty: { width: '100%', height: 88, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 8, backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  bannerThumbText: { color: 'rgba(226,232,240,0.4)', fontSize: 13, fontWeight: '600' },
  bannerPublishBadge: { alignSelf: 'flex-start', minHeight: 24, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, marginTop: -2, marginBottom: 8 },
  bannerPublishBadgeOn: { backgroundColor: 'rgba(34,197,94,0.11)', borderColor: 'rgba(34,197,94,0.34)' },
  bannerPublishBadgeOff: { backgroundColor: 'rgba(248,113,113,0.10)', borderColor: 'rgba(248,113,113,0.32)' },
  bannerPublishDot: { width: 6, height: 6, borderRadius: 999 },
  bannerPublishDotOn: { backgroundColor: '#4ADE80' },
  bannerPublishDotOff: { backgroundColor: '#FCA5A5' },
  bannerPublishText: { fontSize: 10, fontWeight: '600' },
  bannerPublishTextOn: { color: '#4ADE80' },
  bannerPublishTextOff: { color: '#FCA5A5' },
  bannerPickBtn: { height: 38, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  bannerPickText: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  bannerOptionBlock: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(3,11,20,0.56)', padding: 12, gap: 8 },
  bannerSegmentRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bannerSegmentBtn: { flex: 1, minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  bannerSegmentBtnActive: { borderColor: 'rgba(249,115,22,0.52)', backgroundColor: 'rgba(249,115,22,0.14)' },
  bannerSegmentText: { color: 'rgba(226,232,240,0.62)', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  bannerSegmentTextActive: { color: '#FDBA74' },
  bannerPickerScroll: { marginTop: 2 },
  bannerPickerContent: { gap: 10, paddingRight: 4 },
  bannerPickerCard: { width: 116, minHeight: 112, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.035)', padding: 9 },
  bannerPickerCardActive: { borderColor: 'rgba(249,115,22,0.58)', backgroundColor: 'rgba(249,115,22,0.12)' },
  bannerPickerImage: { width: '100%', height: 54, borderRadius: 10, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 8 },
  bannerPickerAdd: { width: '100%', height: 54, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  bannerPickerTitle: { color: '#F8FAFC', fontSize: 11, fontWeight: '600' },
  bannerPickerMeta: { color: 'rgba(226,232,240,0.52)', fontSize: 10, fontWeight: '600', marginTop: 3 },
  bannerDeleteRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  bannerToggleBtn: { flex: 1, minHeight: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  bannerToggleBtnOn: { borderColor: 'rgba(34,197,94,0.34)', backgroundColor: 'rgba(34,197,94,0.10)' },
  bannerToggleBtnOff: { borderColor: 'rgba(248,113,113,0.32)', backgroundColor: 'rgba(248,113,113,0.09)' },
  bannerToggleBtnDisabled: { opacity: 0.46 },
  bannerToggleText: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  bannerToggleTextOn: { color: '#4ADE80' },
  bannerToggleTextOff: { color: '#FCA5A5' },
  bannerDeleteBtn: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,90,69,0.3)', backgroundColor: 'rgba(255,90,69,0.08)', alignItems: 'center', justifyContent: 'center' },
  bannerDeleteText: { color: '#ff5a45', fontSize: 12, fontWeight: '600' },
  bannerList: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.025)', padding: 10, gap: 8 },
  bannerListTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '600', marginBottom: 2 },
  bannerListEmpty: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '600', lineHeight: 16, paddingVertical: 8 },
  bannerListItem: { minHeight: 52, borderRadius: 12, backgroundColor: 'rgba(3,11,20,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  bannerListThumb: { width: 58, height: 34, borderRadius: 8, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  bannerListName: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  bannerListMeta: { color: 'rgba(226,232,240,0.54)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.055)', borderColor: 'rgba(255,255,255,0.24)' },
  segmentActiveOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  segmentDanger: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.34)' },
  segmentText: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#FFFFFF' },
  formActions: { marginTop: 4, gap: 10 },
  primaryButton: { height: 56, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  secondaryButton: { height: 54, borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#F8FAFC', fontSize: 13, letterSpacing: 0, fontWeight: '600' },
  createRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  createInput: { flex: 1, height: 56, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 16, color: colors.navy, fontSize: 15, fontWeight: '600' },
  createButton: { width: 78, height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', letterSpacing: 0 },
  codeCreateCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 13, marginBottom: 12, shadowColor: '#000000', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  codePanelTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '600', marginBottom: 5 },
  codePanelCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 17, fontWeight: '500', marginBottom: 10 },
  codeInput: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  codeAddButton: { width: 82, borderRadius: 10 },
  codeAddButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', letterSpacing: 0 },
  codeCard: { backgroundColor: '#030B14', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 11, marginBottom: 8 },
  codeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  codeCardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  codeCardSub: { color: 'rgba(226,232,240,0.62)', fontSize: 11, fontWeight: '500' },
  codeActionRow: { flexDirection: 'row', gap: 7 },
  codePrimaryAction: { flex: 1, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  codePrimaryText: { color: '#F8FAFC', fontSize: 10, fontWeight: '600', letterSpacing: 0 },
  codeDeleteAction: { width: 62, height: 34, borderRadius: 10, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(239,68,68,0.24)', alignItems: 'center', justifyContent: 'center' },
  codeDeleteText: { color: '#FCA5A5', fontSize: 10, fontWeight: '600', letterSpacing: 0 },
  activity: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', marginTop: 10 },
  activityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, marginTop: 5 },
  activityCopy: { flex: 1 },
  activityTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14, marginTop: 10 },
  dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: colors.orange },
  listText: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', flex: 1 },
  avatarOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  avatarMuted: { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.14)' },
  marketingCard: { backgroundColor: 'rgba(3,11,20,0.88)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, marginBottom: 10 },
  marketingCardActive: { borderColor: 'rgba(249,115,22,0.18)' },
  marketingRowTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  marketingStateIcon: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  marketingStateIconOn: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.42)' },
  marketingStateIconOff: { backgroundColor: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.14)' },
  marketingStateIconText: { fontSize: 11, fontWeight: '600' },
  marketingStateIconTextOn: { color: colors.orange },
  marketingStateIconTextOff: { color: 'rgba(226,232,240,0.72)' },
  marketingRowCopy: { flex: 1, minWidth: 0 },
  marketingRowTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  marketingRowSub: { color: 'rgba(226,232,240,0.56)', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  marketingStatusMini: { minWidth: 52, height: 26, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  marketingStatusMiniOn: { backgroundColor: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.30)' },
  marketingStatusMiniOff: { backgroundColor: 'rgba(255,255,255,0.035)', borderColor: 'rgba(255,255,255,0.12)' },
  marketingStatusMiniText: { fontSize: 9, fontWeight: '600' },
  marketingStatusMiniTextOn: { color: '#4ADE80' },
  marketingStatusMiniTextOff: { color: 'rgba(226,232,240,0.56)' },
  marketingToggleBtn: { height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  marketingToggleBtnOn: { backgroundColor: colors.orange, borderColor: 'rgba(255,255,255,0.16)' },
  marketingToggleBtnOff: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  marketingToggleGlow: { position: 'absolute', top: 4, left: 18, right: 18, height: 1.5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.28)' },
  marketingToggleText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  marketingToggleTextOn: { color: '#FFFFFF' },
  marketingToggleTextOff: { color: 'rgba(248,250,252,0.84)' },
  orderPremiumItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14, marginTop: 10 },
  orderPremiumIndex: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center' },
  orderPremiumIndexText: { color: colors.orange, fontSize: 13, fontWeight: '600' },
  orderPremiumCopy: { flex: 1 },
  orderPremiumTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  orderPremiumSub: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '600' },
  analyticsRow: { marginTop: 12, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  analyticsTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  analyticsLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  analyticsValue: { color: colors.orange, fontSize: 15, fontWeight: '600' },
  analyticsTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  analyticsFill: { height: '100%', borderRadius: 999, backgroundColor: colors.orange },
  rankItem: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14, marginTop: 10 },
  rankImageWrap: { width: 48, height: 48, borderRadius: 15, overflow: 'hidden', backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.30)' },
  rankImage: { width: '100%', height: '100%' },
  rankImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  rankCopy: { flex: 1 },
  rankTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  rankValue: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '600' },
  paymentMixRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14, marginTop: 10 },
  paymentMixLabel: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  paymentMixValue: { color: colors.orange, fontSize: 15, fontWeight: '600' },
  cardSecondaryActionWide: { height: 50, borderRadius: 15, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },

  // Fees / prices inline panel
  adminEventSecondaryActionActive: { backgroundColor: 'rgba(249,115,22,0.18)', borderColor: 'rgba(249,115,22,0.55)' },
  adminEventSecondaryTextActive: { color: '#F97316' },
  inlinePanel: { marginTop: 12, backgroundColor: 'rgba(3,11,20,0.88)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', padding: 14 },
  inlinePanelLoading: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  inlinePanelLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '600', letterSpacing: 0, marginTop: 8, marginBottom: 4 },
  inlinePanelInput: { height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', color: '#FFFFFF', fontSize: 13, fontWeight: '600', paddingHorizontal: 12, outlineStyle: 'none' as any },
  inlinePanelSave: { marginTop: 10, height: 40, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  inlinePanelSaveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  feeTabs: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  feeTab: { flex: 1, height: 34, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  feeTabActive: { backgroundColor: 'rgba(249,115,22,0.18)', borderColor: 'rgba(249,115,22,0.55)' },
  feeTabText: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '600' },
  feeTabTextActive: { color: '#F97316' },
  inlineSectionFee: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 10 },
  inlineSectionFeeTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  inlineFeeRow: { flexDirection: 'row', gap: 8 },
  inlineFeeField: { flex: 1 },

  // Commission / payout
  commissionCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 16, marginBottom: 12 },
  commissionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  commissionOwner: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  commissionEvent: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '400', marginTop: 2 },
  commissionBadge: { alignItems: 'flex-end' },
  commissionBalance: { color: '#F97316', fontSize: 20, fontWeight: '600' },
  commissionBalanceLabel: { color: 'rgba(226,232,240,0.48)', fontSize: 9, fontWeight: '400' },
  commissionStats: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  commissionStat: { flex: 1, backgroundColor: '#030B14', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 10 },
  commissionStatLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '600' },
  commissionStatValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginTop: 4 },
  payoutHistory: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 8, marginTop: 4, gap: 4 },
  payoutHistoryItem: { color: 'rgba(226,232,240,0.52)', fontSize: 11, fontWeight: '400' },

  // Dashboard financial breakdown
  dashRowTwo: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  dashHalfCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  dashCardEyebrow: { color: colors.orange, fontSize: 11, fontWeight: '600', marginBottom: 10 },
  dashMiniGrid: { flexDirection: 'row', gap: 8 },
  dashMiniStat: { flex: 1, backgroundColor: '#030B14', borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center' },
  dashMiniValue: { fontSize: 22, fontWeight: '600', marginBottom: 2 },
  dashMiniLabel: { color: 'rgba(226,232,240,0.58)', fontSize: 7, fontWeight: '600' },
  finGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  finCard: { width: '48%', backgroundColor: '#030B14', borderRadius: 14, borderWidth: 1, padding: 12 },
  finCardGreen: { borderColor: 'rgba(34,197,94,0.28)' },
  finCardLabel: { color: 'rgba(226,232,240,0.52)', fontSize: 9, fontWeight: '600', marginBottom: 6 },
  finCardValue: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  finCardNote: { color: 'rgba(226,232,240,0.44)', fontSize: 10, fontWeight: '500' },
  finTabsRow: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  finArrowBtn: { width: 24, height: 40, alignItems: 'center', justifyContent: 'center' },
  finArrowBtnDisabled: { opacity: 0.55 },
  finTabsShell: { flex: 1, height: 40, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(3,11,20,0.86)', overflow: 'hidden' },
  finTabsScroller: { flex: 1 },
  finTabsContent: { minHeight: 40, alignItems: 'center', paddingHorizontal: 4, gap: 4 },
  finTabsFade: { position: 'absolute', top: 1, bottom: 1, width: 34, zIndex: 3 },
  finTabsFadeLeft: { left: 1 },
  finTabsFadeRight: { right: 1 },
  finSlidingPill: { position: 'absolute', top: 4, height: 32, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.16)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.55)', overflow: 'hidden' },
  finSlidingShine: { position: 'absolute', top: 2, left: 10, right: 10, height: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.32)' },
  finTabsDots: { height: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: -9, marginBottom: 12 },
  finTabsDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.24)' },
  finTabsDotActive: { width: 14, backgroundColor: 'rgba(249,115,22,0.72)' },
  finEventPill: { height: 32, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  finEventPillActive: { backgroundColor: 'rgba(249,115,22,0.14)', borderColor: 'rgba(249,115,22,0.5)' },
  finEventPillText: { color: 'rgba(226,232,240,0.62)', fontSize: 12, fontWeight: '600', maxWidth: 142 },
  finEventPillTextActive: { color: '#FFFFFF' },

  // Analytics day selector
  analyticsDayRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  analyticsDayPill: { height: 36, borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  analyticsDayPillActive: { backgroundColor: 'rgba(249,115,22,0.14)', borderColor: 'rgba(249,115,22,0.5)' },
  analyticsDayText: { color: 'rgba(226,232,240,0.62)', fontSize: 13, fontWeight: '600' },
  analyticsDayTextActive: { color: colors.orange },

  // Recent activity (analytics)
  recentToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentViewRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 10 },
  recentViewPath: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', marginBottom: 5 },
  recentViewMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recentViewTag: { backgroundColor: '#030B14', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, color: 'rgba(226,232,240,0.62)', fontSize: 11, fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  recentViewTime: { color: 'rgba(226,232,240,0.44)', fontSize: 11, fontWeight: '400' },

  // User v2 cards
  userRoleFilterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  userFilterCard: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 8, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 9, overflow: 'hidden' },
  userCountCompact: { width: 74, height: 42, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.30)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  userCountCompactValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '600', lineHeight: 20 },
  userCountCompactLabel: { color: 'rgba(226,232,240,0.62)', fontSize: 9.5, fontWeight: '600', lineHeight: 12 },
  userRoleFilterShell: { flex: 1, height: 42, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', padding: 4, flexDirection: 'row', position: 'relative', overflow: 'hidden' },
  userRoleSlidingPill: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,151,45,0.62)', shadowColor: '#ff6800', shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  userRoleSlidingShine: { position: 'absolute', left: 12, right: 12, top: 5, height: 1 },
  userRoleSegment: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  userRoleSegmentText: { color: 'rgba(203,213,225,0.72)', fontSize: 12, fontWeight: '600' },
  userRoleSegmentTextActive: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.24)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  createUserBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 16, alignSelf: 'flex-start', marginBottom: 12 },
  createUserBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  userCard2: { backgroundColor: '#030B14', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 14, marginBottom: 10 },
  userCard2Top: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  userInitialsAvatar: { width: 42, height: 42, borderRadius: 999, backgroundColor: 'rgba(248,250,252,0.055)', borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.36)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  userInitialsText: { color: colors.orange, fontSize: 14, fontWeight: '600' },
  userInitialsAvatarLg: { width: 52, height: 52, borderRadius: 999, backgroundColor: 'rgba(248,250,252,0.055)', borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.36)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  userInitialsTextLg: { color: colors.orange, fontSize: 18, fontWeight: '600' },
  userCard2Name: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  userCard2Username: { color: 'rgba(226,232,240,0.48)', fontSize: 11, fontWeight: '600' },
  userCard2EmailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  userCard2Email: { color: 'rgba(226,232,240,0.55)', fontSize: 12, fontWeight: '400', flex: 1 },
  userCard2StatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  userCard2Date: { color: 'rgba(226,232,240,0.4)', fontSize: 11, fontWeight: '500', fontStyle: 'italic' },
  userCard2Actions: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10 },
  userRoleDropdown: { flex: 1, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  userRoleDropdownText: { color: '#CBD5E1', fontSize: 12, fontWeight: '600' },
  userActionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  // User detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3,11,20,0.62)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  userModal: { width: '100%', maxHeight: '88%', backgroundColor: 'rgba(3,11,20,0.92)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  userEditModal: { height: '85%' },
  userCreateModal: { height: '92%' },
  userModalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.018)' },
  userModalName: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  userModalSub: { color: 'rgba(226,232,240,0.52)', fontSize: 11, fontWeight: '600' },
  userModalClose: { width: 34, height: 34, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  userModalSectionLabel: { color: 'rgba(226,232,240,0.44)', fontSize: 10, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
  userModalInfoCard: { backgroundColor: 'rgba(255,255,255,0.026)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', padding: 14, gap: 12 },
  userModalInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  userModalInfoText: { color: '#CBD5E1', fontSize: 13, fontWeight: '500', flex: 1 },
  userModalEmptyText: { color: 'rgba(226,232,240,0.44)', fontSize: 13, fontWeight: '400', textAlign: 'center', paddingVertical: 8 },
  userModalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.014)' },
  userModalEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userModalEditBtnText: { color: colors.orange, fontSize: 14, fontWeight: '600' },
  userModalCloseBtn: { height: 40, paddingHorizontal: 20, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  userModalSecondaryBtn: { flex: 0.82, height: 44, borderRadius: 10, backgroundColor: 'rgba(3,11,20,0.88)', borderColor: 'rgba(255,255,255,0.14)' },
  userModalPrimaryBtn: { flex: 1.18, borderRadius: 10 },
  userModalPrimaryContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  userModalPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: 0, textShadowColor: 'rgba(0,0,0,0.24)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  userModalCloseBtnText: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },

  // Event filter tabs
  eventFilterWrap: { marginBottom: 12 },
  eventFilterRow: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventFilterArrowBtn: { width: 24, height: 40, alignItems: 'center', justifyContent: 'center' },
  eventFilterArrowBtnDisabled: { opacity: 0.55 },
  eventFilterShell: { flex: 1, height: 42, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(3,11,20,0.86)', overflow: 'hidden' },
  eventFilterScroller: { flex: 1 },
  eventFilterContent: { minHeight: 40, paddingHorizontal: 4, gap: 4, flexDirection: 'row', alignItems: 'center' },
  eventFilterFade: { position: 'absolute', top: 1, bottom: 1, width: 34, zIndex: 3 },
  eventFilterFadeLeft: { left: 1 },
  eventFilterFadeRight: { right: 1 },
  eventFilterSlidingPill: { position: 'absolute', top: 4, height: 32, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.16)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.55)', overflow: 'hidden' },
  eventFilterSlidingShine: { position: 'absolute', top: 2, left: 10, right: 10, height: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.32)' },
  eventFilterDots: { height: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2, marginBottom: 8 },
  eventFilterDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.24)' },
  eventFilterDotActive: { width: 14, backgroundColor: 'rgba(249,115,22,0.72)' },
  eventFilterPill: { height: 32, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  eventFilterPillActive: { borderColor: 'rgba(255,151,45,0.62)', shadowColor: '#ff6800', shadowOpacity: 0.24, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  eventFilterShine: { position: 'absolute', left: 10, right: 10, top: 5, height: 1 },
  eventFilterText: { color: 'rgba(226,232,240,0.62)', fontSize: 13, fontWeight: '600', zIndex: 1, maxWidth: 142 },
  eventFilterTextActive: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.24)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },

  // Owner user search (special codes)
  ownerSearchBox: { position: 'relative', marginBottom: 6 },
  ownerSearchingText: { color: colors.orange, fontSize: 11, fontWeight: '600', marginTop: 4 },
  ownerResultsList: { backgroundColor: '#030B14', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 8, overflow: 'hidden' },
  ownerResultRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  ownerResultName: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  ownerResultEmail: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '400' },
  ownerSelectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,197,94,0.24)', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  ownerSelectedText: { flex: 1, color: '#4ADE80', fontSize: 12, fontWeight: '600' },

  // Categories redesign
  catHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  catCount: { flex: 1, color: '#CBD5E1', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  catNewBtn: { borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', minWidth: 100 },
  catNewBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center', lineHeight: 15 },
  catCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 12, marginBottom: 10, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  catCardAccent: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 999, opacity: 0.88 },
  catCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  catIconBox: { width: 48, height: 48, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#ff6800', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  catCardImage: { width: '100%', height: '100%', borderRadius: 12 },
  catIconText: { fontSize: 24, lineHeight: 28 },
  catCardName: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  catCardSlug: { color: 'rgba(226,232,240,0.44)', fontSize: 11, fontWeight: '500', marginBottom: 5 },
  catStatusBadge: { alignSelf: 'flex-start', height: 22, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  catStatusBadgeActive: { backgroundColor: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.36)' },
  catStatusBadgeInactive: { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.34)' },
  catStatusDot: { width: 5, height: 5, borderRadius: 999 },
  catStatusDotActive: { backgroundColor: '#4ADE80' },
  catStatusDotInactive: { backgroundColor: '#FCA5A5' },
  catStatusText: { fontSize: 10, fontWeight: '600', letterSpacing: 0 },
  catStatusTextActive: { color: '#4ADE80' },
  catStatusTextInactive: { color: '#FCA5A5' },
  catCardActions: { flexDirection: 'row', gap: 8 },
  catActionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },

  // Category form (create/edit modals)
  catFormModal: { width: '100%', height: '92%', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(125,180,255,0.18)', overflow: 'hidden', backgroundColor: 'rgba(6,18,32,0.92)' },
  catFormContent: { padding: 20, gap: 10 },
  catFormInput: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(125,180,255,0.16)', backgroundColor: 'rgba(3,11,20,0.72)', paddingHorizontal: 14, color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  catPhotoPicker: { height: 132, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(125,180,255,0.18)', backgroundColor: 'rgba(255,255,255,0.035)', overflow: 'hidden', marginBottom: 8 },
  catPhotoPreview: { width: '100%', height: '100%' },
  catPhotoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)', borderRadius: 18 },
  catPhotoEmptyText: { color: 'rgba(226,232,240,0.68)', fontSize: 13, fontWeight: '600' },
  catFormPreviewCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(3,11,20,0.82)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, overflow: 'hidden', marginBottom: 2 },
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
  catImagePickText: { color: colors.orange, fontSize: 13, fontWeight: '600' },
  catPreviewPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  catPreviewPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

  // Special codes redesign
  codeStatRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  codeStatCard: { flex: 1, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  codeStatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  codeStatLabel: { color: 'rgba(226,232,240,0.52)', fontSize: 9, fontWeight: '600', letterSpacing: 1 },
  codeStatValue: { color: '#F8FAFC', fontSize: 28, fontWeight: '600' },
  codeCreateHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  codeCreateIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center' },
  codeCreateTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  codeCreateSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  codeEventPicker: { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 6 },
  codeEventPickerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  codeEventPickerText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', flex: 1 },
  codeEventPill: { height: 32, borderRadius: 99, paddingHorizontal: 12, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  codeEventPillActive: { backgroundColor: 'rgba(249,115,22,0.14)', borderColor: 'rgba(249,115,22,0.5)' },
  codeEventPillText: { color: 'rgba(226,232,240,0.62)', fontSize: 12, fontWeight: '600', maxWidth: 120 },
  codeEventPillTextActive: { color: colors.orange },
  codeActiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  codeActiveCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  codeActiveCheckOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  codeActiveLabel: { color: '#CBD5E1', fontSize: 14, fontWeight: '600' },
  createdCodesHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  createdCodesTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  createdCodesSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  codeCard2: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 14, marginBottom: 10 },
  codeCard2Label: { color: 'rgba(226,232,240,0.6)', fontSize: 9, fontWeight: '600', letterSpacing: 1.5, marginBottom: 3 },
  codeCard2Code: { color: '#F8FAFC', fontSize: 22, fontWeight: '600', marginBottom: 10 },
  codeCard2OwnerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  codeCard2OwnerName: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  codeCard2OwnerEmail: { color: 'rgba(226,232,240,0.48)', fontSize: 11, fontWeight: '400', marginBottom: 10 },
  codeCard2Event: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  codeCard2Actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  codeEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.08)' },
  codeEditBtnText: { color: colors.orange, fontSize: 12, fontWeight: '600' },
  codeDeleteBtn: { height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.06)', alignItems: 'center', justifyContent: 'center' },
  codeDeleteBtnText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },
  codeStatusBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  codeStatusBtnActive: { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' },
  codeStatusBtnInactive: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' },
  codeStatusBtnText: { fontSize: 12, fontWeight: '600' },

  // Event rewards
  eventRewardsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, marginBottom: 12 },
  eventRewardsIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center' },
  eventRewardsTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  eventRewardsSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400', flex: 1 },
  eventRewardCard: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 14, marginBottom: 10 },
  eventRewardFieldLabel: { color: 'rgba(226,232,240,0.6)', fontSize: 9, fontWeight: '600', letterSpacing: 1.5, marginBottom: 3 },
  eventRewardEventTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 8 },
  eventRewardOrgName: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  eventRewardCurrent: { color: '#4ADE80', fontSize: 16, fontWeight: '600', marginBottom: 10 },

  // ── Marketing ─────────────────────────────────────────────────────────────
  mktHero: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', marginBottom: 16 },
  mktHeroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  mktHeroEyebrowText: { color: '#F97316', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  mktHeroTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '600', marginBottom: 8 },
  mktHeroCopy: { color: 'rgba(226,232,240,0.65)', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  mktStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  mktStatCard: { flex: 1, minWidth: '45%', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14' },
  mktStatCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  mktStatLabel: { color: 'rgba(226,232,240,0.55)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  mktStatIcon: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' },
  mktStatValue: { color: '#F8FAFC', fontSize: 26, fontWeight: '600' },
  mktCard: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', marginBottom: 16 },
  mktCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  mktCardIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  mktCardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  mktCardSub: { color: 'rgba(226,232,240,0.55)', fontSize: 12, lineHeight: 18 },
  mktStepsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  mktStep: { flex: 1, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center' },
  mktStepNum: { color: '#F97316', fontSize: 10, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  mktStepName: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  mktInput: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, color: '#F8FAFC', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  mktSelect: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 10, justifyContent: 'center' },
  mktSelectInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, justifyContent: 'space-between' },
  mktSelectText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  mktEmailRecipientPanel: { marginTop: -2, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.18)', backgroundColor: 'rgba(3,11,20,0.76)', overflow: 'hidden' },
  mktEmailRecipientHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  mktEmailRecipientTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  mktEmailRecipientSub: { color: 'rgba(226,232,240,0.48)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  mktEmailRecipientClear: { minHeight: 30, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.10)', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  mktEmailRecipientClearText: { color: colors.orange, fontSize: 10, fontWeight: '600' },
  mktEmailRecipientList: { maxHeight: 286, padding: 8 },
  mktEmailCheck: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(226,232,240,0.24)', backgroundColor: 'rgba(255,255,255,0.035)', alignItems: 'center', justifyContent: 'center' },
  mktEmailCheckActive: { borderColor: 'rgba(249,115,22,0.68)', backgroundColor: '#F97316' },
  mktTextArea: { minHeight: 100, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingTop: 14, color: '#F8FAFC', fontSize: 14, fontWeight: '600', textAlignVertical: 'top' },
  mktCharCount: { color: 'rgba(226,232,240,0.4)', fontSize: 11, textAlign: 'right', marginTop: 4, marginBottom: 6 },
  mktUploadArt: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(249,115,22,0.4)', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.04)', marginBottom: 10 },
  mktUploadTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  mktUploadSub: { color: 'rgba(226,232,240,0.45)', fontSize: 11, textAlign: 'center' },
  mktArtFile: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 8, gap: 10 },
  mktArtFileName: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  mktArtFileSub: { color: 'rgba(226,232,240,0.45)', fontSize: 11, marginTop: 2 },
  mktArtRemove: { width: 28, height: 28, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(252,165,165,0.3)', backgroundColor: 'rgba(252,165,165,0.08)', alignItems: 'center', justifyContent: 'center' },
  mktArtPreview: { width: '100%', height: 160, borderRadius: 14, marginBottom: 10 },
  mktFootNote: { color: 'rgba(226,232,240,0.4)', fontSize: 11, textAlign: 'center', marginTop: 8 },
  mktPreviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  mktPreviewMailBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.06)' },
  mktPreviewMailText: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  mktEmailShell: { borderRadius: 24, backgroundColor: 'rgba(3,11,20,0.36)', padding: 12, marginTop: 12, borderWidth: 1, borderColor: 'rgba(125,180,255,0.10)' },
  mktEmailPreview: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(125,180,255,0.14)', backgroundColor: 'rgba(3,11,20,0.48)', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  mktPreviewLogoRow: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.018)' },
  mktPreviewLogoImg: { height: 36, width: 140 },
  mktPreviewArt: { width: '100%', height: 180 },
  mktPreviewArtEmpty: { height: 200, marginHorizontal: 16, marginBottom: 8, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(125,180,255,0.16)', borderStyle: 'dashed', backgroundColor: 'rgba(3,11,20,0.30)', alignItems: 'center', justifyContent: 'center', gap: 10 },
  mktPreviewArtText: { color: 'rgba(248,250,252,0.78)', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  mktPreviewBody: { padding: 20, gap: 10, alignItems: 'center', backgroundColor: 'rgba(3,11,20,0.34)' },
  mktPreviewBodyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  mktPreviewBodyCopy: { color: 'rgba(248,250,252,0.78)', fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 280 },
  mktPreviewBtn: { marginTop: 8, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center' },
  mktPreviewBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: 0.8 },
  mktWaLangRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  mktWaLangLabel: { color: 'rgba(226,232,240,0.65)', fontSize: 12, fontWeight: '600' },
  mktWaLangBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14' },
  mktWaLangBtnActive: { borderColor: 'rgba(37,211,102,0.5)', backgroundColor: 'rgba(37,211,102,0.1)' },
  mktWaLangBtnText: { color: 'rgba(226,232,240,0.6)', fontSize: 12, fontWeight: '600' },
  mktWaLangBtnTextActive: { color: '#25D366' },
  mktWaHint: { color: 'rgba(226,232,240,0.5)', fontSize: 11, lineHeight: 17, marginBottom: 10 },
  mktPushCard: { padding: 20, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(249,115,22,0.22)', backgroundColor: 'rgba(249,115,22,0.035)', marginBottom: 16 },
  mktPushIcon: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.36)', backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' },
  mktPushModeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  mktPushModeBtn: { flex: 1, minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.72)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  mktPushModeBtnActive: { borderColor: 'rgba(249,115,22,0.55)', backgroundColor: 'rgba(249,115,22,0.12)' },
  mktPushModeText: { color: 'rgba(226,232,240,0.62)', fontSize: 12, fontWeight: '600' },
  mktPushModeTextActive: { color: colors.orange },
  mktPushPickerWrap: { marginBottom: 10 },
  mktPushUserSelect: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.76)', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingVertical: 6 },
  mktPushUserSelectIcon: { width: 26, height: 26, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  mktPushUserSelectTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  mktPushUserSelectSub: { color: 'rgba(226,232,240,0.5)', fontSize: 9, fontWeight: '600', marginTop: 1 },
  mktPushRecipientPanel: { marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(3,11,20,0.78)', overflow: 'hidden' },
  mktPushSearchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.035)' },
  mktPushSearchInput: { flex: 1, color: '#F8FAFC', fontSize: 13, fontWeight: '600', paddingVertical: 8 },
  mktPushRecipientList: { maxHeight: 318, padding: 8 },
  mktPushRecipientRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', marginBottom: 4 },
  mktPushRecipientRowActive: { borderColor: 'rgba(249,115,22,0.36)', backgroundColor: 'rgba(249,115,22,0.08)' },
  mktPushRecipientEmpty: { minHeight: 49, alignItems: 'center', justifyContent: 'center' },
  mktPushRecipientAvatar: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  mktPushRecipientAvatarText: { color: colors.orange, fontSize: 12, fontWeight: '600' },
  mktPushRecipientName: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  mktPushRecipientEmail: { color: 'rgba(226,232,240,0.42)', fontSize: 10, fontWeight: '600', marginTop: 2 },
  mktPushAudienceInfo: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.72)', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginBottom: 10 },
  mktPushAudienceInfoText: { color: 'rgba(226,232,240,0.72)', fontSize: 12, fontWeight: '600' },
  mktPushDestinationRow: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  mktPushDestinationBtn: { flex: 1, minHeight: 38, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.72)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 7 },
  mktPushDestinationBtnActive: { borderColor: 'rgba(249,115,22,0.5)', backgroundColor: 'rgba(249,115,22,0.1)' },
  mktPushDestinationText: { color: 'rgba(226,232,240,0.56)', fontSize: 10, fontWeight: '600' },
  mktPushDestinationTextActive: { color: colors.orange },
  mktPushLinkWrap: { marginBottom: 8 },
  mktPushEventList: { maxHeight: 270, marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(3,11,20,0.78)', padding: 8 },
  mktPushLinkBox: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.04)', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginBottom: 5 },
  mktPushLinkInput: { flex: 1, color: '#F8FAFC', fontSize: 12, fontWeight: '600', paddingVertical: 9 },
  mktPushPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.76)', marginTop: 8 },
  mktPushPreviewIcon: { width: 32, height: 32, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(249,115,22,0.32)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  mktPushPreviewTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  mktPushPreviewBody: { color: 'rgba(226,232,240,0.58)', fontSize: 11, lineHeight: 16, marginTop: 2 },
  mktWaPreview: { marginTop: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(37,211,102,0.2)', backgroundColor: 'rgba(37,211,102,0.04)' },
  mktWaPreviewLabel: { color: '#25D366', fontSize: 10, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  mktWaBubble: { alignSelf: 'flex-start', maxWidth: '85%', padding: 12, borderRadius: 14, borderTopLeftRadius: 4, backgroundColor: '#075e54', marginBottom: 8 },
  mktWaBubbleText: { color: '#FFFFFF', fontSize: 13, lineHeight: 19 },
  mktWaPreviewSub: { color: 'rgba(226,232,240,0.35)', fontSize: 10, fontStyle: 'italic' },
  mktBannerPreviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  mktBannerPreviewEyebrow: { color: '#F97316', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  mktStatusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  mktStatusActive: { borderColor: 'rgba(74,222,128,0.35)', backgroundColor: 'rgba(74,222,128,0.1)' },
  mktStatusDraft: { borderColor: 'rgba(249,115,22,0.35)', backgroundColor: 'rgba(249,115,22,0.08)' },
  mktStatusText: { fontSize: 12, fontWeight: '600' },
  mktBannerImg: { width: '100%', height: 130, borderRadius: 14, marginBottom: 10 },
  mktBannerMobileImg: { width: 120, height: 160, borderRadius: 14, alignSelf: 'center', marginBottom: 10 },
  mktBannerEmpty: { width: '100%', aspectRatio: 2.5, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.02)' },
  mktBannerEmptyText: { color: 'rgba(226,232,240,0.35)', fontSize: 12 },
  mktUploadBox: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 10 },
  mktUploadBoxTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  mktUploadBoxSub: { color: 'rgba(226,232,240,0.4)', fontSize: 11, textAlign: 'center' },
  mktFileRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', gap: 10 },
  mktFileName: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  mktFileSub: { color: 'rgba(226,232,240,0.45)', fontSize: 11, marginTop: 2 },
  mktFileRemove: { width: 28, height: 28, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  mktRotationCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', backgroundColor: 'rgba(16,185,129,0.05)', marginBottom: 14 },
  mktRotationTitle: { color: '#34D399', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  mktRotationCopy: { color: 'rgba(226,232,240,0.6)', fontSize: 12, lineHeight: 18 },
  mktPublishBtn: { height: 50, borderRadius: 16, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  mktPublishBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.5 },
  mktChangeImgBtn: { height: 44, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  mktChangeImgBtnText: { color: 'rgba(226,232,240,0.8)', fontSize: 14, fontWeight: '600' },

  // ── Analytics redesign ────────────────────────────────────────────────────
  anHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  anBackBtn: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.10)', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  anTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '600', marginBottom: 4 },
  anSubtitle: { color: 'rgba(226,232,240,0.55)', fontSize: 13, fontWeight: '500' },
  anDayBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 4 },
  anDayBtnText: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  anSelectedEventCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(249,115,22,0.24)', backgroundColor: 'rgba(249,115,22,0.075)', marginBottom: 12 },
  anSelectedImageWrap: { width: 58, height: 72, borderRadius: 13, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.75)' },
  anSelectedImage: { width: '100%', height: '100%' },
  anSelectedImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  anSelectedCopy: { flex: 1, minWidth: 0 },
  anSelectedEyebrow: { color: colors.orange, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 3 },
  anSelectedTitle: { color: '#F8FAFC', fontSize: 15, lineHeight: 19, fontWeight: '600' },
  anSelectedMeta: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '600', marginTop: 4 },
  anSelectedClear: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.045)', alignItems: 'center', justifyContent: 'center' },
  anStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  anStatCard: { flex: 1, minWidth: '47%', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)' },
  anStatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  anStatLabel: { color: 'rgba(226,232,240,0.6)', fontSize: 12, fontWeight: '600', flex: 1 },
  anStatIconBox: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.35)', backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' },
  anStatValue: { color: '#F8FAFC', fontSize: 30, fontWeight: '600', letterSpacing: -1 },
  anSection: { padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', marginBottom: 12 },
  anSectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '600', marginBottom: 14 },
  anRankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  anRankNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  anRankNumText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  anRankTitle: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  anRankMeta: { color: 'rgba(226,232,240,0.5)', fontSize: 12, fontWeight: '500', flexShrink: 0 },
  anRecentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  anRecentCount: { color: 'rgba(226,232,240,0.5)', fontSize: 13, fontWeight: '500' },
  anRecentToggle: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  anTableScroll: { maxHeight: 280 },
  anTableInner: { minWidth: 520 },
  anTableHeader: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', marginBottom: 4 },
  anTableCol: { color: 'rgba(226,232,240,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  anTableColPath: { color: 'rgba(226,232,240,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', width: 300, paddingRight: 12 },
  anTableColEvent: { color: 'rgba(226,232,240,0.4)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', width: 180 },
  anTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  anTablePath: { color: '#F8FAFC', fontSize: 13, fontWeight: '500', width: 300, paddingRight: 12 },
  anTableEvent: { color: 'rgba(226,232,240,0.5)', fontSize: 12, fontWeight: '500', width: 180 },
});
