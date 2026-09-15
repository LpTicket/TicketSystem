import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import {
  verifyDoorSaleTapToPay,
  createDoorSaleTapToPayIntent,
  getDoorSaleTapToPayConfig,
  getTerminalConnectionToken,
} from './doorSales';

type TapToPayParams = {
  userId: string;
  retryPending?: boolean;
  eventId: string;
  amount: number;
  quantity: number;
  buyerEmail?: string;
  buyerName?: string;
  canAcceptTerms: boolean;
  merchantDisplayName?: string;
  onStatus?: (message: string) => void;
  onPhase?: (phase: TapPhase) => void;
};

type TapPhase = 'preparing' | 'ready' | 'collecting' | 'processing' | 'complete';

type TapToPayOptions = Pick<TapToPayParams, 'eventId' | 'merchantDisplayName' | 'canAcceptTerms' | 'onStatus'> & {
  onPhase?: (phase: TapPhase) => void;
};

type TerminalFunctions = typeof import('@stripe/stripe-terminal-react-native/lib/typescript/src/functions');

let terminalSession: {
  terminal: TerminalFunctions;
  detachTokenProvider: () => void;
  detachConnectionState?: () => void;
  initializing?: Promise<void> | null;
  initialized: boolean;
  connected: boolean;
  connecting?: Promise<TerminalFunctions> | null;
} | null = null;

function nativeUnavailableMessage(error?: any) {
  const raw = String(error?.message || error || '');
  if (raw.includes('NativeModule') || raw.includes('null') || raw.includes('Expo Go')) {
    return 'Tap to Pay requiere una app nativa compilada. No funciona dentro de Expo Go.';
  }
  return raw || 'No se pudo iniciar Tap to Pay.';
}

function attachConnectionTokenProvider(terminal: TerminalFunctions) {
  const stripeTerminal = NativeModules.StripeTerminalReactNative;
  if (!stripeTerminal?.getConstants) {
    throw new Error('Tap to Pay requiere una app nativa compilada. No funciona dentro de Expo Go.');
  }

  const { FETCH_TOKEN_PROVIDER } = stripeTerminal.getConstants();
  const emitter = new NativeEventEmitter(stripeTerminal);
  const subscription = emitter.addListener(FETCH_TOKEN_PROVIDER, async () => {
    try {
      const token = await getTerminalConnectionToken();
      await terminal.setConnectionToken(token.secret);
    } catch (error: any) {
      await terminal.setConnectionToken(
        undefined,
        error?.message || 'No se pudo obtener el token de conexion de Stripe.'
      );
    }
  });

  return () => subscription.remove();
}

async function getTerminalSession() {
  if (terminalSession) return terminalSession;

  let terminal: TerminalFunctions;
  try {
    terminal = await import('@stripe/stripe-terminal-react-native/lib/commonjs/functions') as TerminalFunctions;
  } catch (error) {
    throw new Error(nativeUnavailableMessage(error));
  }

  // A background warm-up and a charge can finish the dynamic import together.
  if (terminalSession) return terminalSession;
  terminalSession = {
    terminal,
    detachTokenProvider: attachConnectionTokenProvider(terminal),
    initialized: false,
    connected: false,
  };
  const session = terminalSession;
  const native = NativeModules.StripeTerminalReactNative;
  const constants = native.getConstants();
  const emitter = new NativeEventEmitter(native);
  const subscriptions = [
    [constants.DISCONNECT, false], [constants.START_READER_RECONNECT, false],
    [constants.READER_RECONNECT_FAIL, false], [constants.READER_RECONNECT_SUCCEED, true],
  ].filter(([event]) => typeof event === 'string').map(([event, connected]) =>
    emitter.addListener(event as string, () => { session.connected = Boolean(connected); }));
  session.detachConnectionState = () => subscriptions.forEach((subscription) => subscription.remove());
  return session;
}

async function ensureTapToPayReady({ eventId, merchantDisplayName = 'LPTicket', canAcceptTerms, onStatus, onPhase }: TapToPayOptions) {
  if (Platform.OS !== 'ios') {
    throw new Error('Tap to Pay en iPhone solo está disponible en iOS.');
  }

  const session = await getTerminalSession();
  const { terminal } = session;

  if (!session.initialized) {
    onPhase?.('preparing');
    onStatus?.('Preparando Tap to Pay en iPhone...');
    if (!session.initializing) {
      session.initializing = (async () => {
        const initialized = await terminal.initialize({
          initParams: { logLevel: 'none' },
          useAppsOnDevicesConnectionTokenProvider: false,
        });
        if (initialized.error) throw new Error(initialized.error.message);
        session.initialized = true;
      })();
    }
    try { await session.initializing; }
    finally { session.initializing = null; }
  }

  const connection = await terminal.getConnectionStatus();
  session.connected = connection === 'connected';
  if (connection === 'reconnecting' || (connection === 'connecting' && !session.connecting)) {
    throw new Error('El lector se está reconectando. Espera y vuelve a preparar Tap to Pay.');
  }
  if (!session.connected) {
    if (!session.connecting) {
      session.connecting = (async () => {
        onPhase?.('preparing');
        onStatus?.('Configurando Tap to Pay en iPhone...');
        const config = await getDoorSaleTapToPayConfig(eventId);
        const connected = await terminal.easyConnect({
          discoveryMethod: 'tapToPay',
          locationId: config.locationId,
          simulated: false,
          merchantDisplayName,
          // Apple terms must only be accepted by the authorized LPTicket admin.
          tosAcceptancePermitted: canAcceptTerms,
          autoReconnectOnUnexpectedDisconnect: true,
        });
        if (connected.error) {
          const message = connected.error.message || 'No se pudo configurar Tap to Pay.';
          if (!canAcceptTerms && /terms|agreement|accept/i.test(message)) {
            throw new Error('Tap to Pay debe ser configurado primero por el administrador principal de LPTicket.');
          }
          throw new Error(message);
        }
        session.connected = true;
        return terminal;
      })();
    }
    try {
      await session.connecting;
    } finally {
      session.connecting = null;
    }
  }

  if (session.connected) {
    onPhase?.('ready');
    onStatus?.('Tap to Pay está listo para cobrar.');
    return terminal;
  }

  throw new Error('No se pudo preparar Tap to Pay.');
}

export async function prepareDoorSaleTapToPay(options: TapToPayOptions) {
  await ensureTapToPayReady(options);
}

export async function releaseDoorSaleTapToPay() {
  if (paymentBusy) return;
  const session = terminalSession;
  if (!session) return;
  terminalSession = null;
  try {
    await session.terminal.disconnectReader();
  } catch {}
  session.detachTokenProvider();
  session.detachConnectionState?.();
}

export type PendingTapPayment = {
  orderId: string;
  paymentIntentId: string;
  eventId: string;
  quantity: number;
  total?: number;
  currency?: string;
  eventTitle?: string;
};

// Store only identifiers, never client secrets or card/contact data. A pending
// attempt survives navigation/restart and is isolated to the signed-in operator.
const pendingKey = (userId: string) => `lp_pending_tap_v1:${userId}`;
let paymentBusy = false;

export async function getPendingTapPayment(userId: string): Promise<PendingTapPayment | null> {
  const value = await AsyncStorage.getItem(pendingKey(userId));
  if (!value) return null;
  const pending = JSON.parse(value) as PendingTapPayment;
  if (!pending.orderId || !pending.paymentIntentId || !pending.eventId || !pending.quantity) {
    throw new Error('No se pudo recuperar la compra pendiente. Revisa el pago antes de volver a cobrar.');
  }
  return pending;
}

async function resolvePayment(userId: string, pending: PendingTapPayment, action: 'verify' | 'cancel' = 'verify') {
  const result = await verifyDoorSaleTapToPay({ orderId: pending.orderId, paymentIntentId: pending.paymentIntentId, action });
  if (result.orderId !== pending.orderId) throw new Error('No se pudo confirmar esta compra.');
  if (result.success) {
    if (result.paymentStatus !== 'succeeded' || result.ticketCount !== pending.quantity) {
      throw new Error('La compra sigue pendiente de confirmación. No permitas el ingreso.');
    }
    await AsyncStorage.removeItem(pendingKey(userId));
  } else if (result.cancelled && result.paymentStatus === 'canceled') {
    await AsyncStorage.removeItem(pendingKey(userId));
  }
  return result;
}

export async function resolvePendingTapPayment(userId: string, action: 'verify' | 'cancel' = 'verify') {
  if (paymentBusy) throw new Error('Hay una verificación en curso.');
  paymentBusy = true;
  try {
    const pending = await getPendingTapPayment(userId);
    if (!pending) throw new Error('No hay una compra pendiente.');
    return await resolvePayment(userId, pending, action);
  } finally { paymentBusy = false; }
}

export async function runDoorSaleTapToPay({
  userId, retryPending = false, eventId, amount, quantity, buyerEmail, buyerName,
  canAcceptTerms, merchantDisplayName = 'LPTicket', onStatus, onPhase,
}: TapToPayParams) {
  if (paymentBusy) throw new Error('Hay un cobro en curso.');
  paymentBusy = true;
  try {
    let pending = await getPendingTapPayment(userId);
    let clientSecret: string;
    let terminal: TerminalFunctions | undefined;
    if (pending) {
      onPhase?.('processing');
      onStatus?.('Verificando la compra pendiente. Espera para permitir el ingreso.');
      const result = await resolvePayment(userId, pending);
      if (result.success || result.cancelled || !retryPending || !result.retryAllowed || !result.clientSecret) return result;
      if (pending.eventId !== eventId) throw new Error('Resuelve la compra del evento anterior antes de cobrar otra.');
      clientSecret = result.clientSecret;
    } else {
      if (retryPending) throw new Error('La compra anterior ya fue resuelta.');
      // Warm the reader before creating the payment. No additional wait on the
      // normal path beyond Stripe processing and server confirmation.
      terminal = await ensureTapToPayReady({ eventId, merchantDisplayName, canAcceptTerms, onStatus, onPhase });
      const intent = await createDoorSaleTapToPayIntent({ eventId, amount, quantity, buyerEmail, buyerName });
      pending = { orderId: intent.orderId, paymentIntentId: intent.paymentIntentId, eventId, quantity: intent.invoice.quantity, total: intent.invoice.total, currency: intent.event?.currency, eventTitle: intent.event?.title };
      await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(pending));
      clientSecret = intent.clientSecret;
    }

    terminal ??= await ensureTapToPayReady({ eventId, merchantDisplayName, canAcceptTerms, onStatus, onPhase });
    onStatus?.('Acerca la tarjeta. Espera después la confirmación de ingreso de LPTicket.');
    onPhase?.('collecting');
    try {
      const retrieved = await terminal.retrievePaymentIntent(clientSecret);
      if (retrieved.error || !retrieved.paymentIntent) throw new Error('No se pudo preparar el lector.');
      await terminal.processPaymentIntent({ paymentIntent: retrieved.paymentIntent });
      // Even SDK errors/timeouts can mask a successful charge. Always reconcile
      // this exact intent with the backend; never create or retry a charge here.
    } catch {
      // The server below is the authority, including when the native call fails.
    }
    onStatus?.('Confirmando pago e ingreso. Mantén al cliente en la puerta.');
    onPhase?.('processing');
    const result = await resolvePayment(userId, pending);
    if (result.success) {
      onStatus?.('Pago confirmado. Puede ingresar.');
      onPhase?.('complete');
    }
    return result;
  } finally { paymentBusy = false; }
}
