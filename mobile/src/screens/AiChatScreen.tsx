import { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenBackground } from '../components/ScreenBackground';
import { useLanguage } from '../i18n/LanguageContext';
import { apiPost } from '../services/api';
import { colors } from '../theme/colors';

type Message = { role: 'user' | 'assistant'; content: string };

export function AiChatScreen() {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
    <KeyboardAvoidingView 
      style={styles.keyboardAvoid} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
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
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
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
        <View style={styles.inputArea}>
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
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: { flex: 1 },
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
  headerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 4 },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 100 },
  
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
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
    backgroundColor: 'rgba(3,11,20,0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    paddingHorizontal: 20,
    color: colors.white,
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: { opacity: 0.5, backgroundColor: 'rgba(255,255,255,0.1)' },
});
