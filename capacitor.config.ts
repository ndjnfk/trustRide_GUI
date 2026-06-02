import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trustridesre.app',
  appName: 'TrustRides',
  // Angular ka static (non-SSR) build yahan output hota hai:
  //   npm run build:capacitor  ->  dist/realtime-app/browser
  webDir: 'dist/realtime-app/browser',
  server: {
    androidScheme: 'https',
  },
};

export default config;
