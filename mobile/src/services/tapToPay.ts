import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import {
  completeDoorSaleTapToPay,
  createDoorSaleTapToPayIntent,
  getTerminalConnectionToken,
} from './doorSales';

type TapToPayParams = {
  eventId: string;
  amount: number;
  quantity: number;
  merchantDisplayName?: string;
  onStatus?: (message: string) => void;
};

function nativeUnavailableMessage(error?: any) {
  const raw = String(error?.message || error || '');
  if (raw.includes('NativeModule') || raw.includes('null') || raw.includes('Expo Go')) {
    return 'Tap to Pay requiere una app nativa compilada. No funciona dentro de Expo Go.';
  }
  return raw || 'No se pudo iniciar Tap to Pay.';
}

function attachConnectionTokenProvider(
  terminal: typeof import('@stripe/stripe-terminal-react-native/lib/typescript/src/functions')
) {
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

export async function runDoorSaleTapToPay({
  eventId,
  amount,
  quantity,
  merchantDisplayName = 'LPTicket',
  onStatus,
}: TapToPayParams) {
  if (Platform.OS !== 'ios') {
    throw new Error('Tap to Pay en iPhone solo está disponible en iOS.');
  }

  let terminal: typeof import('@stripe/stripe-terminal-react-native/lib/typescript/src/functions');
  try {
    terminal = await import('@stripe/stripe-terminal-react-native/lib/commonjs/functions') as typeof terminal;
  } catch (error) {
    throw new Error(nativeUnavailableMessage(error));
  }

  const detachTokenProvider = attachConnectionTokenProvider(terminal);

  try {
    onStatus?.('Preparando cobro...');
    const initialized = await terminal.initialize({
      initParams: { logLevel: 'none' },
      useAppsOnDevicesConnectionTokenProvider: false,
    });
    if (initialized.error) throw new Error(initialized.error.message);

    const intent = await createDoorSaleTapToPayIntent({ eventId, amount, quantity });

    onStatus?.('Conectando Tap to Pay...');
    const connected = await terminal.easyConnect({
      discoveryMethod: 'tapToPay',
      locationId: intent.locationId,
      simulated: false,
      merchantDisplayName,
      tosAcceptancePermitted: true,
      autoReconnectOnUnexpectedDisconnect: true,
    });
    if (connected.error) throw new Error(connected.error.message);

    onStatus?.('Acerca la tarjeta o el teléfono al iPhone...');
    const retrieved = await terminal.retrievePaymentIntent(intent.clientSecret);
    if (retrieved.error || !retrieved.paymentIntent) {
      throw new Error(retrieved.error?.message || 'No se pudo preparar el pago presencial.');
    }

    const processed = await terminal.processPaymentIntent({ paymentIntent: retrieved.paymentIntent });
    if (processed.error || !processed.paymentIntent) {
      throw new Error(processed.error?.message || 'No se pudo cobrar con Tap to Pay.');
    }

    onStatus?.('Confirmando entradas...');
    const paymentIntentId = processed.paymentIntent.id || intent.paymentIntentId;
    await completeDoorSaleTapToPay({ orderId: intent.orderId, paymentIntentId });

    onStatus?.('Pago aprobado. Entradas emitidas.');
    return { orderId: intent.orderId, paymentIntentId };
  } finally {
    detachTokenProvider();
    try {
      await terminal.disconnectReader();
    } catch {}
  }
}
