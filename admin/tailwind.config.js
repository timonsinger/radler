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
        sidebar: '#14532D',
        'sidebar-hover': '#1a6b3a',
        primary: '#14532D',
        'primary-light': '#22C55E',
        accent: '#22C55E',
      },
    },
  },
  plugins: [],
};
