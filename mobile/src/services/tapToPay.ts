import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
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
  orderId?: string;
  paymentIntentId?: string;
  requestId?: string;
  amount?: number;
  eventId: string;
  quantity: number;
  total?: number;
  currency?: string;
  eventTitle?: string;
  cancellationRequested?: boolean;
};

// Store only identifiers, never client secrets or card/contact data. A pending
// attempt survives navigation/restart and is isolated to the signed-in operator.
const pendingKey = (userId: string) => `lp_pending_tap_v1:${userId}`;
let paymentBusy = false;

export async function getPendingTapPayment(userId: string): Promise<PendingTapPayment | null> {
  const value = await AsyncStorage.getItem(pendingKey(userId));
  if (!value) return null;
  const pending = JSON.parse(value) as PendingTapPayment;
  const hasPayment = pending.orderId && pending.paymentIntentId;
  const hasRequest = pending.requestId && Number.isFinite(pending.amount) && Number(pending.amount) > 0;
  if ((!hasPayment && !hasRequest) || !pending.eventId || !pending.quantity) {
    throw new Error('No se pudo recuperar la compra pendiente. Revisa el pago antes de volver a cobrar.');
  }
  return pending;
}

async function createPendingIntent(userId: string, pending: PendingTapPayment, buyerEmail?: string, buyerName?: string) {
  if (!pending.requestId || pending.amount === undefined) {
    throw new Error('No se pudo recuperar la solicitud de cobro. Verifica esta compra antes de volver a cobrar.');
  }
  const intent = await createDoorSaleTapToPayIntent({
    requestId: pending.requestId, eventId: pending.eventId,
    amount: pending.amount, quantity: pending.quantity, buyerEmail, buyerName,
  });
  Object.assign(pending, {
    orderId: intent.orderId, paymentIntentId: intent.paymentIntentId,
    quantity: intent.invoice.quantity, total: intent.invoice.total,
    currency: intent.event?.currency, eventTitle: intent.event?.title,
  });
  // Never show the card reader until the exact server payment is saved locally.
  await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(pending));
  return intent.clientSecret;
}

async function resolvePayment(userId: string, pending: PendingTapPayment, action: 'verify' | 'cancel' = 'verify') {
  // A failed request must not forget the operator's cancellation. Complete the
  // same cancellation after navigation/restart before accepting another sale.
  if (action === 'cancel' && !pending.cancellationRequested) {
    pending.cancellationRequested = true;
    await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(pending));
  }
  // The server may have created the payment even if its response was lost.
  // Repeating this saved request recovers that order instead of creating another.
  if (!pending.orderId || !pending.paymentIntentId) await createPendingIntent(userId, pending);
  if (!pending.orderId || !pending.paymentIntentId) throw new Error('No se pudo recuperar esta compra.');
  const result = await verifyDoorSaleTapToPay({
    orderId: pending.orderId,
    paymentIntentId: pending.paymentIntentId,
    action: pending.cancellationRequested ? 'cancel' : action,
  });
  if (result.orderId !== pending.orderId) throw new Error('No se pudo confirmar esta compra.');
  if (result.success) {
    if (result.paymentStatus !== 'succeeded' || result.ticketCount !== pending.quantity) {
      throw new Error('La compra sigue pendiente de confirmación. No permitas el ingreso.');
    }
    await AsyncStorage.removeItem(pendingKey(userId));
  } else if (result.cancelled && result.paymentStatus === 'canceled') {
    await AsyncStorage.removeItem(pendingKey(userId));
  }
  if (pending.cancellationRequested && !result.success && !result.cancelled) {
    return {
      ...result,
      retryAllowed: false,
      clientSecret: undefined,
      message: 'Cancelación pendiente de confirmación. Verifica esta compra antes de volver a cobrar.',
    };
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
      if (result.success || result.cancelled || pending.cancellationRequested || !retryPending || !result.retryAllowed || !result.clientSecret) return result;
      if (pending.eventId !== eventId) throw new Error('Resuelve la compra del evento anterior antes de cobrar otra.');
      clientSecret = result.clientSecret;
    } else {
      if (retryPending) throw new Error('La compra anterior ya fue resuelta.');
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Ingresa un monto y una cantidad válidos antes de cobrar.');
      }
      // Warm the reader before creating the payment. No additional wait on the
      // normal path beyond Stripe processing and server confirmation.
      terminal = await ensureTapToPayReady({ eventId, merchantDisplayName, canAcceptTerms, onStatus, onPhase });
      pending = { requestId: Crypto.randomUUID(), eventId, amount, quantity };
      await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(pending));
      clientSecret = await createPendingIntent(userId, pending, buyerEmail, buyerName);
    }

    terminal ??= await ensureTapToPayReady({ eventId, merchantDisplayName, canAcceptTerms, onStatus, onPhase });
    onStatus?.('Acerca la tarjeta. Espera después la confirmación de ingreso de LPTicket.');
    onPhase?.('collecting');
    let cancelledByOperator = false;
    try {
      const retrieved = await terminal.retrievePaymentIntent(clientSecret);
      if (retrieved.error) throw retrieved.error;
      if (!retrieved.paymentIntent) throw new Error('No se pudo preparar el lector.');
      const processed = await terminal.processPaymentIntent({ paymentIntent: retrieved.paymentIntent });
      cancelledByOperator = processed.error?.code === 'CANCELED';
      // Even SDK errors/timeouts can mask a successful charge. Always reconcile
      // this exact intent with the backend; never create or retry a charge here.
    } catch (error: any) {
      cancelledByOperator = error?.code === 'CANCELED';
      // Unknown errors still require verification; only an explicit native
      // cancellation requests cancellation of this exact server-side intent.
    }
    onStatus?.('Confirmando pago e ingreso. Mantén al cliente en la puerta.');
    onPhase?.('processing');
    const result = await resolvePayment(userId, pending, cancelledByOperator ? 'cancel' : 'verify');
    if (result.success) {
      onStatus?.('Pago confirmado. Puede ingresar.');
      onPhase?.('complete');
    }
    return result;
  } finally { paymentBusy = false; }
}
