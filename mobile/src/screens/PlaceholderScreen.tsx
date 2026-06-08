import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  title: string;
  subtitle: string;
};

export function PlaceholderScreen({ title, subtitle }: Props) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  title: { color: colors.navy, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: colors.muted, fontSize: 15, fontWeight: '400', textAlign: 'center', lineHeight: 22 },
});
