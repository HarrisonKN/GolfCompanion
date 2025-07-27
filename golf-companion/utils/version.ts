import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getAppVersion = () => {
  const version = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Platform.OS === 'ios' 
    ? Constants.expoConfig?.ios?.buildNumber || '1'
    : Constants.expoConfig?.android?.versionCode?.toString() || '1';
  
  return {
    version,
    buildNumber,
    fullVersion: `${version} (${buildNumber})`,
    displayVersion: `v${version}`,
    fullDisplayVersion: `v${version} build ${buildNumber}`
  };
};

export const getBuildInfo = () => {
  return {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    expoVersion: Constants.expoVersion,
    appOwnership: Constants.appOwnership,
    isDevice: Constants.isDevice,
  };
};