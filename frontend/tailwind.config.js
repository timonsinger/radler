/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4ADE80',       // hellgrün
        'primary-dark': '#22C55E', // mittleres grün (hover)
        'primary-fg': '#14532D',   // dunkelgrün (Logo) – Text auf primary bg
        'primary-light': '#DCFCE7', // sehr helles grün (Hintergründe)
        surface: '#F3F4F6',
        error: '#EF4444',
      },
    },
  },
  plugins: [],
};
