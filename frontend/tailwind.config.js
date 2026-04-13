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
        // Legacy aliases (keep for backwards compat)
        primary: '#2E7D32',
        'primary-dark': '#1B5E20',
        'primary-fg': '#FFFFFF',
        'primary-light': '#E8F5E9',
        surface: '#F3F4F6',
        error: '#E85D3A',

        // New brand palette
        radler: {
          green: {
            50: '#E8F5E9',
            100: '#C8E6C9',
            200: '#A5D6A7',
            300: '#66BB6A',
            400: '#43A047',
            500: '#2E7D32',
            600: '#1B5E20',
            700: '#0D3B0F',
          },
          cream: {
            50: '#FFFDF5',
            100: '#FFF8E7',
            200: '#FAEFD4',
            300: '#F0E4BE',
          },
          coral: {
            50: '#FFF0EC',
            100: '#FFDDD4',
            200: '#FFB9A8',
            300: '#FF8C6B',
            400: '#E85D3A',
            500: '#C44525',
          },
          ink: {
            100: '#F5F5F5',
            200: '#E0E0E0',
            300: '#BDBDBD',
            400: '#9E9E9E',
            500: '#6B6B6B',
            600: '#4A4A4A',
            700: '#2D2D2D',
            800: '#1A1A1A',
          },
        },
      },
      fontFamily: {
        heading: ['Sora', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
