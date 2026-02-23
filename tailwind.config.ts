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
        // RGB-channel format so Tailwind opacity modifiers work:
        // e.g. bg-background/80, border-border/40, text-text/60
        background:      'rgb(var(--clr-bg) / <alpha-value>)',
        surface:         'rgb(var(--clr-surface) / <alpha-value>)',
        'surface-up':    'rgb(var(--clr-surface-up) / <alpha-value>)',
        border:          'rgb(var(--clr-border) / <alpha-value>)',
        text:            'rgb(var(--clr-text) / <alpha-value>)',
        'text-secondary':'rgb(var(--clr-text-sec) / <alpha-value>)',
        'text-muted':    'rgb(var(--clr-text-muted) / <alpha-value>)',

        // Fixed brand / semantic colors (no theming needed)
        accent:        '#6C3BFF',
        'accent-hover':'#7C4FFF',
        upvote:        '#22C55E',
        downvote:      '#EF4444',
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
