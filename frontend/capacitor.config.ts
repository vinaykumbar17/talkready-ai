import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.talkreadyai.app',
  appName: 'TALKREADY AI',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;