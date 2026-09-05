import type { Config } from 'tailwindcss';

export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      transitionTimingFunction: { stage: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      transitionDuration: { stage: '280ms' },
    },
  },
  plugins: [],
} satisfies Config;
