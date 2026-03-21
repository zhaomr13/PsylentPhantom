/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        thunder: { DEFAULT: '#FFD700', dark: '#4A0080' },
        heat: { DEFAULT: '#FF4500', dark: '#8B0000' },
        psychic: { DEFAULT: '#9370DB', dark: '#191970' },
        fate: { DEFAULT: '#00CED1', dark: '#FFD700' },
        space: { DEFAULT: '#4169E1', dark: '#00FFFF' },
        spirit: { DEFAULT: '#FF69B4', dark: '#8A2BE2' },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
      },
    },
  },
  plugins: [],
};
