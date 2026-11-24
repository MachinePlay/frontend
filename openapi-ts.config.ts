import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: './openapi.json',
  output: './src/api/generated',
  // Types only; src/api.ts makes the calls by hand.
  plugins: ['@hey-api/typescript'],
})
