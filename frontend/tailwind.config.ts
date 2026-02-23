import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#09111c',
        panel: '#14263b',
        panelAlt: '#1b3150',
        line: '#294667',
        mint: '#65f7b5'
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(101, 247, 181, 0.55)'
      }
    }
  },
  plugins: []
};

export default config;
