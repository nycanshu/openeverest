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

package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	backupv1alpha1 "github.com/openeverest/openeverest/v2/api/backup/v1alpha1"
	commonv1alpha1 "github.com/openeverest/openeverest/v2/api/common/v1alpha1"
	corev1alpha1 "github.com/openeverest/openeverest/v2/api/core/v1alpha1"
)

func TestValidateDataSource(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		instance  *corev1alpha1.Instance
		expectErr string
	}{
		{
			name: "nil dataSource",
			instance: &corev1alpha1.Instance{
				ObjectMeta: metav1.ObjectMeta{Name: "test-instance"},
				Spec:       corev1alpha1.InstanceSpec{},
			},
		},
		{
			name: "import without classRef and supportsImport",
			instance: &corev1alpha1.Instance{
				ObjectMeta: metav1.ObjectMeta{Name: "test-instance"},
				Spec: corev1alpha1.InstanceSpec{
					ProviderRef: commonv1alpha1.ObjectRef{Name: "psmdb"},
					Backup: &corev1alpha1.InstanceBackupSpec{
						Enabled:  true,
						ClassRef: commonv1alpha1.ObjectRef{Name: "provider-managed-no-import"},
						Storages: []corev1alpha1.InstanceBackupStorage{
							{StorageRef: commonv1alpha1.ObjectRef{Name: "my-storage"}},
						},
					},
					DataSource: &backupv1alpha1.DataSource{
						Type: backupv1alpha1.DataSourceTypeImport,
						Import: &backupv1alpha1.DataSourceImport{
							StorageRef: commonv1alpha1.ObjectRef{Name: "my-storage"},
							Parameters: &runtime.RawExtension{Raw: []byte(`{"path": "/backup"}`)},
						},
					},
				},
			},
			expectErr: `BackupClass "provider-managed-no-import" does not support import`,
		},
		{
			name: "import without classRef with supportsImport",
			instance: &corev1alpha1.Instance{
				ObjectMeta: metav1.ObjectMeta{Name: "test-instance"},
				Spec: corev1alpha1.InstanceSpec{
					ProviderRef: commonv1alpha1.ObjectRef{Name: "psmdb"},
					Backup: &corev1alpha1.InstanceBackupSpec{
						Enabled:  true,
						ClassRef: commonv1alpha1.ObjectRef{Name: "provider-managed-with-import"},
						Storages: []corev1alpha1.InstanceBackupStorage{
							{StorageRef: commonv1alpha1.ObjectRef{Name: "my-storage"}},
						},
					},
					DataSource: &backupv1alpha1.DataSource{
						Type: backupv1alpha1.DataSourceTypeImport,
						Import: &backupv1alpha1.DataSourceImport{
							StorageRef: commonv1alpha1.ObjectRef{Name: "my-storage"},
							Parameters: &runtime.RawExtension{Raw: []byte(`{"path": "/backup"}`)},
						},
					},
				},
			},
		},
		{
			name: "import with classRef without job.import defined",
			instance: &corev1alpha1.Instance{
				ObjectMeta: metav1.ObjectMeta{Name: "test-instance"},
				Spec: corev1alpha1.InstanceSpec{
					ProviderRef: commonv1alpha1.ObjectRef{Name: "psmdb"},
					DataSource: &backupv1alpha1.DataSource{
						Type: backupv1alpha1.DataSourceTypeImport,
						Import: &backupv1alpha1.DataSourceImport{
							ClassRef:   &commonv1alpha1.ObjectRef{Name: "job-mode-no-import"},
							StorageRef: commonv1alpha1.ObjectRef{Name: "my-storage"},
							Parameters: &runtime.RawExtension{Raw: []byte(`{"path": "/backup"}`)},
						},
					},
				},
			},
			expectErr: `BackupClass "job-mode-no-import" does not have job.import defined`,
		},
		{
			name: "import with classRef with job.import defined",
			instance: &corev1alpha1.Instance{
				ObjectMeta: metav1.ObjectMeta{Name: "test-instance"},
				Spec: corev1alpha1.InstanceSpec{
					ProviderRef: commonv1alpha1.ObjectRef{Name: "psmdb"},
					DataSource: &backupv1alpha1.DataSource{
						Type: backupv1alpha1.DataSourceTypeImport,
						Import: &backupv1alpha1.DataSourceImport{
							ClassRef:   &commonv1alpha1.ObjectRef{Name: "job-mode-with-import"},
							StorageRef: commonv1alpha1.ObjectRef{Name: "my-storage"},
							Parameters: &runtime.RawExtension{Raw: []byte(`{"path": "/backup"}`)},
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			scheme := runtime.NewScheme()
			require.NoError(t, corev1alpha1.AddToScheme(scheme))
			require.NoError(t, backupv1alpha1.AddToScheme(scheme))

			// BackupClass without import support
			providerManagedNoImportBC := &backupv1alpha1.BackupClass{
				ObjectMeta: metav1.ObjectMeta{Name: "provider-managed-no-import"},
				Spec: backupv1alpha1.BackupClassSpec{
					SupportedProviders: backupv1alpha1.ProviderNameList{"psmdb"},
					ExecutionMode:      backupv1alpha1.BackupExecutionModeProviderManaged,
					ProviderManaged: &backupv1alpha1.ProviderManagedSpec{
						SupportsImport: false,
					},
				},
			}

			// BackupClass with import support
			providerManagedWithImportBC := &backupv1alpha1.BackupClass{
				ObjectMeta: metav1.ObjectMeta{Name: "provider-managed-with-import"},
				Spec: backupv1alpha1.BackupClassSpec{
					SupportedProviders: backupv1alpha1.ProviderNameList{"psmdb"},
					ExecutionMode:      backupv1alpha1.BackupExecutionModeProviderManaged,
					ProviderManaged: &backupv1alpha1.ProviderManagedSpec{
						SupportsImport: true,
					},
					ImportParametersSchema: commonv1alpha1.ParametersSchema{
						OpenAPIV3Schema: &apiextensionsv1.JSONSchemaProps{
							Type: "object",
							Properties: map[string]apiextensionsv1.JSONSchemaProps{
								"path": {Type: "string"},
							},
						},
					},
				},
			}

			// Job mode BackupClass without import
			jobModeNoImportBC := &backupv1alpha1.BackupClass{
				ObjectMeta: metav1.ObjectMeta{Name: "job-mode-no-import"},
				Spec: backupv1alpha1.BackupClassSpec{
					SupportedProviders: backupv1alpha1.ProviderNameList{"psmdb"},
					ExecutionMode:      backupv1alpha1.BackupExecutionModeJob,
					Job: &backupv1alpha1.JobModeSpec{
						Backup: &backupv1alpha1.JobExecution{
							JobSpec: &backupv1alpha1.BackupJobSpec{
								Image: "test-image",
							},
						},
					},
				},
			}

			// Job mode BackupClass with import
			jobModeWithImportBC := &backupv1alpha1.BackupClass{
				ObjectMeta: metav1.ObjectMeta{Name: "job-mode-with-import"},
				Spec: backupv1alpha1.BackupClassSpec{
					SupportedProviders: backupv1alpha1.ProviderNameList{"psmdb"},
					ExecutionMode:      backupv1alpha1.BackupExecutionModeJob,
					Job: &backupv1alpha1.JobModeSpec{
						Backup: &backupv1alpha1.JobExecution{
							JobSpec: &backupv1alpha1.BackupJobSpec{
								Image: "test-image",
							},
						},
						Import: &backupv1alpha1.JobExecution{
							JobSpec: &backupv1alpha1.BackupJobSpec{
								Image: "import-image",
							},
						},
					},
					ImportParametersSchema: commonv1alpha1.ParametersSchema{
						OpenAPIV3Schema: &apiextensionsv1.JSONSchemaProps{
							Type: "object",
							Properties: map[string]apiextensionsv1.JSONSchemaProps{
								"path": {Type: "string"},
							},
						},
					},
				},
			}

			// BackupStorage
			myStorage := &backupv1alpha1.BackupStorage{
				ObjectMeta: metav1.ObjectMeta{Name: "my-storage"},
				Spec: backupv1alpha1.BackupStorageSpec{
					Type: backupv1alpha1.BackupStorageTypeS3,
					S3: &backupv1alpha1.BackupStorageS3Spec{
						Bucket:      "test-bucket",
						Region:      "us-east-1",
						EndpointURL: "http://minio:9000",
					},
				},
			}

			fakeClient := fake.NewClientBuilder().
				WithScheme(scheme).
				WithObjects(
					tt.instance,
					providerManagedNoImportBC,
					providerManagedWithImportBC,
					jobModeNoImportBC,
					jobModeWithImportBC,
					myStorage,
				).
				Build()

			ctx := NewContext(context.Background(), fakeClient, tt.instance, "psmdb")
			err := ctx.ValidateDataSource()

			if tt.expectErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectErr)
				return
			}

			require.NoError(t, err)
		})
	}
}
