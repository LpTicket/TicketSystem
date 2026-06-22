import { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { ScreenBackground } from '../components/ScreenBackground';
import { LEGAL_DOCS, LegalKey } from '../data/legalContent';

type Props = { docKey: LegalKey; onBack: () => void };

// Mirrors the web LegalPage parser: "N. Heading" → section title, "* item" →
// bullet, everything else → paragraph.
type Block = { kind: 'heading' | 'bullet' | 'paragraph'; text: string };

function parse(content: string): Block[] {
  return content.split('\n').reduce<Block[]>((acc, raw) => {
    const line = raw.trim();
    if (!line) return acc;
    if (/^\d+\.\s/.test(line)) acc.push({ kind: 'heading', text: line });
    else if (line.startsWith('* ')) acc.push({ kind: 'bullet', text: line.substring(2) });
    else acc.push({ kind: 'paragraph', text: line });
    return acc;
  }, []);
}

export function LegalScreen({ docKey, onBack }: Props) {
  const { t, lang } = useLanguage();
  const doc = LEGAL_DOCS[docKey];
  const blocks = useMemo(() => parse(doc.content), [doc.content]);

  return (
    <View style={[styles.screenWrap, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
      <ScreenBackground />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>‹ {t('Volver', 'Back')}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{lang === 'es' ? doc.titleEs : doc.titleEn}</Text>
          <Text style={styles.updated}>{t('Última actualización', 'Last updated')}: {doc.lastUpdated}</Text>
        </View>

        <View style={styles.card}>
          {blocks.map((block, i) => {
            if (block.kind === 'heading') return <Text key={i} style={styles.heading}>{block.text}</Text>;
            if (block.kind === 'bullet') return (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{block.text}</Text>
              </View>
            );
            return <Text key={i} style={styles.paragraph}>{block.text}</Text>;
          })}
          <Text style={styles.footer}>© {new Date().getFullYear()} LPTicket LLC. {t('Todos los derechos reservados.', 'All rights reserved.')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: '#030B14' },
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 18, paddingTop: 12, paddingBottom: 120 },
  back: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  backText: { color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  header: {
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(125,211,252,0.12)',
    backgroundColor: 'rgba(3,11,20,0.78)', padding: 20, alignItems: 'center', marginBottom: 16,
  },
  title: { color: '#FFFFFF', fontSize: 24, lineHeight: 28, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  updated: { color: 'rgba(226,232,240,0.62)', fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 8, textTransform: 'uppercase' },
  card: {
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)', padding: 18,
  },
  heading: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginTop: 22, marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)' },
  paragraph: { color: 'rgba(226,232,240,0.74)', fontSize: 14, lineHeight: 21, marginBottom: 12 },
  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingLeft: 6 },
  bulletDot: { color: '#F97316', fontSize: 14, lineHeight: 21 },
  bulletText: { flex: 1, color: 'rgba(226,232,240,0.74)', fontSize: 14, lineHeight: 21 },
  footer: { color: 'rgba(148,163,184,0.6)', fontSize: 12, textAlign: 'center', marginTop: 24 },
});
