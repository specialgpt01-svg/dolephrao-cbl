/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/index.html.bak',
    './public/**/*.{html,js}',
    './resources/**/*.php',
  ],
  theme: {
    extend: {
      colors: {
        'emerald-deep': '#064e3b',
        'emerald-dk': '#059669',
        'emerald-app': '#10b981',
        primary: '#10b981',
        coral: '#10b981',
        peach: '#34d399',
        gold: '#fbbf24',
      },
      fontFamily: {
        prompt: ['Prompt', 'sans-serif'],
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
