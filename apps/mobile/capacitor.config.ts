import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.mainline.chess',
  appName: 'MainLine',
  webDir: '../web/dist',
  backgroundColor: '#F9FAFDFF',
  ios: {
    contentInset: 'never',
    scheme: 'Mainline',
    limitsNavigationsToAppBoundDomains: false,
  },
  android: {
    backgroundColor: '#F9FAFDFF',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 600, launchAutoHide: true, backgroundColor: '#F9FAFDFF', showSpinner: false },
    LocalNotifications: { smallIcon: 'ic_stat_mainline', iconColor: '#072EB8' },
  },
};

export default config;
