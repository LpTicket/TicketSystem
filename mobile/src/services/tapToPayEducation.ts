import { NativeModules, Platform } from 'react-native';

type TapToPayEducationModule = {
  presentPaymentEducation: () => Promise<void>;
};

const nativeModule = NativeModules.LPTicketTapToPayEducation as TapToPayEducationModule | undefined;

export async function presentTapToPayEducation() {
  if (Platform.OS !== 'ios') {
    throw new Error('Tap to Pay en iPhone solo está disponible en iOS.');
  }
  if (!nativeModule?.presentPaymentEducation) {
    throw new Error('Actualiza la app nativa de LPTicket para ver la educación oficial de Tap to Pay.');
  }
  await nativeModule.presentPaymentEducation();
}
