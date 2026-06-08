import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type ConnectionStatus = 'incoming' | 'outgoing' | 'accepted';

const interests = [
  { id: 'professional_networking', label: 'Networking' },
  { id: 'make_friends', label: 'Friends' },
  { id: 'music_party', label: 'Music' },
  { id: 'business', label: 'Business' },
  { id: 'collaborations', label: 'Collabs' },
  { id: 'singles', label: 'Singles' },
  { id: 'vip_experience', label: 'VIP' },
  { id: 'other', label: 'Other' },
];

const eligibleEvents = [
  { id: 'event-1', title: 'Noche de (des)amor', date: 'Jun 25, 2026', venue: 'Ambriza' },
  { id: 'event-2', title: 'Sunset Lounge Experience', date: 'Jul 12, 2026', venue: 'Miami, FL' },
];

const suggestions = [
  { id: '1', name: 'Compatible attendee', meta: '3 shared interests', score: 92, tags: ['Music', 'VIP', 'Friends'] },
  { id: '2', name: 'Maria L.', meta: 'Same industry', score: 86, tags: ['Business', 'Networking'] },
  { id: '3', name: 'Private profile', meta: 'Location optional later', score: 79, tags: ['Collabs', 'VIP'] },
];

const initialConnections = [
  { id: 'c1', name: 'Fidel G.', event: 'Noche de (des)amor', status: 'incoming' as ConnectionStatus },
  { id: 'c2', name: 'Andrea P.', event: 'Sunset Lounge Experience', status: 'outgoing' as ConnectionStatus },
  { id: 'c3', name: 'Carlos R.', event: 'Noche de (des)amor', status: 'accepted' as ConnectionStatus },
];

export function SocialMatchMobile() {
  const { t } = useLanguage();
  const [selectedEventId, setSelectedEventId] = useState(eligibleEvents[0]?.id || '');
  const [isActive, setIsActive] = useState(true);
  const [selectedInterests, setSelectedInterests] = useState(['music_party', 'vip_experience', 'make_friends']);
  const [industry, setIndustry] = useState('Events / entertainment');
  const [instagram, setInstagram] = useState('@lpticket');
  const [privateMode, setPrivateMode] = useState(true);
  const [invisibleMode, setInvisibleMode] = useState(false);
  const [shareInstagram, setShareInstagram] = useState(false);
  const [shareLocation, setShareLocation] = useState(false);
  const [connections, setConnections] = useState(initialConnections);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [messages, setMessages] = useState([
    { id: 'm1', mine: false, text: 'Hi, we matched for Noche de (des)amor.' },
    { id: 'm2', mine: true, text: 'Nice, see you there.' },
  ]);

  const selectedEvent = eligibleEvents.find((event) => event.id === selectedEventId);
  const activeConnection = connections.find((connection) => connection.id === activeChatId);

  const summary = useMemo(() => {
    if (!isActive) return ['Social Match is currently off for this event.'];
    return [
      `${suggestions.length} compatible profiles`,
      `${selectedInterests.length} selected interests`,
      shareLocation ? 'Location sharing ready after mutual acceptance' : 'Location sharing is private',
    ];
  }, [isActive, selectedInterests.length, shareLocation]);

  const toggleInterest = (id: string) => {
    setSelectedInterests((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const updateConnection = (id: string, status: ConnectionStatus | 'declined' | 'cancelled') => {
    if (status === 'declined' || status === 'cancelled') {
      setConnections((current) => current.filter((item) => item.id !== id));
      return;
    }
    setConnections((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  };

  const sendMessage = () => {
    const text = chatDraft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: `${Date.now()}`, mine: true, text }]);
    setChatDraft('');
  };

  if (eligibleEvents.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>SM</Text></View>
        <Text style={styles.emptyTitle}>Social Match</Text>
        <Text style={styles.emptyCopy}>{t('Compra un ticket para activar Social Match en ese evento.', 'Buy a ticket to activate Social Match for that event.')}</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.heroCard}>
        <View style={styles.heroIcon}><Text style={styles.heroIconText}>SM</Text></View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>SOCIAL MATCH</Text>
          <Text style={styles.title}>{t('Conexiones del evento', 'Event connections')}</Text>
          <Text style={styles.copy}>{t('Conecta con asistentes compatibles en eventos donde ya tienes ticket.', 'Connect with compatible attendees at events where you already have a ticket.')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('EVENTO ELEGIBLE', 'ELIGIBLE EVENT')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventRail}>
          {eligibleEvents.map((event) => {
            const selected = event.id === selectedEventId;
            return (
              <TouchableOpacity key={event.id} onPress={() => setSelectedEventId(event.id)} style={[styles.eventChip, selected && styles.eventChipActive]}>
                <Text style={[styles.eventTitle, selected && styles.eventTitleActive]}>{event.title}</Text>
                <Text style={[styles.eventMeta, selected && styles.eventMetaActive]}>{event.date} - {event.venue}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity onPress={() => setIsActive((current) => !current)} style={[styles.activation, isActive && styles.activationActive]}>
          <View>
            <Text style={[styles.activationTitle, isActive && styles.activationTitleActive]}>
              {isActive ? 'SOCIAL MATCH ACTIVE' : 'SOCIAL MATCH OFF'}
            </Text>
            <Text style={[styles.activationSub, isActive && styles.activationSubActive]}>{selectedEvent?.title}</Text>
          </View>
          <View style={[styles.switchKnob, isActive && styles.switchKnobActive]} />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('INTERESES', 'INTERESTS')}</Text>
        <View style={styles.chipGrid}>
          {interests.map((interest) => {
            const selected = selectedInterests.includes(interest.id);
            return (
              <TouchableOpacity key={interest.id} onPress={() => toggleInterest(interest.id)} style={[styles.interestChip, selected && styles.interestChipActive]}>
                <Text style={[styles.interestText, selected && styles.interestTextActive]}>{interest.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('Industria o área', 'Industry or field')}</Text>
          <TextInput value={industry} onChangeText={setIndustry} style={styles.input} placeholder={t('Música, finanzas, bienes raíces...', 'Music, finance, real estate...')} placeholderTextColor="#9CA3AF" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{t('Instagram opcional', 'Optional Instagram')}</Text>
          <TextInput value={instagram} onChangeText={setInstagram} style={styles.input} placeholder="@username" placeholderTextColor="#9CA3AF" autoCapitalize="none" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('PRIVACIDAD', 'PRIVACY')}</Text>
        <ToggleRow title={t('Modo privado', 'Private mode')} subtitle={t('Muestra primero detalles limitados del perfil.', 'Show limited profile details first.')} value={privateMode} onPress={() => setPrivateMode((current) => !current)} />
        <ToggleRow title={t('Modo invisible', 'Invisible mode')} subtitle={t('Oculta tu perfil de sugerencias hasta activarlo.', 'Hide from suggestions until enabled.')} value={invisibleMode} onPress={() => setInvisibleMode((current) => !current)} />
        <ToggleRow title={t('Compartir Instagram', 'Share Instagram')} subtitle={t('Solo después de que ambos acepten.', 'Only after both people accept.')} value={shareInstagram} onPress={() => setShareInstagram((current) => !current)} />
        <ToggleRow title={t('Ubicación aproximada', 'Approximate location')} subtitle={t('Solo después de aceptación mutua.', 'Only after mutual acceptance.')} value={shareLocation} onPress={() => setShareLocation((current) => !current)} />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionLabel}>{t('RESUMEN', 'SUMMARY')}</Text>
        {summary.map((item) => (
          <Text key={item} style={styles.summaryText}>{item}</Text>
        ))}
      </View>

      {isActive && !invisibleMode && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('PERFILES SUGERIDOS', 'SUGGESTED PROFILES')}</Text>
          {suggestions.map((suggestion) => (
            <View key={suggestion.id} style={styles.suggestionCard}>
              <View style={styles.scoreBadge}><Text style={styles.scoreText}>{suggestion.score}%</Text></View>
              <View style={styles.suggestionCopy}>
                <Text style={styles.suggestionName}>{suggestion.name}</Text>
                <Text style={styles.suggestionMeta}>{suggestion.meta}</Text>
                <View style={styles.tagRow}>
                  {suggestion.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
                </View>
              </View>
              <TouchableOpacity style={styles.connectButton}>
                <Text style={styles.connectText}>{t('SOLICITAR', 'REQUEST')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('SOLICITUDES', 'REQUESTS')}</Text>
        {connections.map((connection) => (
          <View key={connection.id} style={styles.connectionCard}>
            <View style={styles.connectionAvatar}><Text style={styles.connectionAvatarText}>{connection.name.slice(0, 2).toUpperCase()}</Text></View>
            <View style={styles.connectionCopy}>
              <Text style={styles.connectionName}>{connection.name}</Text>
              <Text style={styles.connectionMeta}>{connection.event} - {connection.status}</Text>
            </View>
            {connection.status === 'incoming' && (
              <View style={styles.connectionActions}>
                <TouchableOpacity onPress={() => updateConnection(connection.id, 'accepted')} style={styles.acceptButton}><Text style={styles.acceptText}>{t('ACEPTAR', 'ACCEPT')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => updateConnection(connection.id, 'declined')} style={styles.rejectButton}><Text style={styles.rejectText}>NO</Text></TouchableOpacity>
              </View>
            )}
            {connection.status === 'outgoing' && (
              <TouchableOpacity onPress={() => updateConnection(connection.id, 'cancelled')} style={styles.rejectButton}><Text style={styles.rejectText}>{t('CANCELAR', 'CANCEL')}</Text></TouchableOpacity>
            )}
            {connection.status === 'accepted' && (
              <TouchableOpacity onPress={() => setActiveChatId(connection.id)} style={styles.chatButton}><Text style={styles.chatText}>CHAT</Text></TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {activeConnection && (
        <View style={styles.card}>
          <View style={styles.chatHeader}>
            <View>
              <Text style={styles.sectionLabel}>CHAT</Text>
              <Text style={styles.chatName}>{activeConnection.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setActiveChatId(null)} style={styles.closeChat}><Text style={styles.closeChatText}>{t('CERRAR', 'CLOSE')}</Text></TouchableOpacity>
          </View>

          <View style={styles.messagesBox}>
            {messages.map((message) => (
              <View key={message.id} style={[styles.messageBubble, message.mine ? styles.messageMine : styles.messageTheirs]}>
                <Text style={[styles.messageText, message.mine && styles.messageTextMine]}>{message.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.chatComposer}>
            <TextInput value={chatDraft} onChangeText={setChatDraft} style={styles.chatInput} placeholder={t('Escribe un mensaje...', 'Write a message...')} placeholderTextColor="#9CA3AF" />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}><Text style={styles.sendText}>{t('ENVIAR', 'SEND')}</Text></TouchableOpacity>
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
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.018)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: { color: '#F8FAFC', fontSize: 17, fontWeight: '900' },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.orange, fontSize: 11, letterSpacing: 2.5, fontWeight: '900', marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 6 },
  copy: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, fontWeight: '400' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 16,
    marginBottom: 14,
  },
  sectionLabel: { color: colors.orange, fontSize: 11, letterSpacing: 2.6, fontWeight: '900', marginBottom: 12 },
  eventRail: { gap: 10, paddingRight: 4 },
  eventChip: {
    width: 230,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 14,
  },
  eventChipActive: { backgroundColor: 'rgba(255,255,255,0.025)', borderColor: colors.navy },
  eventTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '900', marginBottom: 4 },
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
  activationActive: { backgroundColor: 'rgba(255,255,255,0.025)', borderColor: colors.navy },
  activationTitle: { color: 'rgba(226,232,240,0.64)', fontSize: 12, letterSpacing: 1.3, fontWeight: '900', marginBottom: 3 },
  activationTitleActive: { color: '#FFFFFF' },
  activationSub: { color: 'rgba(226,232,240,0.52)', fontSize: 12, fontWeight: '400' },
  activationSubActive: { color: '#cbd5e1' },
  switchKnob: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#cbd5e1' },
  switchKnobActive: { backgroundColor: colors.orange },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 },
  interestChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  interestChipActive: { backgroundColor: 'rgba(255,255,255,0.025)', borderColor: colors.navy },
  interestText: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '900' },
  interestTextActive: { color: '#FFFFFF' },
  inputGroup: { gap: 7, marginBottom: 12 },
  inputLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400' },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    paddingHorizontal: 15,
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
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
  toggleTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '900', marginBottom: 4 },
  toggleSub: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 17, fontWeight: '400' },
  toggleTrack: { width: 48, height: 28, borderRadius: 999, backgroundColor: '#cbd5e1', padding: 3 },
  toggleTrackActive: { backgroundColor: colors.orange },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.018)' },
  toggleDotActive: { transform: [{ translateX: 20 }] },
  summaryCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 16,
    marginBottom: 14,
  },
  summaryText: { color: '#F8FAFC', fontSize: 14, lineHeight: 22, fontWeight: '400' },
  suggestionCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  scoreBadge: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { color: colors.orange, fontSize: 14, fontWeight: '900' },
  suggestionCopy: { flex: 1 },
  suggestionName: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginBottom: 3 },
  suggestionMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '400', marginBottom: 7 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { color: '#F8FAFC', backgroundColor: '#eaf2f8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  connectButton: { backgroundColor: colors.orange, borderRadius: 13, paddingHorizontal: 10, height: 38, alignItems: 'center', justifyContent: 'center' },
  connectText: { color: '#FFFFFF', fontSize: 10, letterSpacing: 1, fontWeight: '900' },
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
  connectionAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.025)', alignItems: 'center', justifyContent: 'center' },
  connectionAvatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  connectionCopy: { flex: 1 },
  connectionName: { color: '#F8FAFC', fontSize: 15, fontWeight: '900', marginBottom: 3 },
  connectionMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 11, fontWeight: '400' },
  connectionActions: { flexDirection: 'row', gap: 6 },
  acceptButton: { backgroundColor: 'rgba(255,255,255,0.025)', height: 36, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  rejectButton: { backgroundColor: '#eaf2f8', height: 36, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#F8FAFC', fontSize: 10, fontWeight: '900' },
  chatButton: { backgroundColor: colors.orange, height: 36, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  chatText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  chatName: { color: '#F8FAFC', fontSize: 20, fontWeight: '900' },
  closeChat: { backgroundColor: '#eaf2f8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  closeChatText: { color: '#F8FAFC', fontSize: 10, fontWeight: '900' },
  messagesBox: { backgroundColor: '#030B14', borderRadius: 16, padding: 12, gap: 9, marginBottom: 12 },
  messageBubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  messageMine: { alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.025)' },
  messageTheirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.018)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  messageText: { color: '#F8FAFC', fontSize: 13, fontWeight: '400', lineHeight: 18 },
  messageTextMine: { color: '#FFFFFF' },
  chatComposer: { flexDirection: 'row', gap: 8 },
  chatInput: {
    flex: 1,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    paddingHorizontal: 14,
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  sendButton: { width: 76, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 1, fontWeight: '900' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 24, alignItems: 'center' },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.025)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyIconText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  emptyTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginBottom: 8 },
  emptyCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 21 },
});
