import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const isWeb = !isNative;
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isElectron = !!(window as any).electronAPI?.platform === true
  || typeof (window as any).electronAPI !== 'undefined';
