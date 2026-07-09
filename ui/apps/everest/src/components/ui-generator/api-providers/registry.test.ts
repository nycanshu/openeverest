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

import { describe, expect, it } from 'vitest';
import { providerRegistry, useProviderOptions } from './index';

describe('ApiProviderRegistry', () => {
  it('built-in providers are registered via side-effect import', () => {
    expect(providerRegistry.has('monitoringConfigs')).toBe(true);
    expect(providerRegistry.has('storageClasses')).toBe(true);
  });

  it('useProviderOptions throws for unknown provider key', () => {
    expect(() =>
      useProviderOptions('nonExistent', { namespace: 'ns', cluster: 'cl' })
    ).toThrow('Unknown API provider');
  });

  it('useProviderOptions returns a stable reference when disabled', () => {
    // Regression: a fresh object/array on every call gave consumers a new
    // `options` reference each render, causing an infinite render loop in
    // namespace-less forms (Instance Presets). The disabled result must be
    // referentially stable so dependent effects settle.
    const params = { namespace: '', cluster: '' };
    const first = useProviderOptions('monitoringConfigs', params, {
      enabled: false,
    });
    const second = useProviderOptions('storageClasses', params, {
      enabled: false,
    });

    expect(first).toBe(second);
    expect(first.options).toBe(second.options);
    expect(first).toMatchObject({
      options: [],
      isLoading: false,
      error: null,
      isEmpty: true,
    });
  });
});
