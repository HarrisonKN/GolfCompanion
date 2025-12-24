import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

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
  const deviceName = Device.deviceName || Device.modelName || (Constants.isDevice ? 'Physical Device' : 'Simulator');
  const modelName = Device.modelName || 'Unknown model';
  const brand = Device.brand || 'Unknown brand';
  const manufacturer = Device.manufacturer || brand;
  const osBuildId = Device.osBuildId || Device.osInternalBuildId || '';
  const osVersion = Device.osVersion || String(Platform.Version);

  return {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    expoVersion: Constants.expoVersion,
    appOwnership: Constants.appOwnership,
    isDevice: Constants.isDevice,
    deviceName,
    modelName,
    brand,
    manufacturer,
    osVersion,
    osBuildId,
  };
};