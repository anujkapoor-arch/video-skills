import {defineConfig} from 'vite';
import motionCanvas from '@revideo/vite-plugin';

// Only used by `npm start` (the Revideo editor/preview). `npm run render` builds its own Vite server.
export default defineConfig({
  plugins: [motionCanvas({project: './src/project.ts'})],
});
