import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      colors: {
        blackout: '#131722',
        highlight: '#e7e9ec',
        // Surface tokens matching @epam/ai-dial-ui-kit / DIAL Admin. The --bg-layer-* vars are
        // set only when a live DIAL theme is applied, so the hex fallbacks (the ui-kit's dark
        // defaults) are required for the panels (e.g. bg-layer-2 cards) to render standalone.
        'layer-0': 'var(--bg-layer-0, #000000)',
        'layer-1': 'var(--bg-layer-1, #0C101D)',
        'layer-2': 'var(--bg-layer-2, #161B2D)',
        'layer-3': 'var(--bg-layer-3, #1D2439)',
        'layer-4': 'var(--bg-layer-4, #242C42)',
      },
      // Named the same as DIAL Admin's config so its components port over verbatim. Border and text
      // "primary/secondary" map to different ui-kit vars, so they live in the scoped scales below.
      borderColor: {
        primary: 'var(--stroke-primary, #696E7C)',
      },
      textColor: {
        secondary: 'var(--text-secondary, #9FA6BD)',
      },
    },
  },
};

export default config;
