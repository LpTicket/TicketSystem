declare module '@stripe/stripe-terminal-react-native/lib/typescript/src/functions' {
  export function initialize(params: any): Promise<any>;
  export function connectLocalMobileReader(params: any): Promise<any>;
  export function easyConnect(params: any): Promise<any>;
  export function collectPaymentMethod(params: any): Promise<any>;
  export function processPayment(params: any): Promise<any>;
  export function processPaymentIntent(params: any): Promise<any>;
  export function retrievePaymentIntent(clientSecret: string): Promise<any>;
  export function cancelCollectPaymentMethod(): Promise<any>;
  export function disconnectReader(): Promise<any>;
  export function setConnectionToken(token: string | undefined, errorMessage?: string): void;
  export function setConnectionTokenProvider(provider: any): any;
}

declare module '@stripe/stripe-terminal-react-native/lib/commonjs/functions' {
  export * from '@stripe/stripe-terminal-react-native/lib/typescript/src/functions';
}
