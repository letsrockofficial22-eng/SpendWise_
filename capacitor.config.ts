import type {CapacitorConfig} from '@capacitor/cli';

const config:CapacitorConfig={
  appId:'com.yourdomain.spendwise',
  appName:'SpendWise',
  webDir:'out',
  plugins:{
    Keyboard:{
      resize:'body',
      style:'LIGHT',
    },
    SplashScreen:{
      launchAutoHide:true,
      launchShowDuration:1500,
      backgroundColor:'#f7f9f7',
    },
    StatusBar:{
      backgroundColor:'#f7f9f7',
      style:'LIGHT',
    },
  },
};

export default config;
