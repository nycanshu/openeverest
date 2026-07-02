// Import-map shim: exposes react/jsx-dev-runtime as ESM named exports.
// See the comment in ./react.ts for why explicit destructuring is required.
import * as JSXDevRuntime from 'react/jsx-dev-runtime';

export const { jsxDEV, Fragment } = JSXDevRuntime;
