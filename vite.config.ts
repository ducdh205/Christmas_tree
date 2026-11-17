import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const MUSIC_DIR = path.join(root, 'public', 'music');
const AUDIO = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;

/**
 * `import playlist from 'virtual:playlist'` → the audio files in public/music/,
 * sorted by name. Adding or removing a file reloads the page in dev.
 */
function playlist(): Plugin {
  const id = 'virtual:playlist';
  const resolved = '\0' + id;
  const list = () => {
    try {
      return fs.readdirSync(MUSIC_DIR).filter((f) => AUDIO.test(f)).sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  };
  return {
    name: 'playlist',
    resolveId: (i) => (i === id ? resolved : undefined),
    load: (i) => (i === resolved ? `export default ${JSON.stringify(list())};` : undefined),
    configureServer(server) {
      server.watcher.add(MUSIC_DIR);
      const refresh = (file: string) => {
        if (!path.resolve(file).startsWith(MUSIC_DIR) || !AUDIO.test(file)) return;
        const mod = server.moduleGraph.getModuleById(resolved);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}

export default defineConfig({
  plugins: [playlist()],
});
