// src/themeConfig.js - Unified 6-Theme Configuration & Application Engine

export const THEMES = [
  {
    id: 'ocean-blue',
    label: 'Ocean Blue',
    icon: '🌊',
    accent: '#2563EB',
    bg: '#F6F8FB',
    isDark: false,
    description: 'Clean professional enterprise blue'
  },
  {
    id: 'midnight-dark',
    label: 'Midnight Dark',
    icon: '🌙',
    accent: '#A78BFA',
    bg: '#0B1329',
    isDark: true,
    description: 'Deep contrast nighttime theme'
  },
  {
    id: 'ember-orange',
    label: 'Ember Orange',
    icon: '🔥',
    accent: '#FF4800',
    bg: '#FFF8F5',
    isDark: false,
    description: 'Energetic high-impact orange'
  },
  {
    id: 'forest-green',
    label: 'Forest Green',
    icon: '🌿',
    accent: '#059669',
    bg: '#F2FAF6',
    isDark: false,
    description: 'Modern organic emerald & teal'
  },
  {
    id: 'royal-purple',
    label: 'Royal Purple',
    icon: '💜',
    accent: '#7C3AED',
    bg: '#FAF7FF',
    isDark: false,
    description: 'Luxurious violet & indigo'
  },
  {
    id: 'slate-graphite',
    label: 'Slate Graphite',
    icon: '🪨',
    accent: '#475569',
    bg: '#F8FAFC',
    isDark: false,
    description: 'Minimalist executive slate & steel'
  }
];

export const DEFAULT_THEME_ID = 'ocean-blue';

export const getThemeById = (id) => {
  return THEMES.find((t) => t.id === id) || THEMES[0];
};

/**
 * Resolves the initial theme from localStorage or system preference.
 * Backwards compatible with legacy 'settings_theme' (Light Theme / Dark Theme)
 * and 'darkMode' keys.
 */
export const getStoredTheme = () => {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID;

  const directTheme = localStorage.getItem('app_theme');
  if (directTheme && THEMES.some((t) => t.id === directTheme)) {
    return directTheme;
  }

  const legacySettingsTheme = localStorage.getItem('settings_theme');
  if (legacySettingsTheme === 'Dark Theme') return 'midnight-dark';
  if (legacySettingsTheme === 'Light Theme') return 'ocean-blue';

  const legacyDarkMode = localStorage.getItem('darkMode');
  if (legacyDarkMode === 'true') return 'midnight-dark';
  if (legacyDarkMode === 'false') return 'ocean-blue';

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'midnight-dark';
  }

  return DEFAULT_THEME_ID;
};

/**
 * Applies a theme to the DOM by setting data-theme attribute and toggling the dark class.
 */
export const applyTheme = (themeId) => {
  if (typeof document === 'undefined') return;

  const themeObj = getThemeById(themeId);
  const targetId = themeObj.id;

  // Set data-theme on both root html and body for full CSS variable scoping
  document.documentElement.setAttribute('data-theme', targetId);
  if (document.body) {
    document.body.setAttribute('data-theme', targetId);
  }

  // Toggle .dark class according to theme definition
  if (themeObj.isDark) {
    document.documentElement.classList.add('dark');
    if (document.body) document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    if (document.body) document.body.classList.remove('dark');
  }

  // Sync localStorage
  localStorage.setItem('app_theme', targetId);
  localStorage.setItem('settings_theme', themeObj.isDark ? 'Dark Theme' : 'Light Theme');
  localStorage.setItem('darkMode', String(themeObj.isDark));

  // Dispatch custom event for reactive updates across components
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: targetId, themeObj } }));
};
