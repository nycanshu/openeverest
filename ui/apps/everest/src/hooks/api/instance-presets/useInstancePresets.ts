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
  useMutation,
  UseMutationOptions,
  useQuery,
} from '@tanstack/react-query';
import {
  createInstancePresetFn,
  createInstancePresetFromInstanceFn,
  deleteInstancePresetFn,
  getInstancePresetFn,
  getInstancePresetsFn,
  resolveInstancePresetFn,
  updateInstancePresetFn,
} from 'api/instancePresetApi';
import { useClusterName } from 'hooks/api/useClusterName';
import {
  CreateInstancePresetFromInstanceParams,
  InstancePreset,
  InstancePresetList,
} from 'shared-types/api.types';
import { PerconaQueryOptions } from 'shared-types/query.types';

export const INSTANCE_PRESETS_QUERY_KEY = 'instance-presets';

export const useInstancePresets = (
  provider?: string,
  options?: PerconaQueryOptions<InstancePresetList, unknown, InstancePreset[]>
) => {
  const clusterName = useClusterName();
  return useQuery<InstancePresetList, unknown, InstancePreset[]>({
    queryKey: [INSTANCE_PRESETS_QUERY_KEY, clusterName, provider ?? 'all'],
    queryFn: () => getInstancePresetsFn(clusterName, provider),
    refetchInterval: 10 * 1000,
    ...options,
    select: (data) => data.items ?? [],
  });
};

export const useInstancePreset = (
  name: string,
  options?: PerconaQueryOptions<InstancePreset>
) => {
  const clusterName = useClusterName();
  return useQuery<InstancePreset>({
    queryKey: [INSTANCE_PRESETS_QUERY_KEY, clusterName, name],
    queryFn: () => getInstancePresetFn(clusterName, name),
    ...options,
  });
};

export const useResolveInstancePreset = (
  name: string,
  namespace: string,
  options?: PerconaQueryOptions<InstancePreset>
) => {
  const clusterName = useClusterName();
  return useQuery<InstancePreset>({
    queryKey: [
      INSTANCE_PRESETS_QUERY_KEY,
      clusterName,
      name,
      'resolve',
      namespace,
    ],
    queryFn: () => resolveInstancePresetFn(clusterName, name, namespace),
    ...options,
  });
};

type CreateInstancePresetArgs = {
  name: string;
  spec: NonNullable<InstancePreset['spec']>;
};

export const useCreateInstancePreset = (
  options?: UseMutationOptions<
    InstancePreset,
    unknown,
    CreateInstancePresetArgs,
    unknown
  >
) => {
  const clusterName = useClusterName();
  return useMutation({
    mutationFn: ({ name, spec }: CreateInstancePresetArgs) =>
      createInstancePresetFn(clusterName, name, spec),
    ...options,
  });
};

export const useCreateInstancePresetFromInstance = (
  options?: UseMutationOptions<
    InstancePreset,
    unknown,
    CreateInstancePresetFromInstanceParams,
    unknown
  >
) => {
  const clusterName = useClusterName();
  return useMutation({
    mutationFn: (params: CreateInstancePresetFromInstanceParams) =>
      createInstancePresetFromInstanceFn(clusterName, params),
    ...options,
  });
};

type UpdateInstancePresetArgs = {
  name: string;
  spec: NonNullable<InstancePreset['spec']>;
};

export const useUpdateInstancePreset = (
  options?: UseMutationOptions<
    InstancePreset,
    unknown,
    UpdateInstancePresetArgs,
    unknown
  >
) => {
  const clusterName = useClusterName();
  return useMutation({
    mutationFn: ({ name, spec }: UpdateInstancePresetArgs) =>
      updateInstancePresetFn(clusterName, name, spec),
    ...options,
  });
};

export const useDeleteInstancePreset = (
  options?: UseMutationOptions<unknown, unknown, { name: string }, unknown>
) => {
  const clusterName = useClusterName();
  return useMutation({
    mutationFn: ({ name }: { name: string }) =>
      deleteInstancePresetFn(clusterName, name),
    ...options,
  });
};
