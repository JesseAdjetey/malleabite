import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.malleabite.app',
  appName: 'Malleabite',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
    Keyboard: {
      resize: 'body',
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#488AFF',
      sound: 'default_notification',
    },
  },
};

export default config;
