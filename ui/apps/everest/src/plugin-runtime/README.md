# Plugin runtime shims

Each file in this folder re-exports a package the host provides to plugin bundles
as a **singleton** via a browser [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap).

The `plugin-runtime-import-map` Vite plugin (`../../vite-plugins/plugin-runtime-import-map.ts`):

- Adds each shim as an additional Rollup entry so it becomes a stable, hashed
  chunk in the production build.
- Injects a `<script type="importmap">` into `index.html` that maps bare
  specifiers (`react`, `@mui/material`, `@emotion/react`, …) to the shim URLs.

Because the shims re-export from the same package the host itself imports,
Rollup deduplicates the underlying module. Both the host and any dynamically
loaded plugin bundle end up sharing the same instance of React, MUI, Emotion,
and react-router, which is what makes `<ThemeProvider>` context inheritance,
custom variants, `styleOverrides`, and hooks work across the boundary.

Deep sub-paths (e.g. `@mui/material/Button`) are intentionally **not** mapped —
plugins should use named imports (`import { Button } from '@mui/material'`).
