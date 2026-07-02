// Import-map shim: exposes react-dom as ESM named exports.
// See the comment in ./react.ts for why explicit destructuring is required
// instead of `export * from 'react-dom'`.
import ReactDOM from 'react-dom';

// eslint-disable-next-line import/no-default-export
export default ReactDOM;

export const {
  createPortal,
  findDOMNode,
  flushSync,
  hydrate,
  render,
  unmountComponentAtNode,
  unstable_batchedUpdates,
  version,
} = ReactDOM;
