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

// Import-map shim: exposes react/jsx-runtime as ESM named exports.
// See the comment in ./react.ts for why explicit destructuring is required.
import * as JSXRuntime from 'react/jsx-runtime';

export const { jsx, jsxs, Fragment } = JSXRuntime;
