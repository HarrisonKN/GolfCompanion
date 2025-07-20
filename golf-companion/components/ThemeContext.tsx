import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { PALETTES } from '@/constants/theme';
import * as SecureStore from 'expo-secure-store';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  palette: typeof PALETTES.light;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  setMode: () => {},
  palette: PALETTES.light,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme() || 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [palette, setPalette] = useState(PALETTES[systemScheme]);

  // Load theme mode from SecureStore on mount
  useEffect(() => {
    (async () => {
      const storedMode = await SecureStore.getItemAsync('theme_mode');
      if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
        setModeState(storedMode as ThemeMode);
      }
    })();
  }, []);

  // Save theme mode to SecureStore whenever it changes
  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    SecureStore.setItemAsync('theme_mode', newMode);
  };

  useEffect(() => {
    const scheme = mode === 'system' ? systemScheme : mode;
    setPalette(PALETTES[scheme]);
  }, [mode, systemScheme]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, palette }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);