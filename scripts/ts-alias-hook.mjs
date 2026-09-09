/**
 * Teaches plain Node the '@/…' path alias from tsconfig.json, and the implicit
 * .ts extension, so the check scripts can import application modules directly.
 *
 * This exists so production code does not have to be written oddly to be
 * testable — lib/quote.ts imports '@/lib/rates' like every other module in the
 * codebase, and the awkwardness lives here in the harness instead.
 *
 * Used as:  node --import ./scripts/ts-alias-hook.mjs script.mjs
 */

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);

/** Node needs a real file; TypeScript source omits the extension. */
function withExtension(url) {
  if (existsSync(fileURLToPath(url))) return url;
  for (const ext of ['.ts', '.tsx', '.js', '.mjs']) {
    const candidate = new URL(url.href + ext);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  for (const index of ['/index.ts', '/index.tsx']) {
    const candidate = new URL(url.href + index);
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith('@/')
      ? specifier.slice(2)
      : // A bare relative import from inside a .ts file, which Node will not
        // extension-resolve on its own.
        null;

    if (relative !== null) {
      const resolved = withExtension(new URL(relative, ROOT));
      if (resolved) return { url: resolved.href, shortCircuit: true };
    }

    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
      const resolved = withExtension(new URL(specifier, context.parentURL));
      if (resolved) return { url: resolved.href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});

export { ROOT, pathToFileURL };
