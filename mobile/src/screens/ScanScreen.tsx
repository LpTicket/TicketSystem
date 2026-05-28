import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  onBack: () => void;
};

export function ScanScreen({ onBack }: Props) {
  return (
    <View style={styles.screen}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>LPTICKET SCAN</Text>
      <Text style={styles.title}>Verify tickets at the door</Text>
      <Text style={styles.subtitle}>
        Camera scanning will validate QR codes and show ticket status in real time.
      </Text>

      <View style={styles.scanner}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
        <View style={styles.qrMock}>
          <Text style={styles.qrText}>QR</Text>
        </View>
        <View style={styles.scanLine} />
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>READY</Text>
        <Text style={styles.resultTitle}>Point camera at ticket QR</Text>
        <Text style={styles.resultText}>Valid, used, refunded or invalid tickets will appear here.</Text>
      </View>

      <TouchableOpacity style={styles.manualButton}>
        <Text style={styles.manualText}>ENTER CODE MANUALLY</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy, padding: 18, paddingBottom: 120 },
  backButton: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  backText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 4, fontWeight: '800', marginTop: 28 },
  title: { color: colors.white, fontSize: 32, lineHeight: 36, fontWeight: '800', marginTop: 12 },
  subtitle: { color: 'rgba(255,255,255,0.68)', fontSize: 15, lineHeight: 23, fontWeight: '600', marginTop: 10 },
  scanner: { marginTop: 28, height: 310, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  corner: { position: 'absolute', width: 54, height: 54, borderColor: colors.orange },
  topLeft: { left: 28, top: 28, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 12 },
  topRight: { right: 28, top: 28, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { left: 28, bottom: 28, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { right: 28, bottom: 28, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 12 },
  qrMock: { width: 128, height: 128, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  qrText: { color: colors.navy, fontSize: 34, fontWeight: '800', letterSpacing: 4 },
  scanLine: { position: 'absolute', left: 40, right: 40, height: 2, backgroundColor: colors.orange, shadowColor: colors.orange, shadowOpacity: 0.8, shadowRadius: 12 },
  resultCard: { marginTop: 20, backgroundColor: colors.white, borderRadius: 22, padding: 18 },
  resultLabel: { color: colors.orange, fontSize: 11, fontWeight: '800', letterSpacing: 2.4, marginBottom: 8 },
  resultTitle: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  resultText: { color: colors.muted, fontSize: 14, fontWeight: '600', lineHeight: 22, marginTop: 8 },
  manualButton: { marginTop: 16, height: 54, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  manualText: { color: colors.white, fontSize: 13, fontWeight: '800', letterSpacing: 2.4 },
});
