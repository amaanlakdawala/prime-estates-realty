/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './features/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Deep navy and royal blue with cool greys: modern and corporate.
      colors: {
        ink: { DEFAULT: '#0B1324', soft: '#18233B' }, // text, dark sections, footer
        brand: { DEFAULT: '#2B59E8', dark: '#1F45C2', light: '#ECF1FF' }, // buttons, links, highlights
        accent: '#8AB4FF', // highlights on dark backgrounds
        mist: '#F4F6FB', // light section backgrounds
        line: '#E3E8F1',
        muted: '#5A6478',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      maxWidth: { page: '76rem' },
      boxShadow: {
        card: '0 1px 2px rgb(11 19 36 / 0.04), 0 8px 24px -12px rgb(11 19 36 / 0.12)',
        lift: '0 2px 4px rgb(11 19 36 / 0.04), 0 24px 48px -16px rgb(11 19 36 / 0.22)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slow-zoom': { from: { transform: 'scale(1)' }, to: { transform: 'scale(1.08)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        glow: { '0%, 100%': { opacity: '0.55' }, '50%': { opacity: '0.85' } },
        ping: { '75%, 100%': { transform: 'scale(1.6)', opacity: '0' } },
      },
      animation: {
        'fade-up': 'fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 1s ease-out both',
        'slow-zoom': 'slow-zoom 18s ease-in-out infinite alternate',
        float: 'float 7s ease-in-out infinite',
        glow: 'glow 6s ease-in-out infinite',
        'ping-slow': 'ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
