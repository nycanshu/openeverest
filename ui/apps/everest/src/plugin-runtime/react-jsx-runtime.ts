// Import-map shim: exposes react/jsx-runtime as ESM named exports.
// See the comment in ./react.ts for why explicit destructuring is required.
import * as JSXRuntime from 'react/jsx-runtime';

export const { jsx, jsxs, Fragment } = JSXRuntime;
