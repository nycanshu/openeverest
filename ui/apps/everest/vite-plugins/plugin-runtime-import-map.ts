// Copyright (C) 2026 The OpenEverest Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import path from 'path';
import { fileURLToPath } from 'url';
import type { Plugin, ResolvedConfig } from 'vite';

// Bare specifier → shim file basename (relative to src/plugin-runtime/, no extension).
// The set is intentionally frozen: adding a new singleton is a breaking change
// to the plugin runtime contract because plugin bundles are built against it.
const SPECIFIERS: ReadonlyArray<readonly [string, string]> = [
  ['react', 'react'],
  ['react-dom', 'react-dom'],
  ['react-dom/client', 'react-dom-client'],
  ['react/jsx-runtime', 'react-jsx-runtime'],
  ['react/jsx-dev-runtime', 'react-jsx-dev-runtime'],
  ['@mui/material', 'mui-material'],
  ['@mui/material/styles', 'mui-material-styles'],
  ['@mui/icons-material', 'mui-icons-material'],
  ['@mui/x-date-pickers', 'mui-x-date-pickers'],
  ['@emotion/react', 'emotion-react'],
  ['@emotion/styled', 'emotion-styled'],
  ['@emotion/cache', 'emotion-cache'],
  ['react-router-dom', 'react-router-dom'],
  ['@openeverest/plugin-sdk', 'plugin-sdk'],
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHIM_DIR = path.resolve(__dirname, '../src/plugin-runtime');

const shimAbs = (basename: string) => path.join(SHIM_DIR, `${basename}.ts`);
const shimRelUrl = (basename: string) => `/src/plugin-runtime/${basename}.ts`;

export function pluginRuntimeImportMap(): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: 'openeverest:plugin-runtime-import-map',

    config(userCfg) {
      const existingInput = userCfg.build?.rollupOptions?.input;
      const baseInput: Record<string, string> =
        typeof existingInput === 'string'
          ? { main: existingInput }
          : Array.isArray(existingInput)
            ? Object.fromEntries(
                existingInput.map((f, i) => [`entry-${i}`, f])
              )
            : ((existingInput as Record<string, string> | undefined) ?? {
                main: path.resolve(process.cwd(), 'index.html'),
              });

      const shimInputs: Record<string, string> = {};
      for (const [, basename] of SPECIFIERS) {
        shimInputs[`plugin-runtime-${basename}`] = shimAbs(basename);
      }

      return {
        build: {
          manifest: true,
          rollupOptions: {
            input: { ...baseInput, ...shimInputs },
            // In app-mode builds Rollup defaults to `'exports-only'`, which
            // tree-shakes away any exported binding no other module in the
            // graph imports. That kills the shims — plugin bundles are
            // *external* consumers loaded at runtime through the browser
            // import map, so Rollup can't see the imports at build time.
            // `'strict'` preserves the declared exports verbatim.
            preserveEntrySignatures: 'strict',
          },
        },
      };
    },

    configResolved(c) {
      resolvedConfig = c;
    },

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const imports: Record<string, string> = {};

        // Dev: Vite dev server serves .ts source files transformed on-the-fly.
        // The shim files re-export from the underlying package, which Vite has
        // already pre-bundled via optimizeDeps, so plugin and host share it.
        if (ctx.server) {
          for (const [spec, basename] of SPECIFIERS) {
            imports[spec] = shimRelUrl(basename);
          }
        } else {
          // Build: look up each shim's emitted chunk from the OutputBundle.
          const bundle = ctx.bundle;
          if (!bundle) return html;

          const norm = (p: string) => path.resolve(p);
          const targetById = new Map<string, string>();
          for (const [spec, basename] of SPECIFIERS) {
            targetById.set(norm(shimAbs(basename)), spec);
          }

          for (const chunk of Object.values(bundle)) {
            if (chunk.type !== 'chunk') continue;
            const facadeId = chunk.facadeModuleId;
            if (!facadeId) continue;
            const spec = targetById.get(norm(facadeId));
            if (!spec) continue;
            const base = resolvedConfig?.base ?? '/';
            imports[spec] = `${base}${chunk.fileName}`;
          }
        }

        const nonce = extractCspNonce(html);
        const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
        const script =
          `    <script type="importmap"${nonceAttr}>\n` +
          `${JSON.stringify({ imports }, null, 2)
            .split('\n')
            .map((line) => '      ' + line)
            .join('\n')}\n` +
          `    </script>`;
        return html.replace('</head>', `${script}\n  </head>`);
      },
    },
  };
}

function extractCspNonce(html: string): string | null {
  const match = html.match(
    /<meta\s+name=["']csp-nonce["']\s+content=["']([^"']*)["']/i
  );
  return match?.[1] ?? null;
}
