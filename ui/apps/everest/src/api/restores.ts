import {
  CreateRestorePayload,
  GetRestorePayload,
} from 'shared-types/restores.types';
import { api } from './api';

export const createInstanceRestoreFn = async (
  clusterName: string,
  namespace: string,
  payload: CreateRestorePayload
) => {
  const response = await api.post(
    `clusters/${clusterName}/namespaces/${namespace}/restores`,
    payload
  );

  return response.data;
};

export const getInstanceRestoresFn = async (
  clusterName: string,
  namespace: string,
  instanceName: string
) => {
  const response = await api.get<GetRestorePayload>(
    `clusters/${clusterName}/namespaces/${namespace}/instances/${instanceName}/restores`
  );

  return response.data;
};

export const deleteRestoreFn = async (
  clusterName: string,
  namespace: string,
  restoreName: string
) => {
  const response = await api.delete(
    `clusters/${clusterName}/namespaces/${namespace}/restores/${restoreName}`
  );

  return response.data;
};
