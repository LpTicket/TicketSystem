import { useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SocialMatchMobile } from '../components/profile/SocialMatchMobile';
import { useLanguage } from '../i18n/LanguageContext';

type Tab = 'social' | 'messages';

export function SocialScreen() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('social');
  const pillX = useRef(new Animated.Value(0)).current;
  const pillW = useRef(new Animated.Value(0)).current;
  const [tabLayouts, setTabLayouts] = useState<Record<Tab, { x: number; width: number }>>({
    social: { x: 0, width: 0 },
    messages: { x: 0, width: 0 },
  });

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    const layout = tabLayouts[tab];
    Animated.parallel([
      Animated.spring(pillX, { toValue: layout.x, useNativeDriver: false, damping: 22, stiffness: 300, mass: 0.6 }),
      Animated.spring(pillW, { toValue: layout.width, useNativeDriver: false, damping: 22, stiffness: 300, mass: 0.6 }),
    ]).start();
  };

  const onTabLayout = (tab: Tab, x: number, width: number) => {
    setTabLayouts((prev) => {
      const next = { ...prev, [tab]: { x, width } };
      if (tab === activeTab) {
        pillX.setValue(x);
        pillW.setValue(width);
      }
      return next;
    });
  };

  const TABS: { id: Tab; labelEs: string; labelEn: string }[] = [
    { id: 'social', labelEs: 'Social Match', labelEn: 'Social Match' },
    { id: 'messages', labelEs: 'Mensajes', labelEn: 'Messages' },
  ];

  return (
    <View style={styles.root}>
      {/* Tab bar */}
      <View style={styles.tabsShell}>
        <View style={styles.tabsTrack}>
          <Animated.View style={[styles.tabPill, { left: pillX, width: pillW }]}>
            <LinearGradient
              colors={['#ff8a18', '#f46c00', '#c93f00']}
              locations={[0, 0.46, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.tabPillShine}>
              <LinearGradient
                colors={['rgba(255,235,205,0)', 'rgba(255,235,205,0.85)', 'rgba(255,235,205,0)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </Animated.View>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.75}
              style={styles.tabBtn}
              onLayout={(e) => onTabLayout(tab.id, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
              onPress={() => switchTab(tab.id)}
            >
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                {t(tab.labelEs, tab.labelEn)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Social match</Text>
          <Text style={styles.title}>
            {activeTab === 'social'
              ? t('Conexiones del evento', 'Event connections')
              : t('Mensajes', 'Messages')}
          </Text>
          <Text style={styles.subtitle}>
            {activeTab === 'social'
              ? t('Encuentra asistentes compatibles, solicitudes y chats de tus eventos.', 'Find compatible attendees, requests and chats from your events.')
              : t('Tus solicitudes y conversaciones con otros asistentes.', 'Your requests and conversations with other attendees.')}
          </Text>
        </View>

        <SocialMatchMobile tab={activeTab} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  tabsShell: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabsTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 4,
    position: 'relative',
  },
  tabPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,151,45,0.62)',
    shadowColor: '#F97316',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  tabPillShine: { position: 'absolute', left: 12, right: 12, top: 5, height: 1 },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    zIndex: 1,
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 132 },
  header: {
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 18,
  },
  eyebrow: {
    color: '#F97316',
    fontSize: 12,
    letterSpacing: 0,
    fontWeight: '600',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(226,232,240,0.66)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
    marginTop: 8,
  },
});
