import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { THEMES, getStoredTheme, applyTheme, getThemeById } from '../themeConfig';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentThemeState] = useState(() => getStoredTheme());

  // Initialize theme on mount
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Listen to external theme changes (e.g. cross-tab or settings updates)
  useEffect(() => {
    const handleThemeChanged = (e) => {
      const nextTheme = e?.detail?.theme || getStoredTheme();
      setCurrentThemeState(nextTheme);
    };

    window.addEventListener('theme-changed', handleThemeChanged);
    window.addEventListener('storage', handleThemeChanged);
    return () => {
      window.removeEventListener('theme-changed', handleThemeChanged);
      window.removeEventListener('storage', handleThemeChanged);
    };
  }, []);

  const setTheme = useCallback((themeId) => {
    applyTheme(themeId);
    setCurrentThemeState(themeId);
  }, []);

  const themeObj = useMemo(() => getThemeById(currentTheme), [currentTheme]);

  const toggleDarkMode = useCallback(() => {
    if (themeObj.isDark) {
      // Switch to default light theme or previous light
      setTheme('ocean-blue');
    } else {
      // Switch to midnight dark
      setTheme('midnight-dark');
    }
  }, [themeObj.isDark, setTheme]);

  const value = useMemo(
    () => ({
      theme: currentTheme,
      currentTheme,
      themeObj,
      isDark: themeObj.isDark,
      darkMode: themeObj.isDark,
      setTheme,
      toggleDarkMode,
      themes: THEMES,
    }),
    [currentTheme, themeObj, setTheme, toggleDarkMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
