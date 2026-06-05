import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { mockEvents } from '../data/mockEvents';
import { useLanguage } from '../i18n/LanguageContext';

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
  const { t } = useLanguage();
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
              <Text style={[styles.tabText, active === item.id && styles.tabTextActive]}>{labelFor(item.id, t)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t('ADMIN', 'ADMIN')}</Text>
        <Text style={styles.title}>{titleFor(active, t)}</Text>
        <Text style={styles.subtitle}>{subtitleFor(active, t)}</Text>

        {active === 'dashboard' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label={t('Ventas plataforma', 'Platform sales')} value="$4,860" />
              <Metric label={t('Eventos activos', 'Active events')} value="12" />
              <Metric label={t('Usuarios', 'Users')} value="438" />
              <Metric label={t('Pagos pendientes', 'Pending payouts')} value="$920" />
            </View>

            <PanelCard title={t('Actividad reciente', 'Recent activity')}>
              <Activity title={t('Nuevo evento publicado', 'New event published')} copy={event.title} />
              <Activity title={t('Pago pendiente', 'Pending payout')} copy={t('Organizador · $320.00', 'Organizer · $320.00')} />
              <Activity title={t('Nuevo usuario', 'New user')} copy={t('Cliente registrado hace 12 min', 'Customer registered 12 min ago')} />
            </PanelCard>
          </>
        )}

        {active === 'events' && (
          <PanelCard title={t('Eventos publicados', 'Published events')}>
            <Text style={styles.eventName}>{event.title}</Text>
            <Text style={styles.copy}>{event.date} · {event.venue}</Text>
            <View style={styles.statusRow}>
              <StatusPill label={t('PUBLICADO', 'PUBLISHED')} tone="green" />
              <StatusPill label={t('DESTACADO', 'FEATURED')} tone="orange" />
            </View>
            <View style={styles.actionGrid}>
              <ActionButton label={t('Ver evento', 'View event')} />
              <ActionButton label={t('Editar', 'Edit')} />
              <ActionButton label={t('Destacar', 'Feature')} />
              <ActionButton label={t('Ocultar', 'Hide')} muted />
            </View>
          </PanelCard>
        )}

        {active === 'users' && (
          editingUserId ? (
            users.filter((user) => user.id === editingUserId).map((user) => (
              <PanelCard key={user.id} title={t('Editar usuario', 'Edit user')} eyebrow={t('CONFIGURACION DE USUARIO', 'USER SETTINGS')} copy={t('Gestiona la informacion, permisos y estado de la cuenta.', 'Manage account information, permissions and status.')}>
                <FieldLabel label={t('Nombre completo', 'Full name')} />
                <TextInput value={user.name} onChangeText={(value) => updateUser(user.id, 'name', value)} style={styles.input} />

                <FieldLabel label={t('Email', 'Email')} />
                <TextInput value={user.email} onChangeText={(value) => updateUser(user.id, 'email', value)} autoCapitalize="none" keyboardType="email-address" style={styles.input} />

                <FieldLabel label={t('Rol', 'Role')} />
                <View style={styles.segmentGroup}>
                  {(['client', 'organizer', 'admin'] as const).map((role) => (
                    <TouchableOpacity key={role} onPress={() => updateUser(user.id, 'role', role)} style={[styles.segment, user.role === role && styles.segmentActive]}>
                      <Text style={[styles.segmentText, user.role === role && styles.segmentTextActive]}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FieldLabel label={t('Estado', 'Status')} />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateUser(user.id, 'suspended', false)} style={[styles.segment, !user.suspended && styles.segmentActiveOrange]}>
                    <Text style={[styles.segmentText, !user.suspended && styles.segmentTextActive]}>{t('Activo', 'Active')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateUser(user.id, 'suspended', true)} style={[styles.segment, user.suspended && styles.segmentDanger]}>
                    <Text style={[styles.segmentText, user.suspended && styles.segmentTextActive]}>{t('Suspendido', 'Suspended')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => setEditingUserId(null)} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>{t('GUARDAR USUARIO', 'SAVE USER')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingUserId(null)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{t('CANCELAR', 'CANCEL')}</Text>
                  </TouchableOpacity>
                </View>
              </PanelCard>
            ))
          ) : (
            <>
              <PanelCard title={t('Usuarios', 'Users')} eyebrow={t('GESTOR DE USUARIOS', 'USER MANAGER')} copy={t('Clientes, organizadores y administradores de la plataforma.', 'Customers, organizers and platform administrators.')} />
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
                      <Text style={styles.cardPrimaryText}>{t('EDITAR USUARIO', 'EDIT USER')}</Text>
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
              <PanelCard key={category.id} title={t('Editar categoria', 'Edit category')} eyebrow={t('CONFIGURACION DE CATEGORIA', 'CATEGORY SETTINGS')} copy={t('Ajusta visibilidad, nombre y posicionamiento en el home.', 'Adjust visibility, name and home placement.')}>
                <FieldLabel label={t('Nombre de categoria', 'Category name')} />
                <TextInput value={category.name} onChangeText={(value) => updateCategory(category.id, 'name', value)} style={styles.input} />

                <FieldLabel label={t('Visibilidad', 'Visibility')} />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'active', true)} style={[styles.segment, category.active && styles.segmentActive]}>
                    <Text style={[styles.segmentText, category.active && styles.segmentTextActive]}>{t('Activo', 'Active')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'active', false)} style={[styles.segment, !category.active && styles.segmentDanger]}>
                    <Text style={[styles.segmentText, !category.active && styles.segmentTextActive]}>{t('Inactivo', 'Inactive')}</Text>
                  </TouchableOpacity>
                </View>

                <FieldLabel label={t('Ubicacion en home', 'Home placement')} />
                <View style={styles.segmentGroup}>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'featured', true)} style={[styles.segment, category.featured && styles.segmentActiveOrange]}>
                    <Text style={[styles.segmentText, category.featured && styles.segmentTextActive]}>{t('Destacado', 'Featured')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => updateCategory(category.id, 'featured', false)} style={[styles.segment, !category.featured && styles.segmentActive]}>
                    <Text style={[styles.segmentText, !category.featured && styles.segmentTextActive]}>{t('Estandar', 'Standard')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity onPress={() => setEditingCategoryId(null)} style={styles.primaryButton}>
                    <Text style={styles.primaryButtonText}>{t('GUARDAR CATEGORIA', 'SAVE CATEGORY')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingCategoryId(null)} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>{t('CANCELAR', 'CANCEL')}</Text>
                  </TouchableOpacity>
                </View>
              </PanelCard>
            ))
          ) : (
            <>
              <PanelCard title={t('Categorias', 'Categories')} eyebrow={t('GESTOR DE CATEGORIAS', 'CATEGORY MANAGER')} copy={t('Crea y organiza categorias para filtros, busqueda y eventos destacados.', 'Create and organize categories for filters, search and featured events.')}>
                <View style={styles.createRow}>
                  <TextInput value={categoryDraft} onChangeText={setCategoryDraft} placeholder={t('Nueva categoria', 'New category')} placeholderTextColor="#9CA3AF" style={styles.createInput} />
                  <TouchableOpacity onPress={addCategory} style={styles.createButton}>
                    <Text style={styles.createButtonText}>{t('AGREGAR', 'ADD')}</Text>
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
                      <Text style={styles.cardSub}>{t('Filtros, discovery y home.', 'Filters, discovery and home.')}</Text>
                    </View>
                  </View>

                  <View style={styles.statusRow}>
                    <StatusPill label={category.active ? 'ACTIVE' : 'INACTIVE'} tone={category.active ? 'green' : 'red'} />
                    <StatusPill label={category.featured ? 'FEATURED' : 'STANDARD'} tone={category.featured ? 'orange' : 'gray'} />
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => setEditingCategoryId(category.id)} style={styles.cardPrimaryAction}>
                      <Text style={styles.cardPrimaryText}>{t('EDITAR CATEGORIA', 'EDIT CATEGORY')}</Text>
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
            <PanelCard title={t('Marketing', 'Marketing')} eyebrow={t('CONTROL DE MARKETING', 'MARKETING CONTROL')} copy={t('Administra lo que aparece en el home, banners, destacados y promociones.', 'Manage what appears on the home page, banners, featured events and promotions.')}>
              <View style={styles.bannerPreviewCard}>
                <View style={styles.bannerPreviewPill}>
                  <Text style={styles.bannerPreviewPillText}>{t('BANNER HOME', 'HOME BANNER')}</Text>
                </View>
                <Text style={styles.bannerPreviewTitle}>{t('Tu entrada a grandes experiencias', 'Your access to great experiences')}</Text>
                <Text style={styles.bannerPreviewCopy}>{t('Conciertos, teatro, talleres, networking y eventos privados.', 'Concerts, theater, workshops, networking and private events.')}</Text>
              </View>
            </PanelCard>

            <MarketingRow
              title={t('Banner principal', 'Main banner')}
              copy={t('Imagen principal del home y carrusel superior.', 'Main home image and top carousel.')}
              enabled={marketingBannerEnabled}
              onToggle={() => setMarketingBannerEnabled(!marketingBannerEnabled)}
            />

            <MarketingRow
              title={t('Eventos destacados', 'Featured events')}
              copy={t('Controla los eventos que aparecen como destacados.', 'Control events that appear as featured.')}
              enabled={marketingFeaturedEnabled}
              onToggle={() => setMarketingFeaturedEnabled(!marketingFeaturedEnabled)}
            />

            <MarketingRow
              title={t('Promociones', 'Promotions')}
              copy={t('Activa mensajes comerciales, descuentos o campanas.', 'Enable commercial messages, discounts or campaigns.')}
              enabled={marketingPromoEnabled}
              onToggle={() => setMarketingPromoEnabled(!marketingPromoEnabled)}
            />

            <PanelCard title={t('Orden de aparicion', 'Display order')} eyebrow={t('ORDEN VISUAL', 'DISPLAY ORDER')} copy={t('Define el orden visual del home movil.', 'Define the visual order of the mobile home screen.')}>
              <OrderItem index="01" title={t('Banner principal', 'Main banner')} />
              <OrderItem index="02" title={t('Buscador', 'Search')} />
              <OrderItem index="03" title={t('Beneficios / seguridad', 'Benefits / security')} />
              <OrderItem index="04" title={t('Eventos destacados', 'Featured events')} />
            </PanelCard>
          </>
        )}
        {active === 'analytics' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label={t('Conversion', 'Conversion')} value="8.4%" />
              <Metric label={t('Visitas', 'Visits')} value="18.2k" />
              <Metric label={t('Checkouts', 'Checkouts')} value="412" />
              <Metric label={t('Ingresos', 'Revenue')} value="$4.8k" />
            </View>

            <PanelCard title={t('Rendimiento global', 'Global performance')} eyebrow={t('ANALITICAS', 'ANALYTICS')}>
              <AnalyticsBar label={t('Eventos vistos', 'Events viewed')} value="82%" />
              <AnalyticsBar label={t('Checkout iniciado', 'Checkout started')} value="48%" />
              <AnalyticsBar label={t('Compra completada', 'Purchase completed')} value="31%" />
            </PanelCard>

            <PanelCard title={t('Eventos mas vistos', 'Most viewed events')} eyebrow={t('EVENTOS TOP', 'TOP EVENTS')} copy={t('Eventos con mayor actividad en la plataforma.', 'Events with the most activity on the platform.')}>
              <RankItem index="01" title="Noche de (des)amor" value="2.4k views" />
              <RankItem index="02" title="Sunset Lounge Experience" value="1.8k views" />
              <RankItem index="03" title="Private Networking Night" value="920 views" />
            </PanelCard>

            <PanelCard title={t('Metodos de pago', 'Payment methods')} eyebrow={t('MEZCLA DE PAGOS', 'PAYMENTS MIX')}>
              <PaymentMix label="Card / Stripe" value="86%" />
              <PaymentMix label="Apple Pay" value="9%" />
              <PaymentMix label="Google Pay" value="5%" />
            </PanelCard>
          </>
        )}
        {active === 'codes' && (
          <>
            <PanelCard title={t('Codigos especiales', 'Special codes')} eyebrow={t('CODIGOS ESPECIALES', 'SPECIAL CODES')} copy={t('Crea codigos, asigna comisiones y monitorea ventas generadas.', 'Create codes, assign commissions and monitor generated sales.')}>
              <View style={styles.createRow}>
                <TextInput value={specialCodeDraft} onChangeText={setSpecialCodeDraft} placeholder={t('Codigo', 'Code')} placeholderTextColor="#9CA3AF" autoCapitalize="characters" style={styles.createInput} />
                <TouchableOpacity onPress={addSpecialCode} style={styles.createButton}>
                  <Text style={styles.createButtonText}>{t('AGREGAR', 'ADD')}</Text>
                </TouchableOpacity>
              </View>
            </PanelCard>

            <View style={styles.metricsGrid}>
              <Metric label={t('Generado', 'Generated')} value="$1.4k" />
              <Metric label={t('Comisiones', 'Commissions')} value="$184" />
              <Metric label={t('Codigos', 'Codes')} value={String(specialCodes.length)} />
              <Metric label={t('Activos', 'Active')} value={String(specialCodes.filter((code) => code.active).length)} />
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
                    <Text style={styles.cardPrimaryText}>{t('VER VENTAS', 'VIEW SALES')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleSpecialCode(item.id)} style={styles.cardSecondaryAction}>
                    <Text style={styles.cardSecondaryText}>{item.active ? 'DISABLE' : 'ENABLE'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
        {active === 'payments' && <Placeholder title={t('Pagos', 'Payments')} items={[t('Pagos por evento', 'Payments by event'), t('Saldo organizador', 'Organizer balance'), t('Comision plataforma', 'Platform commission'), t('Registrar pago manual', 'Register manual payment'), t('Exportar reporte', 'Export report')]} />}
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
  const { t } = useLanguage();
  return (
    <View style={styles.orderPremiumItem}>
      <View style={styles.orderPremiumIndex}>
        <Text style={styles.orderPremiumIndexText}>{index}</Text>
      </View>
      <View style={styles.orderPremiumCopy}>
        <Text style={styles.orderPremiumTitle}>{title}</Text>
        <Text style={styles.orderPremiumSub}>{t('Visible en el home movil', 'Visible on mobile home')}</Text>
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

function labelFor(section: Section, t: (es: string, en: string) => string) {
  const labels: Record<Section, string> = {
    dashboard: t('Dashboard', 'Dashboard'),
    events: t('Eventos', 'Events'),
    users: t('Usuarios', 'Users'),
    categories: t('Categorias', 'Categories'),
    marketing: t('Marketing', 'Marketing'),
    analytics: t('Analiticas', 'Analytics'),
    codes: t('Codigos', 'Codes'),
    payments: t('Pagos', 'Payments'),
  };
  return labels[section];
}

function titleFor(section: Section, t: (es: string, en: string) => string) {
  const names: Record<Section, string> = {
    dashboard: t('Panel administrativo', 'Admin dashboard'),
    events: t('Eventos', 'Events'),
    users: t('Usuarios', 'Users'),
    categories: t('Categorias', 'Categories'),
    marketing: t('Marketing', 'Marketing'),
    analytics: t('Analiticas', 'Analytics'),
    codes: t('Codigos especiales', 'Special codes'),
    payments: t('Pagos', 'Payments'),
  };
  return names[section];
}

function subtitleFor(section: Section, t: (es: string, en: string) => string) {
  const copy: Record<Section, string> = {
    dashboard: t('Resumen de ventas, eventos, usuarios y pagos pendientes.', 'Sales, events, users and pending payouts overview.'),
    events: t('Administra eventos publicados, destacados y visibilidad.', 'Manage published events, featured placement and visibility.'),
    users: t('Gestiona clientes, organizadores, administradores y permisos.', 'Manage customers, organizers, administrators and permissions.'),
    categories: t('Organiza categorias para busqueda, filtros y home.', 'Organize categories for search, filters and home.'),
    marketing: t('Controla banners, promociones y orden visual del home.', 'Control banners, promotions and the visual order of the home screen.'),
    analytics: t('Mide conversion, visitas, checkouts e ingresos.', 'Measure conversion, visits, checkouts and revenue.'),
    codes: t('Crea codigos, comisiones y seguimiento de ventas.', 'Create codes, commissions and sales tracking.'),
    payments: t('Revisa pagos, saldos y reportes financieros.', 'Review payouts, balances and financial reports.'),
  };
  return copy[section];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.darkBg },
  tabs: { height: 86, paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab: { height: 40, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(8,31,51,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', justifyContent: 'center' },
  tabActive: { backgroundColor: '#0A375A', borderColor: '#0A375A' },
  tabText: { color: '#CBD5E1', fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#FFFFFF' },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 140 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 4, fontWeight: '900', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#CBD5E1', fontSize: 16, lineHeight: 23, fontWeight: '600', marginBottom: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 24, fontWeight: '900', marginBottom: 4 },
  metricLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '800' },
  panelCard: { backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 20, marginBottom: 16, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  formEyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  panelTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '900', marginBottom: 8 },
  eventName: { color: colors.navy, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, fontWeight: '600', marginBottom: 14 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusPill: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  statusGreen: { backgroundColor: '#DCFCE7' },
  statusRed: { backgroundColor: '#FEE2E2' },
  statusOrange: { backgroundColor: '#FFF7ED' },
  statusGray: { backgroundColor: '#F3F4F6' },
  statusDark: { backgroundColor: '#0A375A' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusTextGreen: { color: '#15803d' },
  statusTextRed: { color: '#991b1b' },
  statusTextOrange: { color: colors.orange },
  statusTextGray: { color: '#6B7280' },
  statusTextDark: { color: '#FFFFFF' },
  userCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  cardMain: { flex: 1 },
  cardTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  cardSub: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  cardPrimaryAction: { flex: 1, height: 50, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  cardPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  cardSecondaryAction: { width: 104, height: 50, borderRadius: 15, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  cardSecondaryText: { color: colors.navy, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  actionButton: { height: 44, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionButtonMuted: { backgroundColor: '#F8FAFC' },
  actionButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  actionButtonTextMuted: { color: colors.navy },
  fieldLabel: { color: '#6B7280', fontSize: 13, fontWeight: '900', marginBottom: 8 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 16, color: colors.navy, fontSize: 16, fontWeight: '800', marginBottom: 16 },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentActiveOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  segmentDanger: { backgroundColor: '#991b1b', borderColor: '#991b1b' },
  segmentText: { color: '#6B7280', fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: '#FFFFFF' },
  formActions: { marginTop: 4, gap: 10 },
  primaryButton: { height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, letterSpacing: 1.8, fontWeight: '900' },
  secondaryButton: { height: 54, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.navy, fontSize: 13, letterSpacing: 1.4, fontWeight: '900' },
  createRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  createInput: { flex: 1, height: 56, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 16, color: colors.navy, fontSize: 15, fontWeight: '700' },
  createButton: { width: 78, height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  createButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.3 },
  activity: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  activityDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.orange, marginTop: 5 },
  activityCopy: { flex: 1 },
  activityTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  listText: { color: colors.navy, fontSize: 15, fontWeight: '700' },
tabsShell: { height: 86, backgroundColor: colors.darkBg, justifyContent: 'center', overflow: 'hidden' },
  tabsScroller: { height: 86, flexGrow: 0, flexShrink: 0, backgroundColor: colors.darkBg },

  bannerPreviewCard: { backgroundColor: colors.navy, borderRadius: 20, padding: 20, marginTop: 4 },
  bannerPreviewPill: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16 },
  bannerPreviewPillText: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  bannerPreviewTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', lineHeight: 29, marginBottom: 8 },
  bannerPreviewCopy: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  avatarOrange: { backgroundColor: colors.orange },
  avatarMuted: { backgroundColor: '#9CA3AF' },
  marketingCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, marginBottom: 14, shadowColor: '#111827', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  marketingEnableButton: { height: 50, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  marketingEnableText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  marketingDisableButton: { height: 50, borderRadius: 15, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  marketingDisableText: { color: colors.navy, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  orderPremiumItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginTop: 10 },
  orderPremiumIndex: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  orderPremiumIndexText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  orderPremiumCopy: { flex: 1 },
  orderPremiumTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  orderPremiumSub: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  analyticsRow: { marginTop: 12 },
  analyticsTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  analyticsLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  analyticsValue: { color: colors.orange, fontSize: 15, fontWeight: '900' },
  analyticsTrack: { height: 10, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  analyticsFill: { height: '100%', borderRadius: 999, backgroundColor: colors.orange },
  rankItem: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginTop: 10 },
  rankIndex: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  rankIndexText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  rankCopy: { flex: 1 },
  rankTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  rankValue: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  paymentMixRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginTop: 10 },
  paymentMixLabel: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  paymentMixValue: { color: colors.orange, fontSize: 15, fontWeight: '900' },
  cardSecondaryActionWide: { height: 50, borderRadius: 15, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
});
