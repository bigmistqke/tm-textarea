import path from 'path'
import { defineConfig, normalizePath } from 'vite'
import cssClassnames from 'vite-plugin-css-classnames'
import dts from 'vite-plugin-dts'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import solid from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    cssClassnames(),
    tsconfigPaths(),
    solid({
      babel: {
        plugins: [['@babel/plugin-proposal-decorators', { version: '2023-05' }]],
      },
    }),
    libInjectCss(),
    dts(),
  ],
  server: { port: 3000 },
  build: {
    lib: {
      entry: {
        index: normalizePath(path.resolve(__dirname, 'src/index.tsx')),
        solid: normalizePath(path.resolve(__dirname, 'src/solid.tsx')),
        'tm/index': normalizePath(path.resolve(__dirname, 'src/tm/index.ts')),
        cdn: normalizePath(path.resolve(__dirname, 'src/cdn.ts')),
        core: normalizePath(path.resolve(__dirname, 'src/core.tsx')),
      },
      name: 'solid-tm-textarea',
      formats: ['es'],
    },
    minify: false,
    rollupOptions: {
      external: ['solid-js', 'solid-js/web'],
      output: {
        globals: {
          'solid-js': 'SolidJS',
        },
      },
    },
  },
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
})
