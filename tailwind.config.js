/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        basalt: { DEFAULT: '#1F2A2E', soft: '#2B3A3F' },
        teal: { DEFAULT: '#0F5C5A', dark: '#0B4745', light: '#E3EFEE' },
        marigold: '#F2B632',
        stone: '#EEF0EC',
        line: '#D9DED9',
        muted: '#5B6B6E',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Public Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      maxWidth: { page: '76rem' },
    },
  },
  plugins: [],
};
