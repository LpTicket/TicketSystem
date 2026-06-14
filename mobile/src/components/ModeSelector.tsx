import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';

export type AppMode = 'client' | 'organizer' | 'admin';

type IconName = keyof typeof Ionicons.glyphMap;

// Segmented mode selector: Client / Organizer (+ Admin when allowed).
export function ModeSelector({
  mode,
  canAdmin,
  onChange,
}: {
  mode: AppMode;
  canAdmin?: boolean;
  onChange: (mode: AppMode) => void;
}) {
  const { t } = useLanguage();

  const options: { key: AppMode; label: string; icon: IconName }[] = [
    { key: 'client', label: t('Cliente', 'Client'), icon: 'person-outline' },
    { key: 'organizer', label: t('Organizador', 'Organizer'), icon: 'briefcase-outline' },
    ...(canAdmin ? [{ key: 'admin' as AppMode, label: 'Admin', icon: 'shield-outline' as IconName }] : []),
  ];

  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const activeOpt = mode === o.key;
        return (
          <TouchableOpacity key={o.key} style={[styles.seg, activeOpt && styles.segActive]} onPress={() => onChange(o.key)}>
            <Ionicons name={o.icon} size={15} color={activeOpt ? '#FFFFFF' : 'rgba(255,255,255,0.62)'} />
            <Text style={[styles.segText, activeOpt && styles.segTextActive]} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  seg: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
  },
  segActive: { backgroundColor: '#F97316' },
  segText: { color: 'rgba(255,255,255,0.62)', fontSize: 13, fontWeight: '800' },
  segTextActive: { color: '#FFFFFF' },
});
