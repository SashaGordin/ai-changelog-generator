/** @type {import('tailwindcss').Config} */
module.exports = {
  // Explicitly set darkMode to 'class', which requires manual toggling
  // (thereby preventing automatic system preference-based dark mode)
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}