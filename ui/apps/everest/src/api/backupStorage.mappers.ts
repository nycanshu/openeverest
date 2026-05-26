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
  BackupStorageFormValues,
  BackupStorageCRD,
  StorageType,
} from 'shared-types/backupStorages.types';

type KubeMetadata = { name?: string; namespace?: string };

/**
 * Maps a BackupStorage CRD object (from the v2 API) to flat form values.
 * Used only when pre-populating an edit form.
 * Credentials (accessKey/secretKey) are write-only on the CRD and will be empty
 * strings on read.
 */
export const crdToFormValues = (
  crd: BackupStorageCRD
): BackupStorageFormValues => {
  const meta = crd.metadata as unknown as KubeMetadata | undefined;
  return {
    name: meta?.name ?? '',
    namespace: meta?.namespace ?? '',
    type: crd.spec.type as StorageType,
    bucketName: crd.spec.s3?.bucket ?? '',
    url: crd.spec.s3?.endpointURL ?? '',
    region: crd.spec.s3?.region ?? '',
    accessKey: crd.spec.s3?.accessKeyId ?? '',
    secretKey: crd.spec.s3?.secretAccessKey ?? '',
    verifyTLS: crd.spec.s3?.verifyTLS ?? true,
    forcePathStyle: crd.spec.s3?.forcePathStyle ?? false,
  };
};

/**
 * Maps form values to a CRD payload for creating a new BackupStorage.
 */
export const formValuesToCrdCreate = (formValues: BackupStorageFormValues) => ({
  metadata: {
    name: formValues.name,
    namespace: formValues.namespace,
  },
  spec: {
    type: formValues.type,
    s3: {
      bucket: formValues.bucketName,
      endpointURL: formValues.url,
      region: formValues.region,
      credentialsSecretName: `backup-storage-${formValues.name}-credentials`,
      accessKeyId: formValues.accessKey,
      secretAccessKey: formValues.secretKey,
      verifyTLS: formValues.verifyTLS,
      forcePathStyle: formValues.forcePathStyle,
    },
  },
});

/**
 * Maps editable form fields to a partial CRD payload for patching.
 * Name, namespace, and type are immutable and excluded.
 */
export const formValuesToCrdEdit = (formValues: BackupStorageFormValues) => ({
  spec: {
    type: formValues.type,
    s3: {
      bucket: formValues.bucketName,
      endpointURL: formValues.url,
      region: formValues.region,
      credentialsSecretName: `backup-storage-${formValues.name}-credentials`,
      ...(formValues.accessKey && { accessKeyId: formValues.accessKey }),
      ...(formValues.secretKey && { secretAccessKey: formValues.secretKey }),
      verifyTLS: formValues.verifyTLS,
      forcePathStyle: formValues.forcePathStyle,
    },
  },
});
