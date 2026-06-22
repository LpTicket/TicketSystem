import { useState, useRef, useEffect } from 'react';
import { Animated, Easing, StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '../components/ScreenBackground';
import { useLanguage } from '../i18n/LanguageContext';
import { apiPost } from '../services/api';
import { colors } from '../theme/colors';

type Message = { role: 'user' | 'assistant'; content: string };

const INPUT_CLOSED_BOTTOM = 60;
const INPUT_KEYBOARD_GAP = 34;
const INPUT_BAR_HEIGHT = 60;
const BOTTOM_NAV_CLEARANCE = INPUT_CLOSED_BOTTOM;
const KEYBOARD_CORNER_FILL = 64;

export function AiChatScreen() {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const inputBottom = useRef(new Animated.Value(INPUT_CLOSED_BOTTOM)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: es
            ? '¡Hola! Soy el asistente virtual de LPTicket. ¿En qué puedo ayudarte hoy?'
            : 'Hi! I am the LPTicket virtual assistant. How can I help you today?',
        },
      ]);
    }
  }, [lang, messages.length]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const moveComposer = (toValue: number, duration?: number) => {
      Animated.timing(inputBottom, {
        toValue,
        duration: duration ?? 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    };
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const nextHeight = Math.max(0, event.endCoordinates?.height || 0);
      moveComposer(Math.max(0, nextHeight - INPUT_KEYBOARD_GAP), event.duration);
      setKeyboardOpen(nextHeight > 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      moveComposer(INPUT_CLOSED_BOTTOM, event.duration);
      setKeyboardOpen(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [inputBottom]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const data = await apiPost<{ content: string }>('/ai-support/chat', {
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
      });
      setMessages([...newMessages, { role: 'assistant', content: data.content }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: es
            ? 'Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentar de nuevo?'
            : 'Sorry, I had trouble processing your message. Could you try again?',
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
      <View style={[styles.screenWrap, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
        <ScreenBackground />
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="chatbubbles" size={20} color={colors.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>LPTicket AI Support</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>ONLINE</Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={[
            styles.chatContent,
            {
              paddingBottom: keyboardOpen
                ? INPUT_BAR_HEIGHT + INPUT_KEYBOARD_GAP + 8
                : INPUT_BAR_HEIGHT + BOTTOM_NAV_CLEARANCE + 10,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((m, i) => (
            <View key={i} style={[styles.messageRow, m.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant]}>
              {m.role === 'assistant' && (
                <View style={styles.avatarAssistant}>
                  <Ionicons name="sparkles" size={14} color={colors.orange} />
                </View>
              )}
              
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                <Text style={[styles.messageText, m.role === 'user' ? styles.messageTextUser : styles.messageTextAssistant]}>
                  {m.content}
                </Text>
              </View>

              {m.role === 'user' && (
                <View style={styles.avatarUser}>
                  <Ionicons name="person" size={14} color={colors.orange} />
                </View>
              )}
            </View>
          ))}
          {isLoading && (
            <View style={[styles.messageRow, styles.messageRowAssistant]}>
              <View style={styles.avatarAssistant}>
                <Ionicons name="sparkles" size={14} color={colors.orange} />
              </View>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.loadingBubble]}>
                <Text style={styles.loadingText}>...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <Animated.View style={[
          styles.inputArea,
          { bottom: inputBottom },
        ]}>
          {keyboardOpen && <View pointerEvents="none" style={styles.keyboardCornerFill} />}
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={es ? 'Escribe tu pregunta...' : 'Type your question...'}
            placeholderTextColor="rgba(255,255,255,0.4)"
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isLoading}
          />
          <TouchableOpacity 
            style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]} 
            onPress={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Ionicons name="send" size={16} color={colors.white} />
          </TouchableOpacity>
        </Animated.View>
      </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(249,115,22,0.2)',
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  
  chatArea: { flex: 1 },
  chatContent: { padding: 16 },
  
  messageRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowAssistant: { justifyContent: 'flex-start' },
  
  avatarAssistant: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatarUser: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.15)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  
  bubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleAssistant: { backgroundColor: 'rgba(255,255,255,0.05)', borderTopLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  bubbleUser: { backgroundColor: colors.orange, borderTopRightRadius: 4 },
  
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextAssistant: { color: colors.white },
  messageTextUser: { color: colors.white },
  
  loadingBubble: { paddingVertical: 8, paddingHorizontal: 16 },
  loadingText: { color: 'rgba(255,255,255,0.6)', fontSize: 20, lineHeight: 20, marginTop: -8 },

  inputArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: INPUT_BAR_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: 'rgba(17,18,20,0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  keyboardCornerFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -KEYBOARD_CORNER_FILL,
    height: KEYBOARD_CORNER_FILL + 2,
    backgroundColor: 'rgba(17,18,20,0.98)',
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#2C2C2E',
    borderWidth: 0,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: colors.white,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: { opacity: 0.45 },
});
