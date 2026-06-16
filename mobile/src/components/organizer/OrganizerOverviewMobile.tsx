import { StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../../i18n/LanguageContext';

type Props = { sections: any[] };

export function OrganizerOverviewMobile({ sections }: Props) {
  const { t, lang } = useLanguage();
  const es = lang === 'es';

  if (!sections || sections.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{es ? 'Sin secciones' : 'No sections'}</Text>
        <Text style={styles.emptyCopy}>{es ? 'No hay secciones creadas para este evento. Usa el Mapa Visual para añadirlas.' : 'No sections created for this event. Use the Venue Map to add them.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>{es ? 'RESUMEN' : 'OVERVIEW'}</Text>
        <Text style={styles.headerTitle}>{es ? 'Secciones del evento' : 'Event sections'}</Text>
        <Text style={styles.headerCopy}>{es ? 'Capacidad, distribución y precios.' : 'Capacity, layout and pricing.'}</Text>
      </View>

      {sections.map((sec) => {
        const isTable = String(sec.sectionType || '').toLowerCase() === 'table';
        const capacity = Number(sec.capacity) || Number(sec.rows || 0) * Number(sec.seatsPerRow || 0);
        return (
          <View key={String(sec.id)} style={[styles.card, { borderTopColor: sec.color || '#F97316', borderTopWidth: 4 }]}>
            <Text style={styles.secTitle}>{isTable ? `${es ? 'Mesa' : 'Table'} ${sec.name}` : sec.name}</Text>
            <View style={styles.row}><Text style={styles.k}>{es ? 'Tipo' : 'Type'}</Text><Text style={styles.v}>{String(sec.sectionType || '—')}</Text></View>
            <View style={styles.row}><Text style={styles.k}>{es ? 'Capacidad' : 'Capacity'}</Text><Text style={styles.v}>{capacity}</Text></View>
            <View style={styles.row}><Text style={styles.k}>{es ? 'Filas · Asientos/fila' : 'Rows · Seats/row'}</Text><Text style={styles.v}>{Number(sec.rows || 0)} · {Number(sec.seatsPerRow || 0)}</Text></View>
            <Text style={styles.price}>${Number(sec.price || 0).toFixed(2)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  headerCard: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  eyebrow: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  headerTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginTop: 4 },
  headerCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 13, marginTop: 4 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 16 },
  secTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  k: { color: 'rgba(203,213,225,0.7)', fontSize: 13, fontWeight: '600' },
  v: { color: '#F8FAFC', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  price: { color: '#F97316', fontSize: 18, fontWeight: '800', marginTop: 8 },
  emptyCard: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  emptyCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
