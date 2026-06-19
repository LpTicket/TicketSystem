import { Platform } from 'react-native';
import { apiPost } from './api';

type NotificationsModule = typeof import('expo-notifications');

const EXPO_PROJECT_ID = 'a5b889a9-3ba1-44f6-8f25-b808ef14143c';

let notificationsModule: NotificationsModule | null = null;

async function getNotifications() {
  if (notificationsModule) return notificationsModule;
  try {
    notificationsModule = await import('expo-notifications');
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    return notificationsModule;
  } catch {
    return null;
  }
}

export async function registerDeviceForPushNotifications() {
  if (Platform.OS === 'web') return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
  const token = tokenResult.data;
  if (!token) return null;

  await apiPost('/marketing/push-token', {
    token,
    platform: Platform.OS,
  });

  return token;
}

export async function addPushNotificationResponseListener(onUrl: (url: string) => void) {
  if (Platform.OS === 'web') return () => {};
  const Notifications = await getNotifications();
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    const url = typeof data.url === 'string' ? data.url : typeof data.link === 'string' ? data.link : '';
    if (url) onUrl(url);
  });

  return () => subscription.remove();
}
