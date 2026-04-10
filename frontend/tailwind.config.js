/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#006B5E',
          dark: '#005249',
          light: '#008575',
        },
        accent: {
          DEFAULT: '#B5CC18',
          dark: '#94a814',
        },
        background: '#F0EFEA',
        danger: '#D85A30',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
