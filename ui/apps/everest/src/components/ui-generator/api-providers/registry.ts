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

import type {
  ProviderRegistryEntry,
  ProviderOptions,
  ProviderParams,
} from './types';

class ApiProviderRegistry {
  private entries = new Map<string, ProviderRegistryEntry>();

  register(key: string, entry: ProviderRegistryEntry): void {
    if (this.entries.has(key) && !import.meta.hot) {
      throw new Error(
        `ApiProviderRegistry: provider "${key}" is already registered.`
      );
    }
    // Vite HMR re-runs providers.ts while this singleton survives — allow overwrite.
    this.entries.set(key, entry);
  }

  get(key: string): ProviderRegistryEntry | undefined {
    return this.entries.get(key);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  getAll(): Map<string, ProviderRegistryEntry> {
    return new Map(this.entries);
  }

  getAvailableKeys(): string[] {
    return Array.from(this.entries.keys());
  }
}

// Singleton registry instance
export const providerRegistry = new ApiProviderRegistry();

/**
 * Provider key for the StorageClass data source.
 *
 * StorageClass is the one data source that is cluster-scoped rather than
 * namespace-scoped: it resolves against the Kubernetes cluster and does not
 * need a namespace. Instance Presets are namespace-less, so this key is used to
 * special-case StorageClass — it stays populated from the API and may be left
 * empty ("use cluster default"), while every other (namespace-scoped) data
 * source is hidden in a preset. Keeping the key in one place avoids scattering
 * the magic string across the form pipeline.
 */
export const STORAGE_CLASS_PROVIDER = 'storageClasses';

/**
 * True when a data-source provider key refers to the cluster-scoped StorageClass
 * source. Every other provider is treated as namespace-scoped.
 */
export const isStorageClassProvider = (providerKey: string): boolean =>
  providerKey === STORAGE_CLASS_PROVIDER;

/**
 * Stable, shared result for the disabled (`enabled: false`) state.
 *
 * Returning a freshly built object/array here on every render would hand each
 * consumer a new `options` reference, defeating their useMemo/useEffect
 * dependency checks. In namespace-less forms (e.g. Instance Presets) that pass
 * `enabled: false`, that previously caused an infinite render loop: the
 * data-source reconciliation effect re-ran on every render and called
 * setValue(), which re-rendered, and so on. A module-level constant keeps the
 * reference identity stable so those effects settle after the first run.
 */
const DISABLED_PROVIDER_OPTIONS: ProviderOptions = {
  options: [],
  isLoading: false,
  error: null,
  isEmpty: true,
  rawData: undefined,
};

export const useProviderOptions = (
  providerKey: string,
  params: ProviderParams,
  options?: { enabled?: boolean }
): ProviderOptions => {
  const entry = providerRegistry.get(providerKey);

  if (!entry) {
    const available = providerRegistry.getAvailableKeys().join(', ');
    throw new Error(
      `Unknown API provider "${providerKey}". Available providers: ${available}`
    );
  }

  if (options?.enabled === false) {
    return DISABLED_PROVIDER_OPTIONS;
  }

  return entry.useOptions(params);
};
