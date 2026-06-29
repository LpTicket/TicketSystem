// Silence the harmless react-native-web "ScrollView doesn't take rejection well"
// console spam. Must run BEFORE expo's setupHMR wraps console.error. It happens
// when the venue-map canvas wins the responder over a parent ScrollView; native
// is unaffected.
{
  const noisy = "ScrollView doesn't take rejection well";
  const origError = console.error;
  const origWarn = console.warn;
  console.error = (...args: any[]) => { if (args.some((a) => typeof a === 'string' && a.includes(noisy))) return; origError(...args); };
  console.warn = (...args: any[]) => { if (args.some((a) => typeof a === 'string' && a.includes(noisy))) return; origWarn(...args); };
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
