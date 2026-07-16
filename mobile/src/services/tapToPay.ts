import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import {
  completeDoorSaleTapToPay,
  createDoorSaleTapToPayIntent,
  getDoorSaleTapToPayConfig,
  getTerminalConnectionToken,
} from './doorSales';

type TapToPayParams = {
  eventId: string;
  amount: number;
  quantity: number;
  buyerEmail: string;
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

let terminalSession: { terminal: TerminalFunctions; detachTokenProvider: () => void; initialized: boolean; connected: boolean } | null = null;

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

  terminalSession = {
    terminal,
    detachTokenProvider: attachConnectionTokenProvider(terminal),
    initialized: false,
    connected: false,
  };
  return terminalSession;
}

async function ensureTapToPayReady({ eventId, merchantDisplayName = 'LPTicket', canAcceptTerms, onStatus, onPhase }: TapToPayOptions) {
  if (Platform.OS !== 'ios') {
    throw new Error('Tap to Pay en iPhone solo está disponible en iOS.');
  }

  const session = await getTerminalSession();
  const { terminal } = session;
  onPhase?.('preparing');
  onStatus?.('Preparando Tap to Pay en iPhone...');

  if (!session.initialized) {
    const initialized = await terminal.initialize({
      initParams: { logLevel: 'none' },
      useAppsOnDevicesConnectionTokenProvider: false,
    });
    if (initialized.error) throw new Error(initialized.error.message);
    session.initialized = true;
  }

  const config = await getDoorSaleTapToPayConfig(eventId);
  if (!session.connected) {
    onStatus?.('Configurando Tap to Pay en iPhone...');
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
  }

  onPhase?.('ready');
  onStatus?.('Tap to Pay está listo para cobrar.');
  return terminal;
}

export async function prepareDoorSaleTapToPay(options: TapToPayOptions) {
  await ensureTapToPayReady(options);
}

export async function releaseDoorSaleTapToPay() {
  const session = terminalSession;
  if (!session) return;
  terminalSession = null;
  try {
    await session.terminal.disconnectReader();
  } catch {}
  session.detachTokenProvider();
}

export async function runDoorSaleTapToPay({
  eventId,
  amount,
  quantity,
  buyerEmail,
  buyerName,
  canAcceptTerms,
  merchantDisplayName = 'LPTicket',
  onStatus,
  onPhase,
}: TapToPayParams) {
  const terminal = await ensureTapToPayReady({
    eventId,
    merchantDisplayName,
    canAcceptTerms,
    onStatus,
    onPhase,
  });

  const intent = await createDoorSaleTapToPayIntent({ eventId, amount, quantity, buyerEmail, buyerName });

    onStatus?.('Acerca la tarjeta o el teléfono al iPhone...');
    onPhase?.('collecting');
    const retrieved = await terminal.retrievePaymentIntent(intent.clientSecret);
    if (retrieved.error || !retrieved.paymentIntent) {
      throw new Error(retrieved.error?.message || 'No se pudo preparar el pago presencial.');
    }

    const processed = await terminal.processPaymentIntent({ paymentIntent: retrieved.paymentIntent });
    if (processed.error || !processed.paymentIntent) {
      throw new Error(processed.error?.message || 'No se pudo cobrar con Tap to Pay.');
    }

    onStatus?.('Confirmando entradas...');
    onPhase?.('processing');
    const paymentIntentId = processed.paymentIntent.id || intent.paymentIntentId;
    await completeDoorSaleTapToPay({ orderId: intent.orderId, paymentIntentId });

    onStatus?.('Pago aprobado. Entradas emitidas.');
    onPhase?.('complete');
    return { orderId: intent.orderId, paymentIntentId };
}
