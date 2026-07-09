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

import { CrdsGen, HttpApi } from '@generated/api-types';

export type GetProviders = CrdsGen.components['schemas']['ProviderList'];
export type Provider = CrdsGen.components['schemas']['Provider'];
export type MonitoringConfig =
  CrdsGen.components['schemas']['MonitoringConfig'];
export type MonitoringConfigList =
  CrdsGen.components['schemas']['MonitoringConfigList'];
export type MonitoringConfigCreateParams =
  HttpApi.components['schemas']['MonitoringConfigCreateParams'];
export type MonitoringConfigUpdateParams =
  HttpApi.components['schemas']['MonitoringConfigUpdateParams'];
export type GetInstances = CrdsGen.components['schemas']['InstanceList'];
export type Instance = CrdsGen.components['schemas']['Instance'];
export type InstanceConnectionDetails =
  CrdsGen.components['schemas']['InstanceConnectionDetails'];
export type PhaseType = NonNullable<Instance['status']>['phase'];

export type CreateDbInstancePayload =
  HttpApi.paths['/clusters/{cluster}/namespaces/{namespace}/instances']['post']['requestBody']['content']['application/json'];
export type GetDbInstanceConnectionPayload =
  HttpApi.paths['/clusters/{cluster}/namespaces/{namespace}/instances/{instance}/connection']['get']['responses']['200']['content']['application/json'];
export type GetDbInstancePayload =
  HttpApi.paths['/clusters/{cluster}/namespaces/{namespace}/instances/{instance}']['get']['responses']['200']['content']['application/json'];
export type GetDbInstancesPayload =
  HttpApi.paths['/clusters/{cluster}/namespaces/{namespace}/instances']['get']['responses']['200']['content']['application/json'];
export type UpdateDbInstancePayload =
  HttpApi.paths['/clusters/{cluster}/namespaces/{namespace}/instances/{instance}']['put']['requestBody']['content']['application/json'];

export type GetNamespacesPayload =
  HttpApi.components['schemas']['NamespaceList'];

// InstancePreset is a cluster-scoped configuration template that mirrors the
// Instance spec (InstancePresetSpec inlines InstanceSpec on the backend), so
// its spec is structurally identical to an Instance. The generated Instance
// metadata is an empty object, so a usable ObjectMeta-like metadata is declared
// here for the UI (name, annotations, etc.).
export type InstancePresetMetadata = {
  name?: string;
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
  creationTimestamp?: string;
  resourceVersion?: string;
  [key: string]: unknown;
};

export type InstancePreset = {
  apiVersion?: string;
  kind?: string;
  metadata?: InstancePresetMetadata;
  spec?: Instance['spec'];
  status?: {
    conditions?: unknown[];
  };
};

export type InstancePresetList = {
  apiVersion?: string;
  kind?: string;
  metadata?: Record<string, unknown>;
  items: InstancePreset[];
};

export type CreateInstancePresetFromInstanceParams = {
  name: string;
  instanceName: string;
  instanceNamespace: string;
};
