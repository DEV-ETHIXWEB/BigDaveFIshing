// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  // Wraps Astro's own sharp service to raise the default encode quality from 80 to 90.
  // See src/lib/image-service.ts for why. sharp is a direct dependency now rather than
  // something inherited from Astro's own tree.
  image: {
    service: { entrypoint: './src/lib/image-service.ts' },
  },

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['lucide-react'],
    },
    // Adding a new React island used to make the dev server discover React's runtime
    // late, re-optimise mid-session, and then serve a stale bundle: every island on the
    // site died with `504 (Outdated Optimize Dep)` and `_jsxDEV is not a function`,
    // including ones that had been working. Pre-declaring these means the dep graph is
    // known at startup and a new island cannot invalidate it.
    // Production builds were never affected - they use jsx-runtime, not the dev runtime.
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
    },
  },

  adapter: vercel(),
});
