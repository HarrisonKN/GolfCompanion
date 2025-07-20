import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { PALETTES } from '@/constants/theme';

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
  const [mode, setMode] = useState<ThemeMode>('system');
  const [palette, setPalette] = useState(PALETTES[systemScheme]);

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