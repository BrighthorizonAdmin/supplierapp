/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff5ff',
          100: '#dde8ff',
          200: '#c2d5ff',
          300: '#97b8fd',
          400: '#6690f8',
          500: '#3f6cf1',
          600: '#2853e0',
          700: '#1f45c4',
          800: '#1f3b9e',
          900: '#1e357d',
        },
        // Neutral "ink" scale used by the app shell
        canvas: '#f4f5f7',
        sidebar: '#f8f9fb',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.03)',
        'card-hover': '0 4px 16px rgba(16, 24, 40, 0.08)',
        brand: '0 6px 16px -4px rgba(40, 83, 224, 0.45)',
        pop: '0 12px 32px -8px rgba(16, 24, 40, 0.18)',
      },
    },
  },
  plugins: [],
};
