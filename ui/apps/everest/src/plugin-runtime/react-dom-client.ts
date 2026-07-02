// Import-map shim: exposes react-dom/client as ESM named exports.
// See the comment in ./react.ts for why explicit destructuring is required.
import * as ReactDOMClient from 'react-dom/client';

export const { createRoot, hydrateRoot } = ReactDOMClient;
