import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { mockEvents } from '../data/mockEvents';

type Section = 'dashboard' | 'events' | 'users' | 'categories' | 'marketing' | 'analytics' | 'codes' | 'payments';
type AdminUser = { id: string; name: string; email: string; role: 'client' | 'organizer' | 'admin'; suspended: boolean };
type Category = { id: string; name: string; active: boolean; featured: boolean };

const sections: { id: Section; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'events', label: 'Eventos' },
  { id: 'users', label: 'Usuarios' },
  { id: 'categories', label: 'Categorias' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'analytics', label: 'Analiticas' },
  { id: 'codes', label: 'Codigos' },
  { id: 'payments', label: 'Pagos' },
];

export function AdminPanelScreen() {
  const [active, setActive] = useState<Section>('dashboard');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [marketingBannerEnabled, setMarketingBannerEnabled] = useState(true);
  const [marketingFeaturedEnabled, setMarketingFeaturedEnabled] = useState(true);
  const [marketingPromoEnabled, setMarketingPromoEnabled] = useState(false);
  const [specialCodeDraft, setSpecialCodeDraft] = useState('LPVIP');
  const [specialCodes, setSpecialCodes] = useState([
    { id: '1', code: 'LPVIP', owner: 'Fidel Genre', commission: 10, active: true, generated: 420 },
    { id: '2', code: 'AMBRIZA21', owner: 'Sundin Galue', commission: 15, active: true, generated: 860 },
    { id: '3', code: 'PRIVATE5', owner: 'Maria Lopez', commission: 5, active: false, generated: 120 },
  ]);

  const [users, setUsers] = useState<AdminUser[]>([
    { id: '1', name: 'Sundin Galue', email: 'sundin@example.com', role: 'admin', suspended: false },
    { id: '2', name: 'Fidel Genre', email: 'fidel@example.com', role: 'organizer', suspended: false },
    { id: '3', name: 'Maria Lopez', email: 'maria@example.com', role: 'client', suspended: false },
  ]);

  const [categories, setCategories] = useState<Category[]>([
    { id: '1', name: 'Concert', active: true, featured: true },
    { id: '2', name: 'Private Event', active: true, featured: true },
    { id: '3', name: 'Theater', active: true, featured: false },
    { id: '4', name: 'Workshop', active: false, featured: false },
  ]);

  const event = mockEvents[0];

  const updateUser = (id: string, key: keyof AdminUser, value: string | boolean) => {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, [key]: value } : user));
  };

  const updateCategory = (id: string, key: keyof Category, value: string | boolean) => {
    setCategories((current) => current.map((category) => category.id === id ? { ...category, [key]: value } : category));
  };

  const addSpecialCode = () => {
    const code = specialCodeDraft.trim().toUpperCase();
    if (!code) return;
    setSpecialCodes((current) => [...current, { id: String(Date.now()), code, owner: 'Nuevo creador', commission: 10, active: true, generated: 0 }]);
    setSpecialCodeDraft('');
  };

  const toggleSpecialCode = (id: string) => {
    setSpecialCodes((current) => current.map((item) => item.id === id ? { ...item, active: !item.active } : item));
  };

  const addCategory = () => {
    const name = categoryDraft.trim();
    if (!name) return;
    setCategories((current) => [...current, { id: String(Date.now()), name, active: true, featured: false }]);
    setCategoryDraft('');
  };

  return (
    <View style={styles.root}>
      <View style={styles.tabsShell}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroller} contentContainerStyle={styles.tabs}>
          {sections.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => { setActive(item.id as any); setEditingUserId?.(null); setEditingCategoryId?.(null); }} style={[styles.tab, active === item.id && styles.tabActive]}>
              <Text style={[styles.tabText, active === item.id && styles.tabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ADMIN</Text>
        <Text style={styles.title}>{titleFor(active)}</Text>
        <Text style={styles.subtitle}>{subtitleFor(active)}</Text>

        {active === 'dashboard' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label="Ventas plataforma" value="$4,860" />
              <Metric label="Eventos activos" value="12" />
              <Metric label="Usuarios" value="438" />
              <Metric label="Pendiente pagos" value="$920" />
            </View>

            <PanelCard title="Actividad reciente">
              <Activity title="Nuevo evento publicado" copy={event.title} />
              <Activity title="Pago pendiente" copy="Organizador · $320.00" />
              <Activity title="Nuevo usuario" copy="Cliente registrado hace 12 min" />
            </PanelCard>
          </>
        )}

        {active === 'events' && (
          <PanelCard title="Eventos publicados">
            <Text style={styles.eventName}>{event.title}</Text>
            <Text style={styles.copy}>{event.date} · {event.venue}</Text>
            <View style={styles.statusRow}>
              <StatusPill label="PUBLICADO" tone="green" />
              <StatusPill label="FEATURED" tone="orange" />
            </View>
            <View style={styles.actionGrid}>
              <ActionButton label="Ver evento" />
              <ActionButton label="Editar" />
              <ActionButton label="Destacar" />
              <ActionButton label="Ocultar" muted />
            </View>
          </PanelCard>
        )}

        {active === 'users' && (
          editingUserId ? (
            users.filter((user) => user.id === editingUserId).map((user) => (
              <PanelCard key={user.id} title="Editar usuario" eyebrow="USER SETTINGS" copy="Gestiona la informacion, permisos y estado de la cuenta.">
                <FieldLabel label="Nombre completo" />
                <TextInput value={user.name} onChangeText={(value) => updateUser(user.id, 'name', value)} style={styles.input} />

                <FieldLabel label="Email" />
                <TextInput value={user.email} onChangeText={(value) => updateUser(user.id, 'email', value)} autoCapitalize="none" keyboardType="email-address" style={styles.input} />

                <FieldLabel label="Rol" />
                <View style={styles.segmentGroup}>
                  {(['client', 'organizer', 'admin'] as const).map((role) => (
                    <TouchableOpacity key={role} onPress={() => updateUser(user.id, 'role', role)} style={[styles.segment, user.role === role && styles.segmentActive]}>
                      <Text style={[styles.segmentText, user.role === role && styles.segmentTextActive]}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FieldLabel label="Estado" />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateUser(user.id, 'suspended', false)} style={[styles.segment, !user.suspended && styles.segmentActiveOrange]}>
                    <Text style={[styles.segmentText, !user.suspended && styles.segmentTextActive]}>Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateUser(user.id, 'suspended', true)} style={[styles.segment, user.suspended && styles.segmentDanger]}>
                    <Text style={[styles.segmentText, user.suspended && styles.segmentTextActive]}>Suspended</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => setEditingUserId(null)} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>SAVE USER</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingUserId(null)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              </PanelCard>
            ))
          ) : (
            <>
              <PanelCard title="Usuarios" eyebrow="USER MANAGER" copy="Clientes, organizadores y administradores de la plataforma." />
              {users.map((user) => (
                <View key={user.id} style={styles.userCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials(user.name)}</Text>
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.cardTitle}>{user.name}</Text>
                      <Text style={styles.cardSub}>{user.email}</Text>
                    </View>
                  </View>

                  <View style={styles.statusRow}>
                    <StatusPill label={user.suspended ? 'SUSPENDED' : 'ACTIVE'} tone={user.suspended ? 'red' : 'green'} />
                    <StatusPill label={user.role.toUpperCase()} tone={user.role === 'admin' ? 'dark' : user.role === 'organizer' ? 'orange' : 'gray'} />
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => setEditingUserId(user.id)} style={styles.cardPrimaryAction}>
                      <Text style={styles.cardPrimaryText}>EDIT USER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => updateUser(user.id, 'suspended', !user.suspended)} style={styles.cardSecondaryAction}>
                      <Text style={styles.cardSecondaryText}>{user.suspended ? 'ENABLE' : 'SUSPEND'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )
        )}

        {active === 'categories' && (
          editingCategoryId ? (
            categories.filter((category) => category.id === editingCategoryId).map((category) => (
              <PanelCard key={category.id} title="Editar categoria" eyebrow="CATEGORY SETTINGS" copy="Ajusta visibilidad, nombre y posicionamiento en el home.">
                <FieldLabel label="Nombre de categoria" />
                <TextInput value={category.name} onChangeText={(value) => updateCategory(category.id, 'name', value)} style={styles.input} />

                <FieldLabel label="Visibilidad" />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'active', true)} style={[styles.segment, category.active && styles.segmentActive]}>
                    <Text style={[styles.segmentText, category.active && styles.segmentTextActive]}>Active</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'active', false)} style={[styles.segment, !category.active && styles.segmentDanger]}>
                    <Text style={[styles.segmentText, !category.active && styles.segmentTextActive]}>Inactive</Text>
                  </TouchableOpacity>
                </View>

                <FieldLabel label="Home placement" />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'featured', true)} style={[styles.segment, category.featured && styles.segmentActiveOrange]}>
                    <Text style={[styles.segmentText, category.featured && styles.segmentTextActive]}>Featured</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'featured', false)} style={[styles.segment, !category.featured && styles.segmentActive]}>
                    <Text style={[styles.segmentText, !category.featured && styles.segmentTextActive]}>Standard</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => setEditingCategoryId(null)} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>SAVE CATEGORY</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingCategoryId(null)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              </PanelCard>
            ))
          ) : (
            <>
              <PanelCard title="Categorias" eyebrow="CATEGORY MANAGER" copy="Crea y organiza categorias para filtros, busqueda y eventos destacados.">
                <View style={styles.createRow}>
                  <TextInput value={categoryDraft} onChangeText={setCategoryDraft} placeholder="Nueva categoria" placeholderTextColor="#94a3b8" style={styles.createInput} />
                  <TouchableOpacity onPress={addCategory} style={styles.createButton}>
                    <Text style={styles.createButtonText}>ADD</Text>
                  </TouchableOpacity>
                </View>
              </PanelCard>

              {categories.map((category) => (
                <View key={category.id} style={styles.userCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{category.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.cardTitle}>{category.name}</Text>
                      <Text style={styles.cardSub}>Filtros, discovery y home.</Text>
                    </View>
                  </View>

                  <View style={styles.statusRow}>
                    <StatusPill label={category.active ? 'ACTIVE' : 'INACTIVE'} tone={category.active ? 'green' : 'red'} />
                    <StatusPill label={category.featured ? 'FEATURED' : 'STANDARD'} tone={category.featured ? 'orange' : 'gray'} />
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => setEditingCategoryId(category.id)} style={styles.cardPrimaryAction}>
                      <Text style={styles.cardPrimaryText}>EDIT CATEGORY</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => updateCategory(category.id, 'active', !category.active)} style={styles.cardSecondaryAction}>
                      <Text style={styles.cardSecondaryText}>{category.active ? 'DISABLE' : 'ENABLE'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )
        )}

        {active === 'marketing' && (
          <>
            <PanelCard title="Marketing" eyebrow="MARKETING CONTROL" copy="Administra lo que aparece en el home, banners, destacados y promociones.">
              <View style={styles.bannerPreviewCard}>
                <View style={styles.bannerPreviewPill}>
                  <Text style={styles.bannerPreviewPillText}>HOME BANNER</Text>
                </View>
                <Text style={styles.bannerPreviewTitle}>Tu entrada a grandes experiencias</Text>
                <Text style={styles.bannerPreviewCopy}>Conciertos, teatro, talleres, networking y eventos privados.</Text>
              </View>
            </PanelCard>

            <MarketingRow
              title="Banner principal"
              copy="Imagen principal del home y carrusel superior."
              enabled={marketingBannerEnabled}
              onToggle={() => setMarketingBannerEnabled(!marketingBannerEnabled)}
            />

            <MarketingRow
              title="Eventos destacados"
              copy="Controla los eventos que aparecen como featured."
              enabled={marketingFeaturedEnabled}
              onToggle={() => setMarketingFeaturedEnabled(!marketingFeaturedEnabled)}
            />

            <MarketingRow
              title="Promociones"
              copy="Activa mensajes comerciales, descuentos o campañas."
              enabled={marketingPromoEnabled}
              onToggle={() => setMarketingPromoEnabled(!marketingPromoEnabled)}
            />

            <PanelCard title="Orden de aparicion" eyebrow="DISPLAY ORDER" copy="Define el orden visual del home movil.">
              <OrderItem index="01" title="Banner principal" />
              <OrderItem index="02" title="Buscador" />
              <OrderItem index="03" title="Beneficios / seguridad" />
              <OrderItem index="04" title="Eventos destacados" />
            </PanelCard>
          </>
        )}
        {active === 'analytics' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label="Conversion" value="8.4%" />
              <Metric label="Visitas" value="18.2k" />
              <Metric label="Checkouts" value="412" />
              <Metric label="Ingresos" value="$4.8k" />
            </View>

            <PanelCard title="Rendimiento global" eyebrow="ANALYTICS">
              <AnalyticsBar label="Eventos vistos" value="82%" />
              <AnalyticsBar label="Checkout iniciado" value="48%" />
              <AnalyticsBar label="Compra completada" value="31%" />
            </PanelCard>

            <PanelCard title="Eventos mas vistos" eyebrow="TOP EVENTS" copy="Eventos con mayor actividad en la plataforma.">
              <RankItem index="01" title="Noche de (des)amor" value="2.4k views" />
              <RankItem index="02" title="Sunset Lounge Experience" value="1.8k views" />
              <RankItem index="03" title="Private Networking Night" value="920 views" />
            </PanelCard>

            <PanelCard title="Metodos de pago" eyebrow="PAYMENTS MIX">
              <PaymentMix label="Card / Stripe" value="86%" />
              <PaymentMix label="Apple Pay" value="9%" />
              <PaymentMix label="Google Pay" value="5%" />
            </PanelCard>
          </>
        )}
        {active === 'codes' && (
          <>
            <PanelCard title="Codigos especiales" eyebrow="SPECIAL CODES" copy="Crea codigos, asigna comisiones y monitorea ventas generadas.">
              <View style={styles.createRow}>
                <TextInput value={specialCodeDraft} onChangeText={setSpecialCodeDraft} placeholder="Codigo" placeholderTextColor="#94a3b8" autoCapitalize="characters" style={styles.createInput} />
                <TouchableOpacity onPress={addSpecialCode} style={styles.createButton}>
                  <Text style={styles.createButtonText}>ADD</Text>
                </TouchableOpacity>
              </View>
            </PanelCard>

            <View style={styles.metricsGrid}>
              <Metric label="Generado" value="$1.4k" />
              <Metric label="Comisiones" value="$184" />
              <Metric label="Codigos" value={String(specialCodes.length)} />
              <Metric label="Activos" value={String(specialCodes.filter((code) => code.active).length)} />
            </View>

            {specialCodes.map((item) => (
              <View key={item.id} style={styles.userCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, item.active ? styles.avatarOrange : styles.avatarMuted]}>
                    <Text style={styles.avatarText}>{item.code.slice(0, 2)}</Text>
                  </View>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardTitle}>{item.code}</Text>
                    <Text style={styles.cardSub}>{item.owner} · {item.commission}% commission</Text>
                  </View>
                </View>

                <View style={styles.statusRow}>
                  <StatusPill label={item.active ? 'ACTIVE' : 'INACTIVE'} tone={item.active ? 'green' : 'gray'} />
                  <StatusPill label={`$${item.generated}`} tone="orange" />
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.cardPrimaryAction}>
                    <Text style={styles.cardPrimaryText}>VIEW SALES</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleSpecialCode(item.id)} style={styles.cardSecondaryAction}>
                    <Text style={styles.cardSecondaryText}>{item.active ? 'DISABLE' : 'ENABLE'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
        {active === 'payments' && <Placeholder title="Pagos" items={['Pagos por evento', 'Saldo organizador', 'Comision plataforma', 'Registrar pago manual', 'Exportar reporte']} />}
      </ScrollView>
    </View>
  );
}

function PanelCard({ title, eyebrow, copy, children }: { title: string; eyebrow?: string; copy?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.panelCard}>
      {eyebrow && <Text style={styles.formEyebrow}>{eyebrow}</Text>}
      <Text style={styles.panelTitle}>{title}</Text>
      {copy && <Text style={styles.copy}>{copy}</Text>}
      {children}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Activity({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.activity}>
      <View style={styles.activityDot} />
      <View style={styles.activityCopy}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.copy}>{copy}</Text>
      </View>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'red' | 'orange' | 'gray' | 'dark' }) {
  const styleMap = {
    green: [styles.statusPill, styles.statusGreen],
    red: [styles.statusPill, styles.statusRed],
    orange: [styles.statusPill, styles.statusOrange],
    gray: [styles.statusPill, styles.statusGray],
    dark: [styles.statusPill, styles.statusDark],
  };

  const textMap = {
    green: [styles.statusText, styles.statusTextGreen],
    red: [styles.statusText, styles.statusTextRed],
    orange: [styles.statusText, styles.statusTextOrange],
    gray: [styles.statusText, styles.statusTextGray],
    dark: [styles.statusText, styles.statusTextDark],
  };

  return (
    <View style={styleMap[tone]}>
      <Text style={textMap[tone]}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <TouchableOpacity style={[styles.actionButton, muted && styles.actionButtonMuted]}>
      <Text style={[styles.actionButtonText, muted && styles.actionButtonTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MarketingRow({ title, copy, enabled, onToggle }: { title: string; copy: string; enabled: boolean; onToggle: () => void }) {
  return (
    <View style={styles.marketingCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, enabled ? styles.avatarOrange : styles.avatarMuted]}>
          <Text style={styles.avatarText}>{enabled ? 'ON' : 'OFF'}</Text>
        </View>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSub}>{copy}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <StatusPill label={enabled ? 'ACTIVE' : 'INACTIVE'} tone={enabled ? 'green' : 'gray'} />
      </View>

      <TouchableOpacity onPress={onToggle} style={enabled ? styles.marketingDisableButton : styles.marketingEnableButton}>
        <Text style={enabled ? styles.marketingDisableText : styles.marketingEnableText}>{enabled ? 'DISABLE' : 'ENABLE'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function OrderItem({ index, title }: { index: string; title: string }) {
  return (
    <View style={styles.orderPremiumItem}>
      <View style={styles.orderPremiumIndex}>
        <Text style={styles.orderPremiumIndexText}>{index}</Text>
      </View>
      <View style={styles.orderPremiumCopy}>
        <Text style={styles.orderPremiumTitle}>{title}</Text>
        <Text style={styles.orderPremiumSub}>Visible en el home movil</Text>
      </View>
    </View>
  );
}

function AnalyticsBar({ label, value }: { label: string; value: string }) {
  const widthMap: Record<string, `${number}%`> = { '82%': '82%', '48%': '48%', '31%': '31%' };
  return (
    <View style={styles.analyticsRow}>
      <View style={styles.analyticsTop}>
        <Text style={styles.analyticsLabel}>{label}</Text>
        <Text style={styles.analyticsValue}>{value}</Text>
      </View>
      <View style={styles.analyticsTrack}>
        <View style={[styles.analyticsFill, { width: widthMap[value] || '50%' as `${number}%` }]} />
      </View>
    </View>
  );
}

function RankItem({ index, title, value }: { index: string; title: string; value: string }) {
  return (
    <View style={styles.rankItem}>
      <View style={styles.rankIndex}>
        <Text style={styles.rankIndexText}>{index}</Text>
      </View>
      <View style={styles.rankCopy}>
        <Text style={styles.rankTitle}>{title}</Text>
        <Text style={styles.rankValue}>{value}</Text>
      </View>
    </View>
  );
}

function PaymentMix({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.paymentMixRow}>
      <Text style={styles.paymentMixLabel}>{label}</Text>
      <Text style={styles.paymentMixValue}>{value}</Text>
    </View>
  );
}

function Placeholder({ title, items }: { title: string; items: string[] }) {
  return (
    <PanelCard title={title}>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <View style={styles.dot} />
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </PanelCard>
  );
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function titleFor(section: Section) {
  const names: Record<Section, string> = {
    dashboard: 'Panel administrador',
    events: 'Eventos',
    users: 'Usuarios',
    categories: 'Categorias',
    marketing: 'Marketing',
    analytics: 'Analiticas',
    codes: 'Codigos especiales',
    payments: 'Pagos',
  };
  return names[section];
}

function subtitleFor(section: Section) {
  const copy: Record<Section, string> = {
    dashboard: 'Control global de ventas, eventos, usuarios y pagos.',
    events: 'Administracion de todos los eventos publicados.',
    users: 'Clientes, organizadores y administradores.',
    categories: 'Categorias, filtros y visibilidad.',
    marketing: 'Banners, destacados y promociones.',
    analytics: 'Metricas globales y rendimiento.',
    codes: 'Codigos, comisiones y balances.',
    payments: 'Pagos manuales, saldos y reportes.',
  };
  return copy[section];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f7fa' },
  tabs: { height: 86, paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab: { height: 40, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center' },
  tabActive: { backgroundColor: '#111827', borderColor: '#111827' },
  tabText: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#ffffff' },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 140 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 4, fontWeight: '900', marginBottom: 8 },
  title: { color: colors.navy, fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#64748b', fontSize: 16, lineHeight: 23, fontWeight: '600', marginBottom: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 24, fontWeight: '900', marginBottom: 4 },
  metricLabel: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  panelCard: { backgroundColor: '#ffffff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 16, shadowColor: '#0f172a', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  formEyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  panelTitle: { color: colors.navy, fontSize: 26, fontWeight: '900', marginBottom: 8 },
  eventName: { color: colors.navy, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  copy: { color: '#64748b', fontSize: 15, lineHeight: 22, fontWeight: '600', marginBottom: 14 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusPill: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  statusGreen: { backgroundColor: '#dcfce7' },
  statusRed: { backgroundColor: '#fee2e2' },
  statusOrange: { backgroundColor: '#ffedd5' },
  statusGray: { backgroundColor: '#eef2f7' },
  statusDark: { backgroundColor: '#111827' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusTextGreen: { color: '#15803d' },
  statusTextRed: { color: '#991b1b' },
  statusTextOrange: { color: colors.orange },
  statusTextGray: { color: '#64748b' },
  statusTextDark: { color: '#ffffff' },
  userCard: { backgroundColor: '#ffffff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  cardMain: { flex: 1 },
  cardTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  cardSub: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  cardPrimaryAction: { flex: 1, height: 50, borderRadius: 15, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  cardPrimaryText: { color: '#ffffff', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  cardSecondaryAction: { width: 104, height: 50, borderRadius: 15, backgroundColor: '#eef4f8', alignItems: 'center', justifyContent: 'center' },
  cardSecondaryText: { color: colors.navy, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  actionButton: { height: 44, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionButtonMuted: { backgroundColor: '#eef4f8' },
  actionButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  actionButtonTextMuted: { color: colors.navy },
  fieldLabel: { color: '#64748b', fontSize: 13, fontWeight: '900', marginBottom: 8 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: '#dbe3ec', backgroundColor: '#fbfdff', paddingHorizontal: 16, color: colors.navy, fontSize: 16, fontWeight: '800', marginBottom: 16 },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentActiveOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  segmentDanger: { backgroundColor: '#991b1b', borderColor: '#991b1b' },
  segmentText: { color: '#64748b', fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: '#ffffff' },
  formActions: { marginTop: 4, gap: 10 },
  primaryButton: { height: 56, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 13, letterSpacing: 1.8, fontWeight: '900' },
  secondaryButton: { height: 54, borderRadius: 16, backgroundColor: '#eef4f8', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.navy, fontSize: 13, letterSpacing: 1.4, fontWeight: '900' },
  createRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  createInput: { flex: 1, height: 56, borderRadius: 17, borderWidth: 1, borderColor: '#dbe3ec', backgroundColor: '#fbfdff', paddingHorizontal: 16, color: colors.navy, fontSize: 15, fontWeight: '700' },
  createButton: { width: 78, height: 56, borderRadius: 17, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '900', letterSpacing: 1.3 },
  activity: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#eef2f7' },
  activityDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.orange, marginTop: 5 },
  activityCopy: { flex: 1 },
  activityTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#eef2f7' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  listText: { color: colors.navy, fontSize: 15, fontWeight: '700' },
tabsShell: { height: 86, backgroundColor: '#f5f7fa', justifyContent: 'center', overflow: 'hidden' },
  tabsScroller: { height: 86, flexGrow: 0, flexShrink: 0, backgroundColor: '#f5f7fa' },

  bannerPreviewCard: { backgroundColor: colors.navy, borderRadius: 22, padding: 20, marginTop: 4 },
  bannerPreviewPill: { alignSelf: 'flex-start', backgroundColor: '#ffffff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16 },
  bannerPreviewPillText: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  bannerPreviewTitle: { color: '#ffffff', fontSize: 23, fontWeight: '900', lineHeight: 29, marginBottom: 8 },
  bannerPreviewCopy: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  avatarOrange: { backgroundColor: colors.orange },
  avatarMuted: { backgroundColor: '#94a3b8' },
  marketingCard: { backgroundColor: '#ffffff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, marginBottom: 14, shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  marketingEnableButton: { height: 50, borderRadius: 15, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  marketingEnableText: { color: '#ffffff', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  marketingDisableButton: { height: 50, borderRadius: 15, backgroundColor: '#eef4f8', alignItems: 'center', justifyContent: 'center' },
  marketingDisableText: { color: colors.navy, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  orderPremiumItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#f8fafc', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginTop: 10 },
  orderPremiumIndex: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  orderPremiumIndexText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  orderPremiumCopy: { flex: 1 },
  orderPremiumTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  orderPremiumSub: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  analyticsRow: { marginTop: 12 },
  analyticsTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  analyticsLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  analyticsValue: { color: colors.orange, fontSize: 15, fontWeight: '900' },
  analyticsTrack: { height: 10, borderRadius: 999, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  analyticsFill: { height: '100%', borderRadius: 999, backgroundColor: colors.orange },
  rankItem: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginTop: 10 },
  rankIndex: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  rankIndexText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  rankCopy: { flex: 1 },
  rankTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  rankValue: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  paymentMixRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginTop: 10 },
  paymentMixLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  paymentMixValue: { color: colors.orange, fontSize: 15, fontWeight: '900' },
  cardSecondaryActionWide: { height: 50, borderRadius: 15, backgroundColor: '#eef4f8', alignItems: 'center', justifyContent: 'center' },
});
