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
        // Brand Colors
        brand: {
          orange: '#FF4800',
        },
        // Primary Colors
        primary: {
          25: '#FFFFFF',
          400: '#283A5E',
          600: '#131F3B',
        },
        // Secondary Colors
        secondary: {
          red: '#D22222',
          green: '#108910',
          blue: '#006CDD',
          yellow: '#FFAA00',
          cyan: '#00D5FF',
          purple: '#6C32E8',
          violet: '#9825AE',
          magenta: '#BE2452',
        },
        // Neutral Colors
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
        // Legacy colors (maintained for compatibility)
        'accent-1': '#FB923C',
        'accent-2': '#06B6D4',
        'accent-3': '#F472B6',
        'accent-4': '#10B981',
        surface: '#0F172A',
        'bg-light': '#F8FAFC',
      },
      fontFamily: {
        sans: ['system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
