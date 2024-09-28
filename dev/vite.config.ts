import { defineConfig } from 'vite'
import cssModuleClassnames from 'vite-plugin-css-classnames'
import solidPlugin from 'vite-plugin-solid'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: './',
  plugins: [
    cssModuleClassnames(),
    tsconfigPaths(),
    solidPlugin({
      babel: { plugins: [['@babel/plugin-proposal-decorators', { version: '2023-05' }]] },
    }),
    {
      name: 'Reaplace env variables',
      transform(code, id) {
        if (id.includes('node_modules')) {
          return code
        }
        return code
          .replace(/process\.env\.SSR/g, 'false')
          .replace(/process\.env\.DEV/g, 'true')
          .replace(/process\.env\.PROD/g, 'false')
          .replace(/process\.env\.NODE_ENV/g, '"development"')
          .replace(/import\.meta\.env\.SSR/g, 'false')
          .replace(/import\.meta\.env\.DEV/g, 'true')
          .replace(/import\.meta\.env\.PROD/g, 'false')
          .replace(/import\.meta\.env\.NODE_ENV/g, '"development"')
      },
    },
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    minify: false,
  },
})
