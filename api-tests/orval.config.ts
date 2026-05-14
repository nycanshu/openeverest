import { defineConfig } from 'orval'

export default defineConfig({
  'http-api': {
    input: {
      target: '../api/openapi/http-api.yaml',
    },
    output: {
      target: './generated/http-api.client.gen.ts',
      mode: 'single',
      client: 'fetch',
      baseUrl: '',
      override: {
        mutator: {
          path: './helpers/playwright-fetcher.ts',
          name: 'playwrightFetcher',
        },
      },
    },
  },
})
