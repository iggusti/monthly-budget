import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { firebaseConfig } from './src/lib/firebase-config.ts';

const SERVICE_WORKER_FILE = 'firebase-messaging-sw.js';
const SERVICE_WORKER_TEMPLATE = 'src/service-worker/firebase-messaging-sw.js';

/**
 * Render the FCM service worker from its template.
 *
 * The template is committed with placeholders; the Firebase config comes from
 * `src/lib/firebase-config.ts` (the same object the app uses) and the SDK
 * version from the `firebase` dependency, so the worker can never drift.
 */
function renderServiceWorker(): string {
	const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
	const sdkVersion = String(pkg.dependencies?.firebase ?? '').replace(/^[^\d]*/, '') || '12.9.0';
	const template = readFileSync(new URL(`./${SERVICE_WORKER_TEMPLATE}`, import.meta.url), 'utf8');

	const output = template
		.replaceAll('__FIREBASE_SDK_VERSION__', sdkVersion)
		.replaceAll('__FIREBASE_CONFIG__', JSON.stringify(firebaseConfig, null, 2));

	if (output.includes('__FIREBASE')) {
		throw new Error('Unreplaced placeholder left in the generated service worker');
	}

	return output;
}

/**
 * Emit `/firebase-messaging-sw.js` at the site root.
 *
 * It has to be served from the root so its scope covers the whole app. In dev
 * it is generated on request; in a build it is emitted as a client asset, which
 * `adapter-static` then copies into `build/`.
 */
function firebaseServiceWorker(): Plugin {
	let isSsrBuild = false;

	return {
		name: 'firebase-service-worker',
		configResolved(config) {
			isSsrBuild = Boolean(config.build.ssr);
		},
		generateBundle() {
			if (isSsrBuild) return;
			this.emitFile({
				type: 'asset',
				fileName: SERVICE_WORKER_FILE,
				source: renderServiceWorker()
			});
		},
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (req.url?.split('?')[0] !== `/${SERVICE_WORKER_FILE}`) return next();
				res.setHeader('Content-Type', 'application/javascript');
				res.end(renderServiceWorker());
			});
		}
	};
}

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-static produces a fully static build for Firebase Hosting.
			// The fallback page lets dynamic routes (e.g. /month/[id]) work on
			// direct visits, since the app is client-rendered.
			// See https://svelte.dev/docs/kit/adapter-static for more information.
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: 'index.html',
				precompress: false,
				strict: false
			})
		}),
		firebaseServiceWorker()
	]
});
