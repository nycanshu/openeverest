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

import type React from 'react';

export interface ProviderParams {
  namespace: string;
  cluster: string;
  // TODO: Add currentValue?: string for filtering out unavailable options at edit time
}

export interface ProviderOptions {
  options: Array<{ label: string; value: string }>;
  isLoading: boolean;
  error: unknown;
  isEmpty: boolean;
  rawData?: unknown;
}

export interface EmptyStateFallbackProps {
  namespace: string;
  cluster: string;
}

export interface EmptyStateFallback {
  component: React.ComponentType<EmptyStateFallbackProps>;
}

/**
 * Scope of the Kubernetes resources a data-source provider resolves.
 *
 * - `namespace`: resources live in a namespace (MonitoringConfig, Secret,
 *   ConfigMap). For Instance Presets (which are cluster-scoped and carry no
 *   namespace), these fields are hidden and left empty.
 * - `cluster`: resources are cluster-scoped (StorageClass). For Instance
 *   Presets these remain selectable but may be left empty to defer to the
 *   cluster default.
 */
export type ProviderScope = 'namespace' | 'cluster';

export interface ProviderRegistryEntry {
  useOptions: (params: ProviderParams) => ProviderOptions;
  description: string;
  emptyStateFallback: EmptyStateFallback | null;
  // Scope of the resolved resources. Used to relax Instance Preset forms:
  // namespace-scoped fields are hidden/emptied, cluster-scoped fields allow empty.
  scope?: ProviderScope;
  // TODO: Add lifecycle hooks — beforeFetch, afterFetch, onError
  // TODO: Add optional `validate` callback for dev-time schema validation
}
