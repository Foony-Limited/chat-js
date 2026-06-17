import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const chatRoot = path.resolve(here, '..');
const realtimeRoot = path.resolve(here, '../../realtime-js');

/**
 * Vite config for the example browser client.
 *
 * Resolves both `@foony/chat` and its `@foony/realtime` dependency to their TypeScript sources
 * (`../src` and `../../realtime-js/src`) rather than built output, so the example always exercises
 * the latest local code with no rebuild step. The dev server is granted fs access to both SDK
 * roots so it can serve that source.
 */
export default defineConfig({
  root: path.resolve(here, 'client'),
  resolve: {
    alias: [
      {find: /^@foony\/chat$/, replacement: path.resolve(chatRoot, 'src/index.ts')},
      {find: /^@foony\/realtime$/, replacement: path.resolve(realtimeRoot, 'src/index.ts')},
    ],
  },
  server: {
    port: 5181,
    fs: {allow: [chatRoot, realtimeRoot]},
  },
  plugins: [react()],
});
