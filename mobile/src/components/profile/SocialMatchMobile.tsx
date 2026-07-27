import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { apiDelete, apiGet, apiPost, apiPut } from '../../services/api';
import { GradientButton } from '../GradientButton';

type EligibleEvent = {
  id: string;
  title: string;
  eventDate: string;
  venueName?: string;
};

type Preference = {
  eventId: string;
  isActive: boolean;
  interests: string[];
  industry: string | null;
  instagram: string | null;
  privateMode: boolean;
  invisibleMode: boolean;
  shareInstagram: boolean;
  shareLocation: boolean;
  photos?: string[] | null;
};

type Suggestion = {
  userId: string;
  displayName: string;
  score: number;
  interests: string[];
  sharedInterests: string[];
  canShareLocationLater: boolean;
};

type Connection = {
  id: string;
  eventId: string;
  eventTitle: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  direction: 'incoming' | 'outgoing';
  otherUserName: string;
  profile: { fullName: string; industry: string | null; interests: string[]; instagram: string | null; photos: string[] } | null;
};

type Message = {
  id: string;
  message: string;
  senderId: string;
  senderName: string;
  isMine: boolean;
  createdAt: string;
};

const DEFAULT_PREF: Preference = {
  eventId: '',
  isActive: false,
  interests: [],
  industry: null,
  instagram: null,
  privateMode: true,
  invisibleMode: false,
  shareInstagram: false,
  shareLocation: false,
  photos: [],
};
const PREVIEW_EVENT_ID = '__social_match_preview__';
const PREVIEW_PREF_KEY = 'lp_social_match_preview_pref';
const USER_KEY = 'lp_auth_user';
const SOCIAL_MATCH_CACHE_PREFIX = 'lp_mobile_social_match_cache';

async function getUserCacheKey(prefix: string) {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    const user = raw ? JSON.parse(raw) : null;
    const id = user?.id || user?.email || 'anonymous';
    return `${prefix}:${id}`;
  } catch {
    return `${prefix}:anonymous`;
  }
}

export function SocialMatchMobile({ tab, onComposerFocus }: { tab?: 'social' | 'messages'; onComposerFocus?: () => void }) {
  const { lang, t } = useLanguage();
  const [eligibleEvents, setEligibleEvents] = useState<EligibleEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [prefMap, setPrefMap] = useState<Record<string, Preference>>({});
  const [connections, setConnections] = useState<Connection[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadedSuggestionsFor, setLoadedSuggestionsFor] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPref, setSavingPref] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [requesting, setRequesting] = useState('');
  const [dismissing, setDismissing] = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editInstagram, setEditInstagram] = useState('');
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const photoPreviewAnim = useRef(new Animated.Value(0)).current;
  const chatPanelProgress = useRef(new Animated.Value(0)).current;
  const messageScrollRef = useRef<ScrollView>(null);
  const socialMatchRequestRef = useRef(false);
  const messagesRequestRef = useRef<string | null>(null);

  const hasEligibleEvent = eligibleEvents.length > 0;
  const currentPref = prefMap[selectedEventId] ?? DEFAULT_PREF;
  const activeConnection = connections.find((c) => c.id === activeChatId);
  const chatPanelTranslateY = chatPanelProgress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [28, -2, 0],
  });
  const chatPanelScale = chatPanelProgress.interpolate({
    inputRange: [0, 0.72, 1],
    outputRange: [0.976, 1.006, 1],
  });
  const visibleConnections = connections.filter((c) => c.status === 'pending' || c.status === 'accepted');
  const selectedEvent = eligibleEvents.find((e) => e.id === selectedEventId);
  const myPhotos = (currentPref.photos || []).filter(Boolean);
  const interestOptions = useMemo(() => [
    { id: 'professional_networking', label: t('Networking', 'Networking'), icon: 'handshake' as const },
    { id: 'make_friends', label: t('Amistades', 'Friends'), icon: 'user-friends' as const },
    { id: 'music_party', label: t('Música', 'Music'), icon: 'music' as const },
    { id: 'business', label: t('Negocios', 'Business'), icon: 'briefcase' as const },
    { id: 'collaborations', label: t('Colaboraciones', 'Collabs'), icon: 'users' as const },
    { id: 'singles', label: t('Solteros', 'Singles'), icon: 'heart' as const },
    { id: 'vip_experience', label: 'VIP', icon: 'crown' as const },
    { id: 'other', label: t('Otro', 'Other'), icon: 'ellipsis-h' as const },
  ], [t]);
  const interestLabels = useMemo(() => new Map(interestOptions.map((interest) => [interest.id, interest.label])), [interestOptions]);
  const messagePlaceholder = t('Escribe un mensaje...', 'Write a message...') || (lang === 'es' ? 'Escribe un mensaje...' : 'Write a message...');
  const previewEvent: EligibleEvent = {
    id: PREVIEW_EVENT_ID,
    title: t('Compra requerida', 'Purchase required'),
    eventDate: '',
    venueName: t('Social Match desactivado', 'Social Match disabled'),
  };
  const displayEvents = hasEligibleEvent ? eligibleEvents : [previewEvent];

  const openPhotoPreview = (photo: string) => {
    photoPreviewAnim.stopAnimation();
    setExpandedPhoto(photo);
    photoPreviewAnim.setValue(0);
    Animated.timing(photoPreviewAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closePhotoPreview = () => {
    photoPreviewAnim.stopAnimation();
    Animated.timing(photoPreviewAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setExpandedPhoto(null);
    });
  };

  const togglePhotoPreview = (photo: string) => {
    if (expandedPhoto === photo) closePhotoPreview();
    else openPhotoPreview(photo);
  };

  const loadSuggestions = useCallback(async (eventId: string) => {
    try {
      const data = await apiGet<{ suggestions: Suggestion[] }>(`/social-match/events/${eventId}/suggestions`);
      setSuggestions(data.suggestions || []);
      setLoadedSuggestionsFor(eventId);
      return data.suggestions || [];
    } catch {
      setSuggestions([]);
      return [];
    }
  }, []);

  const loadSocialMatch = useCallback(async (showLoader = false, silent = false) => {
    if (socialMatchRequestRef.current) return;
    socialMatchRequestRef.current = true;
    const cacheKey = await getUserCacheKey(SOCIAL_MATCH_CACHE_PREFIX);
    if (showLoader) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.eligibleEvents)) setEligibleEvents(parsed.eligibleEvents);
          if (parsed?.prefMap && typeof parsed.prefMap === 'object') setPrefMap(parsed.prefMap);
          if (Array.isArray(parsed?.connections)) setConnections(parsed.connections);
          if (Array.isArray(parsed?.suggestions)) setSuggestions(parsed.suggestions);
          if (typeof parsed?.selectedEventId === 'string') setSelectedEventId(parsed.selectedEventId);
          if (typeof parsed?.loadedSuggestionsFor === 'string') setLoadedSuggestionsFor(parsed.loadedSuggestionsFor);
          const cachedPref = parsed?.prefMap?.[parsed?.selectedEventId];
          if (cachedPref) {
            setEditInterests(cachedPref.interests || []);
            setEditInstagram(cachedPref.instagram || '');
          }
          setLoading(false);
        } else {
          setLoading(true);
        }
      } catch {
        setLoading(true);
      }
    }
    try {
      const data = await apiGet<{
        eligibleEvents: EligibleEvent[];
        preferences: Preference[];
        connections: Connection[];
      }>('/social-match/me');
      const events = data.eligibleEvents || [];
      setEligibleEvents(events);
      setConnections(data.connections || []);
      const map: Record<string, Preference> = {};
      for (const pref of data.preferences || []) map[pref.eventId] = pref;
      if (events.length === 0) {
        try {
          const stored = await AsyncStorage.getItem(PREVIEW_PREF_KEY);
          if (stored) map[PREVIEW_EVENT_ID] = { ...DEFAULT_PREF, ...JSON.parse(stored), eventId: PREVIEW_EVENT_ID, isActive: false };
        } catch {
          map[PREVIEW_EVENT_ID] = { ...DEFAULT_PREF, eventId: PREVIEW_EVENT_ID };
        }
      }
      setPrefMap(map);
      const firstId = events[0]?.id || PREVIEW_EVENT_ID;
      const nextSelectedEventId = selectedEventId && (selectedEventId === PREVIEW_EVENT_ID || events.some((event) => event.id === selectedEventId)) ? selectedEventId : firstId;
      setSelectedEventId(nextSelectedEventId);
      const nextPref = map[nextSelectedEventId] || map[firstId];
      if (nextSelectedEventId && nextPref) {
        setEditInterests(nextPref.interests || []);
        setEditInstagram(nextPref.instagram || '');
      }
      let nextSuggestions: Suggestion[] = [];
      let nextLoadedSuggestionsFor = '';
      if (nextSelectedEventId && nextPref?.isActive && !nextPref?.invisibleMode && nextSelectedEventId !== PREVIEW_EVENT_ID) {
        nextSuggestions = await loadSuggestions(nextSelectedEventId);
        nextLoadedSuggestionsFor = nextSelectedEventId;
      } else {
        setSuggestions([]);
        setLoadedSuggestionsFor('');
      }
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          eligibleEvents: events,
          prefMap: map,
          connections: data.connections || [],
          suggestions: nextSuggestions,
          selectedEventId: nextSelectedEventId,
          loadedSuggestionsFor: nextLoadedSuggestionsFor,
          savedAt: Date.now(),
        }));
      } catch {}
    } catch (err: any) {
      if (!silent) Alert.alert('Error', err?.message || 'Could not load Social Match');
    } finally {
      socialMatchRequestRef.current = false;
      if (showLoader) setLoading(false);
    }
  }, [loadSuggestions, selectedEventId]);

  const loadMessages = useCallback(async (connectionId: string, silent = false) => {
    if (messagesRequestRef.current === connectionId) return;
    messagesRequestRef.current = connectionId;
    try {
      const data = await apiGet<{ messages: Message[] }>(`/social-match/connections/${connectionId}/messages`);
      setMessages(data.messages || []);
    } catch {
      if (!silent) setMessages([]);
    } finally {
      if (messagesRequestRef.current === connectionId) messagesRequestRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (expandedPhoto && !myPhotos.includes(expandedPhoto)) closePhotoPreview();
  }, [expandedPhoto, myPhotos]);

  // Load profile on mount
  useEffect(() => {
    (async () => {
      await loadSocialMatch(true);
    })();
  }, [loadSocialMatch]);

  useEffect(() => {
    if (tab !== 'messages') return;
    loadSocialMatch(false, true);
    const interval = setInterval(() => {
      loadSocialMatch(false, true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadSocialMatch, tab]);

  // When event changes: sync edit fields + load suggestions
  useEffect(() => {
    if (!selectedEventId) return;
    const pref = prefMap[selectedEventId];
    setEditInterests(pref?.interests || []);
    setEditInstagram(pref?.instagram || '');
    if (pref?.isActive && !pref?.invisibleMode && loadedSuggestionsFor !== selectedEventId) {
      loadSuggestions(selectedEventId);
    }
  }, [loadedSuggestionsFor, loadSuggestions, prefMap, selectedEventId]);

  // Load messages when chat opens
  useEffect(() => {
    if (!activeChatId) { setMessages([]); return; }
    loadMessages(activeChatId);
  }, [activeChatId, loadMessages]);

  useEffect(() => {
    if (tab !== 'messages' || !activeChatId) return;
    const interval = setInterval(() => {
      loadMessages(activeChatId, true);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeChatId, loadMessages, tab]);

  const savePref = async (updates: Partial<Preference>, showSavedMessage = false) => {
    if (!selectedEventId || savingPref) return false;
    const base = prefMap[selectedEventId] ?? DEFAULT_PREF;
    const merged = {
      ...base,
      ...updates,
      eventId: selectedEventId,
      isActive: selectedEventId === PREVIEW_EVENT_ID ? false : updates.isActive ?? base.isActive,
    };
    if (merged.isActive && merged.interests.length === 0) {
      Alert.alert(
        t('Selecciona intereses', 'Select interests'),
        t('Elige al menos un interés antes de activar Social Match.', 'Choose at least one interest before activating Social Match.'),
      );
      return false;
    }
    setPrefMap((prev) => ({ ...prev, [selectedEventId]: merged }));

    if (selectedEventId === PREVIEW_EVENT_ID) {
      try {
        await AsyncStorage.setItem(PREVIEW_PREF_KEY, JSON.stringify(merged));
      } catch {}
      if (showSavedMessage) Alert.alert(t('Guardado', 'Saved'));
      return true;
    }

    setSavingPref(true);
    try {
      const result = await apiPut<{ preference: Preference }>(`/social-match/events/${selectedEventId}/preferences`, {
        isActive: merged.isActive,
        interests: merged.interests,
        industry: null,
        instagram: merged.instagram || null,
        privateMode: merged.privateMode,
        invisibleMode: merged.invisibleMode,
        shareInstagram: merged.shareInstagram,
        shareLocation: merged.shareLocation,
      });
      setPrefMap((prev) => ({ ...prev, [selectedEventId]: { ...result.preference, eventId: selectedEventId } }));
      if (result.preference.isActive && !result.preference.invisibleMode) {
        await loadSuggestions(selectedEventId);
      } else if (!result.preference.isActive) {
        setSuggestions([]);
        setLoadedSuggestionsFor('');
      }
      if (showSavedMessage) Alert.alert(t('Guardado', 'Saved'));
      return true;
    } catch (err: any) {
      setPrefMap((prev) => ({ ...prev, [selectedEventId]: base }));
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo guardar', 'Could not save preferences'));
      return false;
    } finally {
      setSavingPref(false);
    }
  };

  const saveEditedPref = () => {
    savePref({
      interests: editInterests,
      industry: null,
      instagram: editInstagram || null,
      isActive: hasEligibleEvent && editInterests.length > 0 ? true : currentPref.isActive,
    }, true);
  };

  const savePreviewPhotos = async (photos: string[]) => {
    const merged = { ...currentPref, eventId: PREVIEW_EVENT_ID, isActive: false, photos };
    setPrefMap((prev) => ({ ...prev, [PREVIEW_EVENT_ID]: merged }));
    try {
      await AsyncStorage.setItem(PREVIEW_PREF_KEY, JSON.stringify(merged));
    } catch {}
  };

  const handleUploadPhoto = async () => {
    if (!selectedEventId || uploadingPhoto) return;
    if (myPhotos.length >= 6) {
      Alert.alert(t('Límite de fotos', 'Photo limit'), t('Máximo 6 fotos.', 'Maximum 6 photos.'));
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('Permiso necesario', 'Permission needed'), t('Concede acceso a tus fotos para subir una imagen.', 'Grant photo access to upload an image.'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, base64: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    if (selectedEventId === PREVIEW_EVENT_ID) {
      await savePreviewPhotos([...myPhotos, asset.uri]);
      return;
    }

    setUploadingPhoto(true);
    try {
      if (!asset.base64) throw new Error(t('No se pudo preparar la foto.', 'Could not prepare the photo.'));
      const mimeType = asset.mimeType || 'image/jpeg';
      const upload = await apiPost<{ photos: string[] }>(`/social-match/events/${selectedEventId}/photos/base64`, {
        photoDataUrl: `data:${mimeType};base64,${asset.base64}`,
      });
      setPrefMap((prev) => ({ ...prev, [selectedEventId]: { ...currentPref, eventId: selectedEventId, photos: upload.photos || [] } }));
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo subir la foto.', 'Could not upload photo.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (index: number) => {
    if (!selectedEventId) return;

    if (selectedEventId === PREVIEW_EVENT_ID) {
      await savePreviewPhotos(myPhotos.filter((_, i) => i !== index));
      return;
    }

    try {
      const result = await apiDelete<{ photos: string[] }>(`/social-match/events/${selectedEventId}/photos/${index}`);
      setPrefMap((prev) => ({ ...prev, [selectedEventId]: { ...currentPref, eventId: selectedEventId, photos: result.photos || [] } }));
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo eliminar la foto.', 'Could not delete photo.'));
    }
  };

  const handleRequestConnection = async (receiverId: string) => {
    if (!selectedEventId || requesting) return;
    setRequesting(receiverId);
    try {
      await apiPost('/social-match/connections', { eventId: selectedEventId, receiverId });
      setSuggestions((prev) => prev.filter((s) => s.userId !== receiverId));
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo enviar solicitud', 'Could not send request'));
    } finally {
      setRequesting('');
    }
  };

  const handleDismissSuggestion = async (receiverId: string) => {
    if (!selectedEventId || dismissing) return;
    setDismissing(receiverId);
    setSuggestions((prev) => prev.filter((s) => s.userId !== receiverId));
    try {
      await apiPost('/social-match/suggestions/dismiss', { eventId: selectedEventId, receiverId });
    } catch (err: any) {
      await loadSuggestions(selectedEventId);
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo ocultar el perfil', 'Could not hide profile'));
    } finally {
      setDismissing('');
    }
  };

  const handleUpdateConnection = async (id: string, status: 'accepted' | 'declined' | 'cancelled') => {
    const prev = connections.find((c) => c.id === id);
    if (!prev) return;
    if (status === 'declined' || status === 'cancelled') {
      setConnections((current) => current.filter((c) => c.id !== id));
    } else {
      setConnections((current) => current.map((c) => c.id === id ? { ...c, status } : c));
    }
    try {
      await apiPut(`/social-match/connections/${id}`, { status });
    } catch (err: any) {
      setConnections((current) => {
        const exists = current.find((c) => c.id === id);
        return exists ? current.map((c) => c.id === id ? prev : c) : [...current, prev];
      });
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo actualizar', 'Could not update'));
    }
  };

  const openChat = (connectionId: string) => {
    chatPanelProgress.stopAnimation();
    chatPanelProgress.setValue(0);
    setActiveChatId(connectionId);
    requestAnimationFrame(() => {
      Animated.spring(chatPanelProgress, {
        toValue: 1,
        damping: 19,
        stiffness: 220,
        mass: 0.72,
        useNativeDriver: true,
      }).start();
    });
  };

  const closeChat = () => {
    chatPanelProgress.stopAnimation();
    Animated.timing(chatPanelProgress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setActiveChatId(null);
    });
  };

  const handleSendMessage = async () => {
    const text = chatDraft.trim();
    if (!text || !activeChatId || sendingMsg) return;
    setChatDraft('');
    setSendingMsg(true);
    try {
      const result = await apiPost<Message>(`/social-match/connections/${activeChatId}/messages`, { message: text });
      setMessages((prev) => [...prev, result]);
    } catch (err: any) {
      setChatDraft(text);
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo enviar', 'Could not send'));
    } finally {
      setSendingMsg(false);
    }
  };

  const summaryItems = useMemo(() => {
    if (!hasEligibleEvent) {
      return [
        {
          icon: 'ticket-alt' as const,
          label: t('ACCESO AL EVENTO', 'EVENT ACCESS'),
          value: t('Pendiente', 'Pending'),
          detail: t('Compra un ticket para activar Social Match.', 'Buy a ticket to activate Social Match.'),
          muted: true,
        },
      ];
    }
    if (!currentPref.isActive) {
      return [
        {
          icon: 'power-off' as const,
          label: t('SOCIAL MATCH', 'SOCIAL MATCH'),
          value: t('Desactivado', 'Off'),
          detail: t('Actívalo cuando quieras descubrir personas compatibles.', 'Turn it on whenever you want to discover compatible people.'),
          muted: true,
        },
      ];
    }
    return [
      {
        icon: 'users' as const,
        label: t('COMPATIBILIDAD', 'COMPATIBILITY'),
        value: String(suggestions.length),
        detail: t('perfiles compatibles', 'compatible profiles'),
        muted: false,
      },
      {
        icon: 'compass' as const,
        label: t('INTERESES', 'INTERESTS'),
        value: String(editInterests.length),
        detail: t('intereses seleccionados', 'selected interests'),
        muted: false,
      },
      {
        icon: currentPref.shareLocation ? 'map-marker-alt' as const : 'lock' as const,
        label: t('UBICACIÓN', 'LOCATION'),
        value: currentPref.shareLocation ? t('Lista', 'Ready') : t('Privada', 'Private'),
        detail: currentPref.shareLocation
          ? t('Se comparte solo tras aceptación mutua.', 'Shared only after mutual acceptance.')
          : t('Tu ubicación no se comparte.', 'Your location is not shared.'),
        muted: !currentPref.shareLocation,
      },
    ];
  }, [currentPref.isActive, currentPref.shareLocation, editInterests.length, hasEligibleEvent, suggestions.length, t]);

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return iso; }
  };

  if (loading) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyCopy}>{t('Cargando...', 'Loading...')}</Text>
      </View>
    );
  }

  const showSocial = !tab || tab === 'social';
  const showMessages = !tab || tab === 'messages';

  return (
    <View>
      {showSocial && (
      <>
      <View style={styles.card}>
        <View style={styles.eventPickerShell}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRail}>
            {displayEvents.map((event, index) => {
              const selected = event.id === selectedEventId;
              return (
                <TouchableOpacity key={`${event.id || 'event'}-${index}`} onPress={() => hasEligibleEvent && setSelectedEventId(event.id)} style={[styles.eventChip, selected && styles.eventChipActive, !hasEligibleEvent && styles.eventChipDisabled]} activeOpacity={hasEligibleEvent ? 0.85 : 1}>
                  <Text style={[styles.eventTitle, selected && styles.eventTitleActive]}>{event.title}</Text>
                  <Text style={[styles.eventMeta, selected && styles.eventMetaActive]}>
                    {event.eventDate ? `${formatDate(event.eventDate)}${event.venueName ? ` - ${event.venueName}` : ''}` : event.venueName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <LinearGradient pointerEvents="none" colors={['#07121F', 'rgba(7,18,31,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.eventPickerFade, styles.eventPickerFadeLeft]} />
          <LinearGradient pointerEvents="none" colors={['rgba(7,18,31,0)', '#07121F']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.eventPickerFade, styles.eventPickerFadeRight]} />
        </View>

        <ToggleRow
          title={currentPref.isActive ? t('Social Match activo', 'Social Match Active') : t('Social Match inactivo', 'Social Match Inactive')}
          subtitle={selectedEvent?.title || t('Compra una entrada para activarlo.', 'Buy a ticket to activate it.')}
          value={currentPref.isActive}
          onPress={() => savePref({ isActive: !currentPref.isActive })}
          disabled={savingPref || !hasEligibleEvent}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('INTERESES', 'INTERESTS')}</Text>
        <View style={styles.photoHeader}>
          <Text style={styles.photoTitle}>{t(`Mis fotos (${myPhotos.length}/6)`, `My photos (${myPhotos.length}/6)`)}</Text>
          <Text style={styles.photoHint}>
            {hasEligibleEvent
              ? t('Estas fotos se verán en tus matches.', 'These photos appear in your matches.')
              : t('Preview de tu perfil. Se activará con una compra.', 'Profile preview. It activates with a purchase.')}
          </Text>
        </View>
        {expandedPhoto && (
          <Animated.View
            style={[
              styles.photoPreview,
              {
                opacity: photoPreviewAnim,
                transform: [
                  {
                    translateY: photoPreviewAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                  {
                    scale: photoPreviewAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
          <TouchableOpacity onPress={closePhotoPreview} activeOpacity={0.94} style={styles.photoPreviewTap}>
            <Image source={{ uri: expandedPhoto }} style={styles.photoPreviewImage} resizeMode="contain" />
            <View style={styles.photoPreviewHint}>
              <Text style={styles.photoPreviewHintText}>{t('Toca para reducir', 'Tap to shrink')}</Text>
            </View>
          </TouchableOpacity>
          </Animated.View>
        )}
        <View style={styles.photoGrid}>
          {myPhotos.map((photo, index) => (
            <TouchableOpacity
              key={`${photo}-${index}`}
              onPress={() => togglePhotoPreview(photo)}
              activeOpacity={0.88}
              style={[styles.photoTile, expandedPhoto === photo && styles.photoTileActive]}
            >
              <Image source={{ uri: photo }} style={styles.photoImage} resizeMode="cover" />
              <TouchableOpacity onPress={() => handleDeletePhoto(index)} style={styles.photoDelete} activeOpacity={0.85}>
                <FontAwesome5 name="trash-alt" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          {myPhotos.length < 6 && (
            <TouchableOpacity onPress={handleUploadPhoto} disabled={uploadingPhoto} style={[styles.photoAdd, uploadingPhoto && { opacity: 0.6 }]} activeOpacity={0.85}>
              <FontAwesome5 name="camera" size={18} color={colors.orange} />
              <Text style={styles.photoAddText}>{uploadingPhoto ? '...' : t('Agregar', 'Add')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.interestIntro}>
          <View style={styles.interestIntroIcon}><FontAwesome5 name="compass" size={14} color={colors.orange} /></View>
          <View style={styles.interestIntroCopy}>
            <Text style={styles.interestIntroTitle}>{t('¿Qué buscas en este evento?', 'What are you looking for at this event?')}</Text>
            <Text style={styles.interestIntroHint}>{t('Elige tus intereses para descubrir asistentes compatibles.', 'Choose your interests to discover compatible attendees.')}</Text>
          </View>
        </View>

        <View style={styles.chipGrid}>
          {interestOptions.map((interest) => {
            const selected = editInterests.includes(interest.id);
            return (
              <TouchableOpacity
                key={interest.id}
                onPress={() => setEditInterests((prev) => prev.includes(interest.id) ? prev.filter((i) => i !== interest.id) : [...prev, interest.id])}
                style={[styles.interestChip, selected && styles.interestChipActive]}
              >
                <View style={[styles.interestIcon, selected && styles.interestIconActive]}>
                  <FontAwesome5 name={interest.icon} size={11} color={selected ? '#FFFFFF' : colors.orange} />
                </View>
                <Text style={[styles.interestText, selected && styles.interestTextActive]}>{interest.label}</Text>
                {selected && <FontAwesome5 name="check" size={10} color={colors.orange} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('Instagram opcional', 'Optional Instagram')}</Text>
          <TextInput key={`social-instagram-${lang}`} value={editInstagram} onChangeText={setEditInstagram} style={styles.input} placeholder="@username" placeholderTextColor="#9CA3AF" autoCapitalize="none" />
        </View>

        <GradientButton
          onPress={saveEditedPref}
          disabled={savingPref}
          height={50}
          style={styles.saveButton}
          textStyle={styles.saveText}
          label={savingPref ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR', 'SAVE')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('PRIVACIDAD', 'PRIVACY')}</Text>
        <ToggleRow title={t('Modo privado', 'Private mode')} subtitle={t('Muestra primero detalles limitados del perfil.', 'Show limited profile details first.')} value={currentPref.privateMode} onPress={() => savePref({ privateMode: !currentPref.privateMode })} />
        <ToggleRow title={t('Modo invisible', 'Invisible mode')} subtitle={t('Oculta tu perfil de sugerencias hasta activarlo.', 'Hide from suggestions until enabled.')} value={currentPref.invisibleMode} onPress={() => savePref({ invisibleMode: !currentPref.invisibleMode })} />
        <ToggleRow title={t('Compartir Instagram', 'Share Instagram')} subtitle={t('Solo después de que ambos acepten.', 'Only after both people accept.')} value={currentPref.shareInstagram} onPress={() => savePref({ shareInstagram: !currentPref.shareInstagram })} />
        <ToggleRow title={t('Ubicación aproximada', 'Approximate location')} subtitle={t('Solo después de aceptación mutua.', 'Only after mutual acceptance.')} value={currentPref.shareLocation} onPress={() => savePref({ shareLocation: !currentPref.shareLocation })} />
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.sectionLabel}>{t('RESUMEN', 'SUMMARY')}</Text>
            <Text style={styles.summaryIntro}>{t('Tu estado para este evento', 'Your status for this event')}</Text>
          </View>
          <View style={styles.summaryHeaderIcon}><FontAwesome5 name="chart-line" size={13} color={colors.orange} /></View>
        </View>
        <View style={styles.summaryList}>
          {summaryItems.map((item, index) => (
            <View key={`${item.label}-${index}`} style={[styles.summaryRow, index < summaryItems.length - 1 && styles.summaryRowDivider]}>
              <View style={[styles.summaryIcon, item.muted && styles.summaryIconMuted]}>
                <FontAwesome5 name={item.icon} size={13} color={item.muted ? 'rgba(226,232,240,0.58)' : colors.orange} />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={styles.summaryDetail}>{item.detail}</Text>
              </View>
              <Text style={[styles.summaryValue, item.muted && styles.summaryValueMuted]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {currentPref.isActive && !currentPref.invisibleMode && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('PERFILES SUGERIDOS', 'SUGGESTED PROFILES')}</Text>
          {suggestions.length === 0 && (
            <Text style={styles.emptyCopy}>{t('Sin sugerencias por ahora.', 'No suggestions yet.')}</Text>
          )}
          {suggestions.length > 0 && (
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={suggestions.length > 3}
              contentContainerStyle={styles.suggestionsContent}
              style={styles.suggestionsScroll}
            >
              {suggestions.map((suggestion, index) => (
                <View key={`${suggestion.userId || 'suggestion'}-${index}`} style={styles.suggestionCard}>
                  <View style={styles.suggestionTop}>
                    <View style={styles.scoreBadge}><Text style={styles.scoreText}>{suggestion.score}%</Text></View>
                    <View style={styles.suggestionCopy}>
                      <Text style={styles.suggestionName} numberOfLines={1}>{suggestion.displayName}</Text>
                      <Text style={styles.suggestionMeta} numberOfLines={1}>{suggestion.sharedInterests.length} {t('intereses en común', 'shared interests')}</Text>
                    </View>
                    <View style={styles.suggestionActions}>
                      <TouchableOpacity
                        style={[styles.dismissButton, dismissing === suggestion.userId && { opacity: 0.6 }]}
                        onPress={() => handleDismissSuggestion(suggestion.userId)}
                        disabled={dismissing === suggestion.userId}
                      >
                        <FontAwesome5 name="times" size={14} color="#F8FAFC" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.connectButton, requesting === suggestion.userId && { opacity: 0.6 }]}
                        onPress={() => handleRequestConnection(suggestion.userId)}
                        disabled={!!requesting}
                      >
                        <Text style={styles.connectText}>{requesting === suggestion.userId ? '...' : t('SOLICITAR', 'REQUEST')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {suggestion.sharedInterests.length > 0 && (
                    <View style={styles.tagRow}>
                      {suggestion.sharedInterests.map((tag, tagIndex) => (
                        <View key={`${tag}-${tagIndex}`} style={styles.tag}>
                          <Text style={styles.tagText}>{interestLabels.get(tag) || tag.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
      </>
      )}

      {showMessages && (
      <>
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('SOLICITUDES', 'REQUESTS')}</Text>
        {visibleConnections.length === 0 && (
          <Text style={styles.emptyCopy}>{t('Sin solicitudes por ahora.', 'No requests yet.')}</Text>
        )}
        {visibleConnections.map((connection, index) => (
          <View key={`${connection.id || 'connection'}-${index}`} style={styles.connectionCard}>
            <View style={styles.connectionAvatar}>
              <Text style={styles.connectionAvatarText}>{connection.otherUserName.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.connectionCopy}>
              <Text style={styles.connectionName}>{connection.otherUserName}</Text>
              <Text style={styles.connectionMeta}>{connection.eventTitle} - {connection.status}</Text>
            </View>
            {connection.status === 'pending' && connection.direction === 'incoming' && (
              <View style={styles.connectionActions}>
                <TouchableOpacity onPress={() => handleUpdateConnection(connection.id, 'accepted')} style={styles.acceptButton}>
                  <Text style={styles.acceptText}>{t('ACEPTAR', 'ACCEPT')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleUpdateConnection(connection.id, 'declined')} style={styles.rejectButton}>
                  <Text style={styles.rejectText}>No</Text>
                </TouchableOpacity>
              </View>
            )}
            {connection.status === 'pending' && connection.direction === 'outgoing' && (
              <TouchableOpacity onPress={() => handleUpdateConnection(connection.id, 'cancelled')} style={styles.rejectButton}>
                <Text style={styles.rejectText}>{t('CANCELAR', 'CANCEL')}</Text>
              </TouchableOpacity>
            )}
            {connection.status === 'accepted' && (
              <TouchableOpacity onPress={() => openChat(connection.id)} style={styles.chatButton}>
                <Text style={styles.chatText}>Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {activeConnection && (
        <Animated.View
          style={[
            styles.chatPanel,
            {
              opacity: chatPanelProgress,
              transform: [{ translateY: chatPanelTranslateY }, { scale: chatPanelScale }],
            },
          ]}
        >
        <View style={styles.card}>
          <View style={styles.chatHeader}>
            <View>
              <Text style={styles.sectionLabel}>Chat</Text>
              <Text style={styles.chatName}>{activeConnection.otherUserName}</Text>
            </View>
            <TouchableOpacity onPress={closeChat} style={styles.closeChat}>
              <Text style={styles.closeChatText}>{t('CERRAR', 'CLOSE')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.messagesBox}>
            <ScrollView
              ref={messageScrollRef}
              nestedScrollEnabled
              showsVerticalScrollIndicator={messages.length > 5}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => messageScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((message, index) => (
                <View key={`${message.id || 'message'}-${index}`} style={[styles.messageBubble, message.isMine ? styles.messageMine : styles.messageTheirs]}>
                  <Text style={[styles.messageText, message.isMine && styles.messageTextMine]}>{message.message}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.chatComposer}>
            <TextInput
              key={`social-message-${lang}`}
              value={chatDraft}
              onChangeText={setChatDraft}
              style={styles.chatInput}
              placeholder={messagePlaceholder}
              placeholderTextColor="#9CA3AF"
              multiline
              scrollEnabled
              textAlignVertical="top"
              onFocus={onComposerFocus}
            />
            <TouchableOpacity onPress={handleSendMessage} disabled={sendingMsg} style={[styles.sendButton, sendingMsg && { opacity: 0.6 }]}>
              <Text style={styles.sendText}>{t('ENVIAR', 'SEND')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Animated.View>
      )}
      </>
      )}
    </View>
  );
}

function ToggleRow({ title, subtitle, value, onPress, disabled = false }: { title: string; subtitle: string; value: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}
      activeOpacity={0.84}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value, disabled }}
    >
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{subtitle}</Text>
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
        <Text style={[styles.toggleStateText, value ? styles.toggleStateTextActive : styles.toggleStateTextInactive]}>
          {value ? 'ON' : 'OFF'}
        </Text>
        <View style={[styles.toggleDot, value && styles.toggleDotActive]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: { color: '#F8FAFC', fontSize: 17, fontWeight: '600' },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '600', marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 6 },
  copy: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, fontWeight: '400' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusCardActive: { borderColor: 'rgba(249,115,22,0.42)' },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: { flex: 1, minWidth: 0 },
  statusTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '600', marginBottom: 3 },
  statusText: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 17, fontWeight: '400' },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.32)',
    backgroundColor: 'rgba(148,163,184,0.10)',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusPillActive: {
    borderColor: 'rgba(249,115,22,0.48)',
    backgroundColor: 'rgba(249,115,22,0.16)',
  },
  statusPillText: { color: 'rgba(226,232,240,0.72)', fontSize: 9, fontWeight: '600' },
  statusPillTextActive: { color: colors.orange },
  sectionLabel: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '600', marginBottom: 12 },
  eventPickerShell: { height: 94, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#07121F', overflow: 'hidden', marginBottom: 12, position: 'relative' },
  eventRail: { gap: 10, paddingHorizontal: 12, alignItems: 'center' },
  eventChip: {
    width: 238,
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 14,
  },
  eventChipActive: { backgroundColor: '#030B14', borderColor: 'rgba(249,115,22,0.62)' },
  eventChipDisabled: { borderColor: 'rgba(148,163,184,0.18)', opacity: 0.92 },
  eventTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  eventTitleActive: { color: '#FFFFFF' },
  eventMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '400' },
  eventMetaActive: { color: '#cbd5e1' },
  eventPickerFade: { position: 'absolute', top: 1, bottom: 1, width: 28, zIndex: 2 },
  eventPickerFadeLeft: { left: 1 },
  eventPickerFadeRight: { right: 1 },
  activation: {
    marginTop: 14,
    minHeight: 62,
    borderRadius: 16,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activationActive: { backgroundColor: '#030B14', borderColor: 'rgba(249,115,22,0.62)' },
  activationTitle: { color: 'rgba(226,232,240,0.64)', fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 3 },
  activationTitleActive: { color: '#FFFFFF' },
  activationSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  activationSubActive: { color: '#cbd5e1' },
  switchKnob: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#cbd5e1' },
  switchKnobActive: { backgroundColor: colors.orange },
  photoHeader: { marginBottom: 11 },
  photoTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 3 },
  photoHint: { color: 'rgba(226,232,240,0.58)', fontSize: 11.5, lineHeight: 16, fontWeight: '400' },
  photoPreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.42)',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreviewTap: { width: '100%', height: '100%' },
  photoPreviewImage: { width: '100%', height: '100%' },
  photoPreviewHint: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(3,11,20,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreviewHintText: { color: 'rgba(248,250,252,0.86)', fontSize: 11, fontWeight: '600' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  photoTile: {
    width: 74,
    height: 74,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  photoTileActive: { borderColor: 'rgba(249,115,22,0.78)' },
  photoImage: { width: '100%', height: '100%' },
  photoDelete: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 25,
    height: 25,
    borderRadius: 999,
    backgroundColor: 'rgba(3,11,20,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 74,
    height: 74,
    borderRadius: 18,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: 'rgba(249,115,22,0.48)',
    backgroundColor: 'rgba(249,115,22,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  photoAddText: { color: colors.orange, fontSize: 10.5, fontWeight: '600' },
  interestIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(249,115,22,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.18)',
    marginBottom: 12,
  },
  interestIntroIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestIntroCopy: { flex: 1 },
  interestIntroTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  interestIntroHint: { color: 'rgba(226,232,240,0.62)', fontSize: 11, lineHeight: 15 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  interestChip: {
    width: '48%',
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  interestChipActive: { backgroundColor: '#030B14', borderColor: 'rgba(249,115,22,0.62)' },
  interestIcon: {
    width: 23,
    height: 23,
    borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestIconActive: { backgroundColor: 'rgba(249,115,22,0.72)' },
  interestText: { flex: 1, color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '600' },
  interestTextActive: { color: '#FFFFFF' },
  inputGroup: { gap: 7, marginBottom: 12 },
  inputLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400' },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 15,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 16,
    marginTop: 4,
  },
  saveText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  toggleRow: {
    minHeight: 70,
    borderRadius: 16,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleRowDisabled: { opacity: 0.62 },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  toggleSub: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 17, fontWeight: '400' },
  toggleTrack: { width: 60, height: 30, borderRadius: 999, backgroundColor: '#E2E8F0', padding: 3, justifyContent: 'center', position: 'relative' },
  toggleTrackActive: { backgroundColor: colors.orange },
  toggleStateText: { position: 'absolute', fontSize: 9, fontWeight: '700', letterSpacing: 0.35 },
  toggleStateTextInactive: { right: 7, color: '#334155' },
  toggleStateTextActive: { left: 8, color: '#FFFFFF' },
  toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleDotActive: { transform: [{ translateX: 30 }] },
  summaryCard: {
    backgroundColor: '#07121F',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.22)',
    padding: 16,
    marginBottom: 14,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  summaryIntro: { color: 'rgba(226,232,240,0.58)', fontSize: 11.5, marginTop: 3 },
  summaryHeaderIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.10)', alignItems: 'center', justifyContent: 'center' },
  summaryList: { borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(3,11,20,0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  summaryRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  summaryRowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  summaryIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.11)', alignItems: 'center', justifyContent: 'center' },
  summaryIconMuted: { backgroundColor: 'rgba(148,163,184,0.12)' },
  summaryCopy: { flex: 1, paddingRight: 4 },
  summaryLabel: { color: 'rgba(226,232,240,0.56)', fontSize: 9.5, fontWeight: '700', letterSpacing: 0.65, marginBottom: 3 },
  summaryDetail: { color: '#E2E8F0', fontSize: 12.5, fontWeight: '500', lineHeight: 17 },
  summaryValue: { color: colors.orange, fontSize: 22, fontWeight: '700', textAlign: 'right' },
  summaryValueMuted: { color: 'rgba(226,232,240,0.70)', fontSize: 13, fontWeight: '600' },
  suggestionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 11,
    gap: 9,
  },
  suggestionsScroll: { maxHeight: 344 },
  suggestionsContent: { gap: 10, paddingBottom: 2 },
  suggestionTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { color: colors.orange, fontSize: 13, fontWeight: '600' },
  suggestionCopy: { flex: 1 },
  suggestionName: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  suggestionMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 11, fontWeight: '400' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  tag: {
    minWidth: 52,
    height: 26,
    backgroundColor: '#030B14',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tagText: { color: '#F8FAFC', fontSize: 9.5, fontWeight: '600', textAlign: 'center' },
  suggestionActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dismissButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButton: { width: 92, backgroundColor: colors.orange, borderRadius: 14, paddingHorizontal: 8, height: 38, alignItems: 'center', justifyContent: 'center' },
  connectText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 0, fontWeight: '600' },
  connectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  connectionAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  connectionAvatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  connectionCopy: { flex: 1 },
  connectionName: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 3 },
  connectionMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 11, fontWeight: '400' },
  connectionActions: { flexDirection: 'row', gap: 6 },
  acceptButton: { width: 78, height: 40, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  rejectButton: { width: 78, height: 40, borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  chatButton: { width: 78, height: 40, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  chatText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  chatPanel: { marginTop: 2 },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chatName: { color: '#F8FAFC', fontSize: 20, fontWeight: '600' },
  closeChat: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 9 },
  closeChatText: { color: '#F8FAFC', fontSize: 10, fontWeight: '600' },
  messagesBox: {
    maxHeight: 292,
    minHeight: 150,
    backgroundColor: '#030B14',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  messagesContent: { gap: 9, paddingBottom: 2 },
  messageBubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  messageMine: { alignSelf: 'flex-end', backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.36)' },
  messageTheirs: { alignSelf: 'flex-start', backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  messageText: { color: '#F8FAFC', fontSize: 13, fontWeight: '400', lineHeight: 18 },
  messageTextMine: { color: '#FFFFFF' },
  chatComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  chatInput: {
    flex: 1,
    minHeight: 50,
    maxHeight: 92,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 10,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  sendButton: { width: 76, minHeight: 50, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 24, alignItems: 'center' },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '600', marginBottom: 8 },
  emptyCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 21 },
});
