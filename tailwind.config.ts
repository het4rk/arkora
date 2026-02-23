import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#141414',
        'surface-up': '#1C1C1C',
        border: '#2A2A2A',
        accent: '#6C3BFF',
        'accent-hover': '#7C4FFF',
        text: '#FFFFFF',
        'text-secondary': '#A0A0A0',
        'text-muted': '#606060',
        upvote: '#22C55E',
        downvote: '#EF4444',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      screens: {
        xs: '390px',
      },
      height: {
        screen: '100dvh',
      },
    },
  },
  plugins: [],
}

export default config
