import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        desert: {
          bg: 'var(--bg)',
          'bg-secondary': 'var(--bg-secondary)',
          surface: 'var(--surface)',
          'surface-hover': 'var(--surface-hover)',
          border: 'var(--border)',
          'border-strong': 'var(--border-strong)',
          text: 'var(--text)',
          'text-2': 'var(--text-2)',
          'text-3': 'var(--text-3)',
          accent: 'var(--accent)',
          'accent-glow': 'var(--accent-glow)',
          'accent-dim': 'var(--accent-dim)',
          success: 'var(--success)',
          'success-dim': 'var(--success-dim)',
          warning: 'var(--warning)',
          'warning-dim': 'var(--warning-dim)',
          danger: 'var(--danger)',
          'danger-dim': 'var(--danger-dim)',
          mystic: 'var(--mystic)',
          'mystic-dim': 'var(--mystic-dim)',
          celestial: 'var(--celestial)',
          'celestial-dim': 'var(--celestial-dim)',
          forest: 'var(--forest)',
          'forest-dim': 'var(--forest-dim)',
          ocean: 'var(--ocean)',
          clay: 'var(--clay)',
          driftwood: 'var(--driftwood)',
        },
      },
      fontFamily: {
        pixel: ['var(--font-pixel)', 'cursive'],
        mono: ['var(--font-mono)', 'monospace'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
