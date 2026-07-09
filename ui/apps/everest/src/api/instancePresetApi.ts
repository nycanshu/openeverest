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

import {
  CreateInstancePresetFromInstanceParams,
  InstancePreset,
  InstancePresetList,
} from 'shared-types/api.types';
import { api } from './api';

export const getInstancePresetsFn = async (
  clusterName: string,
  provider?: string
) => {
  const response = await api.get<InstancePresetList>(
    `clusters/${clusterName}/instance-presets`,
    {
      params: {
        ...(provider ? { provider } : {}),
      },
    }
  );
  return response.data;
};

export const getInstancePresetFn = async (
  clusterName: string,
  name: string
) => {
  const response = await api.get<InstancePreset>(
    `clusters/${clusterName}/instance-presets/${name}`
  );
  return response.data;
};

export const resolveInstancePresetFn = async (
  clusterName: string,
  name: string,
  namespace: string
) => {
  const response = await api.get<InstancePreset>(
    `clusters/${clusterName}/instance-presets/${name}/resolve`,
    {
      params: { namespace },
    }
  );
  return response.data;
};

export const createInstancePresetFn = async (
  clusterName: string,
  name: string,
  spec: NonNullable<InstancePreset['spec']>
) => {
  const payload: InstancePreset = {
    apiVersion: 'core.openeverest.io/v1alpha1',
    kind: 'InstancePreset',
    metadata: { name },
    spec,
  };
  const response = await api.post<InstancePreset>(
    `clusters/${clusterName}/instance-presets`,
    payload
  );
  return response.data;
};

export const createInstancePresetFromInstanceFn = async (
  clusterName: string,
  params: CreateInstancePresetFromInstanceParams
) => {
  const response = await api.post<InstancePreset>(
    `clusters/${clusterName}/instance-presets/from-instance`,
    params
  );
  return response.data;
};

export const updateInstancePresetFn = async (
  clusterName: string,
  name: string,
  spec: NonNullable<InstancePreset['spec']>
) => {
  const payload: InstancePreset = {
    apiVersion: 'core.openeverest.io/v1alpha1',
    kind: 'InstancePreset',
    metadata: { name },
    spec,
  };
  const response = await api.put<InstancePreset>(
    `clusters/${clusterName}/instance-presets/${name}`,
    payload
  );
  return response.data;
};

export const deleteInstancePresetFn = async (
  clusterName: string,
  name: string
) => {
  const response = await api.delete(
    `clusters/${clusterName}/instance-presets/${name}`
  );
  return response.data;
};
