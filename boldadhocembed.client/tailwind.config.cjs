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
        // === Unified Design System: Dynamically Theme-Aware ===
        primary: {
          DEFAULT: 'var(--primary, #5b4ce6)',
          50: 'var(--brand-100, #f4f2ff)',
          100: 'var(--brand-100, #eae6ff)',
          200: 'var(--brand-200, #d5ceff)',
          300: 'var(--primary-light, #b8abff)',
          400: 'var(--primary-light, #9a84ff)',
          500: 'var(--brand-500, #7c5eff)',
          600: 'var(--brand-600, #5b4ce6)',
          700: 'var(--brand-700, #4a3bc4)',
          800: 'var(--brand-700, #3b2fa0)',
          900: 'var(--brand-700, #2d237d)',
          container: 'var(--primary-soft, #eae6ff)',
          'on-primary': '#ffffff',
          'on-container': 'var(--primary-dark, #2d237d)',
        },

        // Role Color Identifiers
        'role-admin': 'var(--role-admin, #5b4ce6)',
        'role-sales': 'var(--role-sales, #3b82f6)',
        'role-finance': 'var(--role-finance, #10b981)',
        'role-support': 'var(--role-support, #f97316)',
        'role-ops': 'var(--role-ops, #14b8a6)',

        // Glassmorphic tokens
        'glass-bg': 'var(--glass-bg, rgba(255, 255, 255, 0.7))',
        'glass-border': 'var(--glass-border, rgba(255, 255, 255, 0.3))',
        'glass-dark-bg': 'var(--glass-bg, rgba(15, 23, 42, 0.75))',
        'glass-dark-border': 'var(--glass-border, rgba(255, 255, 255, 0.1))',

        // Surface palette
        surface: 'var(--surface, #ffffff)',
        'surface-bright': 'var(--surface, #ffffff)',
        'surface-dim': 'var(--neutral-100, #e2e7f0)',
        'surface-container': 'var(--surface, #ffffff)',
        'surface-container-low': 'var(--neutral-50, #f9fafc)',
        'surface-container-high': 'var(--neutral-100, #eff2f7)',
        'surface-container-highest': 'var(--neutral-200, #e8ecf3)',
        'surface-variant': 'var(--neutral-100, #e2e7f0)',

        'on-surface': 'var(--text-strong, #111827)',
        'on-surface-variant': 'var(--text-secondary, #526078)',
        'inverse-surface': 'var(--neutral-700, #1e293b)',
        'inverse-on-surface': 'var(--neutral-50, #f1f5f9)',

        background: 'var(--background, #f6f8fb)',
        'on-background': 'var(--text-primary, #111827)',

        // Outline
        outline: 'var(--border, #94a3b8)',
        'outline-variant': 'var(--border, #dfe5ee)',

        // === Semantic Status Colors ===
        info: {
          DEFAULT: '#2563eb',
          soft: '#eaf2ff',
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        success: {
          DEFAULT: '#059669',
          soft: '#e8f8f2',
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          DEFAULT: '#d97706',
          soft: '#fff5df',
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          DEFAULT: '#dc2626',
          soft: '#feeeee',
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },

        // Neutral Palette
        neutral: {
          white: '#FFFFFF',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          black: '#000000',
        },

        // Brand accent (orange - now limited to warning/attention contexts only)
        brand: {
          orange: '#d97706',
          purple: '#5b4ce6',
        },
        'brand-orange': '#d97706',
        'brand-purple': '#5b4ce6',
      },
      spacing: {
        'sidebar-width': '148px',
        'sidebar-collapsed': '56px',
        'header-height': '64px',
        gutter: '24px',
        'container-padding': '32px',
        'stack-sm': '8px',
        'stack-md': '16px',
        'space-1': '4px',
        'space-2': '8px',
        'space-3': '12px',
        'space-4': '16px',
        'space-5': '20px',
        'space-6': '24px',
        'space-8': '32px',
        'space-10': '40px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'kpi': ['2.125rem', { lineHeight: '1.2', fontWeight: '700' }],
        'page-title': ['1.75rem', { lineHeight: '1.25', fontWeight: '700' }],
        'section-title': ['1.25rem', { lineHeight: '1.25', fontWeight: '650' }],
        'body': ['0.9375rem', { lineHeight: '1.5' }],
        'secondary': ['0.875rem', { lineHeight: '1.5' }],
        'compact': ['0.8125rem', { lineHeight: '1.4' }],
        'label': ['0.75rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        control: '0.5rem',
        card: '0.875rem',
        panel: '1.25rem',
        pill: '9999px',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 4px 14px rgba(15, 23, 42, 0.06)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.08)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.06)',
        lift: '0 8px 20px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
}
