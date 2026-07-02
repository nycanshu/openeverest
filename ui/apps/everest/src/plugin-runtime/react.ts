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

// Import-map shim: exposes React as ESM named exports to plugin bundles.
//
// `react` is a CommonJS module. Rollup wraps it, but `export * from 'react'`
// does not propagate the named exports across the CJS boundary — the emitted
// chunk ends up with only synthetic wrappers, so plugin bundles that do
// `import { useCallback } from 'react'` fail with
// "does not provide an export named 'useCallback'". Destructuring the default
// namespace at module top-level produces real ESM named exports Rollup can
// see, at the cost of listing React's public API here explicitly.
//
// If a plugin needs a React export that isn't listed below, add it here and
// rebuild the host. Keep this list in sync with React 18's public API.
import React from 'react';

export default React;

// Hooks
export const {
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} = React;

// Top-level API + component primitives
export const {
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  version,
} = React;
