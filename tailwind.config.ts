import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // Включаем темную тему через класс
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'amatic-sc': ['var(--font-amatic-sc)', 'cursive'],
      },
      colors: {
        primary: {
          50: '#e0f2fe',
          100: '#bae6fd',
          200: '#7dd3fc',
          300: '#38bdf8',
          400: '#0ea5e9',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
        },
        brand: {
          light: '#87ceeb', // Светло-голубой
          DEFAULT: '#5fb3d3', // Основной светло-голубой
          dark: '#4a9bc4', // Темнее для hover
        },
      },
    },
  },
  plugins: [],
}
export default config

