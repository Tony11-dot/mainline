import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mainline.chess',
  appName: 'MainLine',
  webDir: '../web/dist',
  backgroundColor: '#F2F4F9FF',
  ios: {
    contentInset: 'never',
    // Swipe-back and bounce feel native; the web view gets the full screen (safe areas handled in CSS).
    allowsLinkPreview: false,
    scheme: 'Mainline',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#F2F4F9FF',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 3000, launchAutoHide: false, backgroundColor: '#F2F4F9FF', showSpinner: false },
    LocalNotifications: { smallIcon: 'ic_stat_mainline', iconColor: '#072EB8' },
  },
};

export default config;
