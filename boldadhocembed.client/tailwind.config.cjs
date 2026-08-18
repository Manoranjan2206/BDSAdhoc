/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Stitch Primary & Role Palette
        primary: {
          DEFAULT: '#5341cd',
          container: '#6c5ce7',
          fixed: '#e4dfff',
          'fixed-dim': '#c6bfff',
          'on-primary': '#ffffff',
          'on-container': '#faf6ff',
          // legacy compatibility
          25: '#FFFFFF',
          400: '#283A5E',
          600: '#131F3B',
        },
        'primary-container': '#6c5ce7',
        'primary-400': '#283A5E',
        'primary-600': '#131F3B',
        'on-primary': '#ffffff',
        'on-primary-container': '#faf6ff',

        // Role Color Identifiers (Non-negotiable)
        'role-admin': '#6c5ce7',
        'role-sales': '#3b82f6',
        'role-finance': '#10b981',
        'role-support': '#f97316',
        'role-ops': '#14b8a6',

        // Glassmorphic tokens
        'glass-bg': 'rgba(255, 255, 255, 0.7)',
        'glass-border': 'rgba(255, 255, 255, 0.3)',
        'glass-dark-bg': 'rgba(15, 23, 42, 0.75)',
        'glass-dark-border': 'rgba(255, 255, 255, 0.1)',

        // Surface palette
        surface: '#f8f9ff',
        'surface-bright': '#f8f9ff',
        'surface-dim': '#cbdbf5',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'surface-container-high': '#dce9ff',
        'surface-container-highest': '#d3e4fe',
        'surface-variant': '#d3e4fe',
        'surface-tint': '#5847d2',

        'on-surface': '#0b1c30',
        'on-surface-variant': '#474554',
        'inverse-surface': '#213145',
        'inverse-on-surface': '#eaf1ff',

        background: '#f8f9ff',
        'on-background': '#0b1c30',

        // Outline
        outline: '#787586',
        'outline-variant': '#c8c4d7',

        // Secondary & Status
        secondary: {
          DEFAULT: '#006c49',
          container: '#6cf8bb',
          'on-container': '#00714d',
          red: '#D22222',
          green: '#108910',
          blue: '#006CDD',
          yellow: '#FFAA00',
          cyan: '#00D5FF',
          purple: '#6C32E8',
          violet: '#9825AE',
          magenta: '#BE2452',
        },
        'secondary-container': '#6cf8bb',
        'on-secondary-container': '#00714d',
        'secondary-red': '#D22222',
        'secondary-green': '#108910',
        'secondary-blue': '#006CDD',
        'secondary-yellow': '#FFAA00',

        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'status-error': '#ef4444',
        'status-success': '#10b981',
        'status-warning': '#f59e0b',
        'status-info': '#3b82f6',

        // Neutral Palette
        neutral: {
          white: '#FFFFFF',
          50: '#F3F3F7',
          100: '#DDE0EB',
          200: '#B5BACA',
          300: '#7C84A1',
          400: '#505875',
          500: '#424A64',
          600: '#30364D',
          700: '#181C2C',
          black: '#000000',
        },
        'neutral-white': '#FFFFFF',
        'neutral-50': '#F3F3F7',
        'neutral-100': '#DDE0EB',
        'neutral-200': '#B5BACA',
        'neutral-300': '#7C84A1',
        'neutral-400': '#505875',
        'neutral-500': '#424A64',
        'neutral-600': '#30364D',
        'neutral-700': '#181C2C',

        // Legacy / Brand
        brand: {
          orange: '#FF4800',
          purple: '#6c5ce7',
        },
        'brand-orange': '#FF4800',
      },
      spacing: {
        'sidebar-width': '260px',
        'sidebar-collapsed': '72px',
        'header-height': '64px',
        gutter: '24px',
        'container-padding': '32px',
        'stack-sm': '8px',
        'stack-md': '16px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'headline-md': ['Inter', 'sans-serif'],
        'headline-lg': ['Inter', 'sans-serif'],
        'display-kpi': ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
        lift: '0 10px 25px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
