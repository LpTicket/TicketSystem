import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { apiGet, apiPost, apiPut } from '../../services/api';

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
};

type Suggestion = {
  userId: string;
  displayName: string;
  score: number;
  interests: string[];
  sharedInterests: string[];
  industryMatch: boolean;
  industry: string | null;
  canShareLocationLater: boolean;
};

type Connection = {
  id: string;
  eventId: string;
  eventTitle: string;
  status: string;
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

const INTEREST_OPTIONS = [
  { id: 'professional_networking', label: 'Networking' },
  { id: 'make_friends', label: 'Friends' },
  { id: 'music_party', label: 'Music' },
  { id: 'business', label: 'Business' },
  { id: 'collaborations', label: 'Collabs' },
  { id: 'singles', label: 'Singles' },
  { id: 'vip_experience', label: 'VIP' },
  { id: 'other', label: 'Other' },
];

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
};

export function SocialMatchMobile() {
  const { t } = useLanguage();
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
  const [sendingMsg, setSendingMsg] = useState(false);
  const [requesting, setRequesting] = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [editIndustry, setEditIndustry] = useState('');
  const [editInstagram, setEditInstagram] = useState('');

  const currentPref = prefMap[selectedEventId] ?? DEFAULT_PREF;
  const activeConnection = connections.find((c) => c.id === activeChatId);
  const visibleConnections = connections.filter((c) => c.status === 'PENDING' || c.status === 'ACCEPTED');

  // Load profile on mount
  useEffect(() => {
    (async () => {
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
        setPrefMap(map);
        const firstId = events[0]?.id || '';
        setSelectedEventId(firstId);
        if (firstId && map[firstId]) {
          setEditInterests(map[firstId].interests || []);
          setEditIndustry(map[firstId].industry || '');
          setEditInstagram(map[firstId].instagram || '');
        }
      } catch (err: any) {
        Alert.alert('Error', err?.message || 'Could not load Social Match');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // When event changes: sync edit fields + load suggestions
  useEffect(() => {
    if (!selectedEventId) return;
    const pref = prefMap[selectedEventId];
    setEditInterests(pref?.interests || []);
    setEditIndustry(pref?.industry || '');
    setEditInstagram(pref?.instagram || '');
    if (pref?.isActive && !pref?.invisibleMode && loadedSuggestionsFor !== selectedEventId) {
      loadSuggestions(selectedEventId);
    }
  }, [selectedEventId]);

  // Load messages when chat opens
  useEffect(() => {
    if (!activeChatId) { setMessages([]); return; }
    (async () => {
      try {
        const data = await apiGet<{ messages: Message[] }>(`/social-match/connections/${activeChatId}/messages`);
        setMessages(data.messages || []);
      } catch {
        setMessages([]);
      }
    })();
  }, [activeChatId]);

  const loadSuggestions = async (eventId: string) => {
    try {
      const data = await apiGet<{ suggestions: Suggestion[] }>(`/social-match/events/${eventId}/suggestions`);
      setSuggestions(data.suggestions || []);
      setLoadedSuggestionsFor(eventId);
    } catch {
      setSuggestions([]);
    }
  };

  const savePref = async (updates: Partial<Preference>) => {
    if (!selectedEventId || savingPref) return;
    const base = prefMap[selectedEventId] ?? DEFAULT_PREF;
    const merged = { ...base, ...updates };
    setPrefMap((prev) => ({ ...prev, [selectedEventId]: merged }));
    setSavingPref(true);
    try {
      const result = await apiPut<{ preference: Preference }>(`/social-match/events/${selectedEventId}/preferences`, {
        isActive: merged.isActive,
        interests: merged.interests,
        industry: merged.industry || null,
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
    } catch (err: any) {
      setPrefMap((prev) => ({ ...prev, [selectedEventId]: base }));
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo guardar', 'Could not save preferences'));
    } finally {
      setSavingPref(false);
    }
  };

  const saveEditedPref = () => {
    savePref({ interests: editInterests, industry: editIndustry || null, instagram: editInstagram || null });
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

  const handleUpdateConnection = async (id: string, status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED') => {
    const prev = connections.find((c) => c.id === id);
    if (!prev) return;
    if (status === 'DECLINED' || status === 'CANCELLED') {
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

  const summary = useMemo(() => {
    if (!currentPref.isActive) return [t('Social Match está desactivado para este evento.', 'Social Match is currently off for this event.')];
    return [
      `${suggestions.length} ${t('perfiles compatibles', 'compatible profiles')}`,
      `${editInterests.length} ${t('intereses seleccionados', 'selected interests')}`,
      currentPref.shareLocation
        ? t('Ubicación lista tras aceptación mutua', 'Location sharing ready after mutual acceptance')
        : t('Ubicación privada', 'Location sharing is private'),
    ];
  }, [currentPref.isActive, currentPref.shareLocation, editInterests.length, suggestions.length, t]);

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

  if (eligibleEvents.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <FontAwesome5 name="handshake" size={27} color={colors.orange} />
        </View>
        <Text style={styles.emptyTitle}>Social match</Text>
        <Text style={styles.emptyCopy}>{t('Compra un ticket para activar Social Match en ese evento.', 'Buy a ticket to activate Social Match for that event.')}</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('EVENTO ELEGIBLE', 'ELIGIBLE EVENT')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRail}>
          {eligibleEvents.map((event) => {
            const selected = event.id === selectedEventId;
            return (
              <TouchableOpacity key={event.id} onPress={() => setSelectedEventId(event.id)} style={[styles.eventChip, selected && styles.eventChipActive]}>
                <Text style={[styles.eventTitle, selected && styles.eventTitleActive]}>{event.title}</Text>
                <Text style={[styles.eventMeta, selected && styles.eventMetaActive]}>{formatDate(event.eventDate)}{event.venueName ? ` - ${event.venueName}` : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          onPress={() => savePref({ isActive: !currentPref.isActive, interests: editInterests, industry: editIndustry || null, instagram: editInstagram || null })}
          style={[styles.activation, currentPref.isActive && styles.activationActive]}
          disabled={savingPref}
        >
          <View>
            <Text style={[styles.activationTitle, currentPref.isActive && styles.activationTitleActive]}>
              {currentPref.isActive ? 'SOCIAL MATCH ACTIVE' : 'SOCIAL MATCH OFF'}
            </Text>
            <Text style={[styles.activationSub, currentPref.isActive && styles.activationSubActive]}>
              {eligibleEvents.find((e) => e.id === selectedEventId)?.title}
            </Text>
          </View>
          <View style={[styles.switchKnob, currentPref.isActive && styles.switchKnobActive]} />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('INTERESES', 'INTERESTS')}</Text>
        <View style={styles.chipGrid}>
          {INTEREST_OPTIONS.map((interest) => {
            const selected = editInterests.includes(interest.id);
            return (
              <TouchableOpacity
                key={interest.id}
                onPress={() => setEditInterests((prev) => prev.includes(interest.id) ? prev.filter((i) => i !== interest.id) : [...prev, interest.id])}
                style={[styles.interestChip, selected && styles.interestChipActive]}
              >
                <Text style={[styles.interestText, selected && styles.interestTextActive]}>{interest.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('Industria o área', 'Industry or field')}</Text>
          <TextInput value={editIndustry} onChangeText={setEditIndustry} style={styles.input} placeholder={t('Música, finanzas, bienes raíces...', 'Music, finance, real estate...')} placeholderTextColor="#9CA3AF" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('Instagram opcional', 'Optional Instagram')}</Text>
          <TextInput value={editInstagram} onChangeText={setEditInstagram} style={styles.input} placeholder="@username" placeholderTextColor="#9CA3AF" autoCapitalize="none" />
        </View>

        <TouchableOpacity onPress={saveEditedPref} disabled={savingPref} style={styles.saveButton}>
          <Text style={styles.saveText}>{savingPref ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR', 'SAVE')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('PRIVACIDAD', 'PRIVACY')}</Text>
        <ToggleRow title={t('Modo privado', 'Private mode')} subtitle={t('Muestra primero detalles limitados del perfil.', 'Show limited profile details first.')} value={currentPref.privateMode} onPress={() => savePref({ privateMode: !currentPref.privateMode })} />
        <ToggleRow title={t('Modo invisible', 'Invisible mode')} subtitle={t('Oculta tu perfil de sugerencias hasta activarlo.', 'Hide from suggestions until enabled.')} value={currentPref.invisibleMode} onPress={() => savePref({ invisibleMode: !currentPref.invisibleMode })} />
        <ToggleRow title={t('Compartir Instagram', 'Share Instagram')} subtitle={t('Solo después de que ambos acepten.', 'Only after both people accept.')} value={currentPref.shareInstagram} onPress={() => savePref({ shareInstagram: !currentPref.shareInstagram })} />
        <ToggleRow title={t('Ubicación aproximada', 'Approximate location')} subtitle={t('Solo después de aceptación mutua.', 'Only after mutual acceptance.')} value={currentPref.shareLocation} onPress={() => savePref({ shareLocation: !currentPref.shareLocation })} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionLabel}>{t('RESUMEN', 'SUMMARY')}</Text>
        {summary.map((item) => (
          <Text key={item} style={styles.summaryText}>{item}</Text>
        ))}
      </View>

      {currentPref.isActive && !currentPref.invisibleMode && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('PERFILES SUGERIDOS', 'SUGGESTED PROFILES')}</Text>
          {suggestions.length === 0 && (
            <Text style={styles.emptyCopy}>{t('Sin sugerencias por ahora.', 'No suggestions yet.')}</Text>
          )}
          {suggestions.map((suggestion) => (
            <View key={suggestion.userId} style={styles.suggestionCard}>
              <View style={styles.suggestionTop}>
                <View style={styles.scoreBadge}><Text style={styles.scoreText}>{suggestion.score}%</Text></View>
                <View style={styles.suggestionCopy}>
                  <Text style={styles.suggestionName} numberOfLines={1}>{suggestion.displayName}</Text>
                  <Text style={styles.suggestionMeta} numberOfLines={1}>{suggestion.sharedInterests.length} {t('intereses en común', 'shared interests')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.connectButton, requesting === suggestion.userId && { opacity: 0.6 }]}
                  onPress={() => handleRequestConnection(suggestion.userId)}
                  disabled={!!requesting}
                >
                  <Text style={styles.connectText}>{requesting === suggestion.userId ? '...' : t('SOLICITAR', 'REQUEST')}</Text>
                </TouchableOpacity>
              </View>
              {suggestion.sharedInterests.length > 0 && (
                <View style={styles.tagRow}>
                  {suggestion.sharedInterests.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag.replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('SOLICITUDES', 'REQUESTS')}</Text>
        {visibleConnections.length === 0 && (
          <Text style={styles.emptyCopy}>{t('Sin solicitudes por ahora.', 'No requests yet.')}</Text>
        )}
        {visibleConnections.map((connection) => (
          <View key={connection.id} style={styles.connectionCard}>
            <View style={styles.connectionAvatar}>
              <Text style={styles.connectionAvatarText}>{connection.otherUserName.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.connectionCopy}>
              <Text style={styles.connectionName}>{connection.otherUserName}</Text>
              <Text style={styles.connectionMeta}>{connection.eventTitle} - {connection.status}</Text>
            </View>
            {connection.status === 'PENDING' && connection.direction === 'incoming' && (
              <View style={styles.connectionActions}>
                <TouchableOpacity onPress={() => handleUpdateConnection(connection.id, 'ACCEPTED')} style={styles.acceptButton}>
                  <Text style={styles.acceptText}>{t('ACEPTAR', 'ACCEPT')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleUpdateConnection(connection.id, 'DECLINED')} style={styles.rejectButton}>
                  <Text style={styles.rejectText}>No</Text>
                </TouchableOpacity>
              </View>
            )}
            {connection.status === 'PENDING' && connection.direction === 'outgoing' && (
              <TouchableOpacity onPress={() => handleUpdateConnection(connection.id, 'CANCELLED')} style={styles.rejectButton}>
                <Text style={styles.rejectText}>{t('CANCELAR', 'CANCEL')}</Text>
              </TouchableOpacity>
            )}
            {connection.status === 'ACCEPTED' && (
              <TouchableOpacity onPress={() => setActiveChatId(connection.id)} style={styles.chatButton}>
                <Text style={styles.chatText}>Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {activeConnection && (
        <View style={styles.card}>
          <View style={styles.chatHeader}>
            <View>
              <Text style={styles.sectionLabel}>Chat</Text>
              <Text style={styles.chatName}>{activeConnection.otherUserName}</Text>
            </View>
            <TouchableOpacity onPress={() => setActiveChatId(null)} style={styles.closeChat}>
              <Text style={styles.closeChatText}>{t('CERRAR', 'CLOSE')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.messagesBox}>
            {messages.map((message) => (
              <View key={message.id} style={[styles.messageBubble, message.isMine ? styles.messageMine : styles.messageTheirs]}>
                <Text style={[styles.messageText, message.isMine && styles.messageTextMine]}>{message.message}</Text>
              </View>
            ))}
          </View>

          <View style={styles.chatComposer}>
            <TextInput
              value={chatDraft}
              onChangeText={setChatDraft}
              style={styles.chatInput}
              placeholder={t('Escribe un mensaje...', 'Write a message...')}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity onPress={handleSendMessage} disabled={sendingMsg} style={[styles.sendButton, sendingMsg && { opacity: 0.6 }]}>
              <Text style={styles.sendText}>{t('ENVIAR', 'SEND')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function ToggleRow({ title, subtitle, value, onPress }: { title: string; subtitle: string; value: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSub}>{subtitle}</Text>
      </View>
      <View style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
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
  heroIconText: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '700', marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 6 },
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
  sectionLabel: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '700', marginBottom: 12 },
  eventRail: { gap: 10, paddingRight: 4 },
  eventChip: {
    width: 230,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 14,
  },
  eventChipActive: { backgroundColor: '#030B14', borderColor: 'rgba(249,115,22,0.62)' },
  eventTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  eventTitleActive: { color: '#FFFFFF' },
  eventMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '400' },
  eventMetaActive: { color: '#cbd5e1' },
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
  activationTitle: { color: 'rgba(226,232,240,0.64)', fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 3 },
  activationTitleActive: { color: '#FFFFFF' },
  activationSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  activationSubActive: { color: '#cbd5e1' },
  switchKnob: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#cbd5e1' },
  switchKnobActive: { backgroundColor: colors.orange },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  interestChip: {
    width: '48%',
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestChipActive: { backgroundColor: '#030B14', borderColor: 'rgba(249,115,22,0.62)' },
  interestText: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '700' },
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
    fontWeight: '700',
  },
  saveButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
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
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  toggleSub: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 17, fontWeight: '400' },
  toggleTrack: { width: 48, height: 28, borderRadius: 999, backgroundColor: '#cbd5e1', padding: 3 },
  toggleTrackActive: { backgroundColor: colors.orange },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.018)' },
  toggleDotActive: { transform: [{ translateX: 20 }] },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 16,
    marginBottom: 14,
  },
  summaryText: { color: '#F8FAFC', fontSize: 14, lineHeight: 22, fontWeight: '400' },
  suggestionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 11,
    marginBottom: 10,
    gap: 9,
  },
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
  scoreText: { color: colors.orange, fontSize: 13, fontWeight: '700' },
  suggestionCopy: { flex: 1 },
  suggestionName: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 2 },
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
  tagText: { color: '#F8FAFC', fontSize: 9.5, fontWeight: '700', textAlign: 'center' },
  connectButton: { width: 92, backgroundColor: colors.orange, borderRadius: 14, paddingHorizontal: 8, height: 38, alignItems: 'center', justifyContent: 'center' },
  connectText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 0, fontWeight: '700' },
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
  connectionAvatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  connectionCopy: { flex: 1 },
  connectionName: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  connectionMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 11, fontWeight: '400' },
  connectionActions: { flexDirection: 'row', gap: 6 },
  acceptButton: { width: 78, height: 40, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  rejectButton: { width: 78, height: 40, borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  chatButton: { width: 78, height: 40, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  chatText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chatName: { color: '#F8FAFC', fontSize: 20, fontWeight: '700' },
  closeChat: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 9 },
  closeChatText: { color: '#F8FAFC', fontSize: 10, fontWeight: '700' },
  messagesBox: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 12, gap: 9, marginBottom: 12 },
  messageBubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  messageMine: { alignSelf: 'flex-end', backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.36)' },
  messageTheirs: { alignSelf: 'flex-start', backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  messageText: { color: '#F8FAFC', fontSize: 13, fontWeight: '400', lineHeight: 18 },
  messageTextMine: { color: '#FFFFFF' },
  chatComposer: { flexDirection: 'row', gap: 8 },
  chatInput: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  sendButton: { width: 76, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 24, alignItems: 'center' },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  emptyCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 21 },
});
