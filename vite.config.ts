import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';

const SERVICE_WORKER_FILE = 'service-worker.js';
const SERVICE_WORKER_TEMPLATE = 'src/service-worker/service-worker.js';
const APP_VERSION = process.env.APP_VERSION ?? String(Date.now());

/** Render the app-shell service worker from its template. */
function renderServiceWorker(): string {
	const template = readFileSync(new URL(`./${SERVICE_WORKER_TEMPLATE}`, import.meta.url), 'utf8');
	const output = template.replaceAll('__APP_VERSION__', APP_VERSION);

	if (output.includes('__APP_VERSION__')) {
		throw new Error('Unreplaced placeholder left in the generated service worker');
	}

	try {
		new Function(output);
	} catch (error) {
		throw new Error(`Generated service worker is invalid: ${String(error)}`);
	}

	return output;
}

/**
 * Emit `/service-worker.js` at the site root.
 *
 * It has to be served from the root so its scope covers the whole app. In dev
 * it is generated on request; in a build it is emitted as a client asset, which
 * `adapter-static` then copies into `build/`.
 */
function appServiceWorker(): Plugin {
	let isSsrBuild = false;

	return {
		name: 'app-service-worker',
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
	define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
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
		appServiceWorker()
	]
});
