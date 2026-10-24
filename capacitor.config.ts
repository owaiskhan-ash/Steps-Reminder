import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sc.stepreminder',
  appName: 'SC Step Reminder',
  webDir: 'dist',
  android: {
    backgroundColor: '#120e0b',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_sc',
      iconColor: '#caa36c',
    },
  },
}

export default config
