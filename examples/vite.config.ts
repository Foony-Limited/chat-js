import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const chatRoot = path.resolve(here, '..');

/**
 * Vite config for the example browser client.
 *
 * Only `@foony/chat` is resolved to local TypeScript source (`../src`), so the example always
 * exercises the latest local chat code with no rebuild step; its dependencies `@foony/realtime`
 * and `@foony/global-store` come from npm (installed into node_modules) like a real consumer.
 * `dedupe` keeps a single copy of those — including the one `@foony/chat`'s source imports — so the
 * app and the chat layer share one realtime client and one React.
 */
export default defineConfig({
  root: path.resolve(here, 'client'),
  resolve: {
    alias: [
      {find: /^@foony\/chat$/, replacement: path.resolve(chatRoot, 'src/index.ts')},
    ],
    dedupe: ['react', 'react-dom', '@foony/realtime', '@foony/global-store'],
  },
  server: {
    port: 5181,
    fs: {allow: [chatRoot]},
  },
  plugins: [react()],
});
