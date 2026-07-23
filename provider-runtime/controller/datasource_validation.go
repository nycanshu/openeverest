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
	"fmt"

	backupv1alpha1 "github.com/openeverest/openeverest/v2/api/backup/v1alpha1"
)

// ValidateDataSource validates dataSource constraints that are not
// enforced by kubebuilder CEL validation.
func (c *Context) ValidateDataSource() error {
	ds := c.in.Spec.DataSource
	if ds == nil {
		return nil
	}

	switch ds.Type {
	case backupv1alpha1.DataSourceTypeBackup:
		return nil
	case backupv1alpha1.DataSourceTypeProviderManagedImport:
		return c.validateProviderManagedImport()
	case backupv1alpha1.DataSourceTypeJobImport:
		return c.validateJobImport()
	default:
		return nil
	}
}

// validateProviderManagedImport validates ProviderManagedImport constraints that are
// not enforced by kubebuilder CEL validation.
func (c *Context) validateProviderManagedImport() error {
	bc, err := c.DataSourceBackupClass()
	if err != nil {
		return err
	}

	if !bc.Spec.SupportedProviders.Has(c.providerName) {
		return fmt.Errorf("BackupClass %q does not support provider %q", bc.Name, c.providerName)
	}

	if bc.Spec.ExecutionMode != backupv1alpha1.BackupExecutionModeProviderManaged {
		return fmt.Errorf("ProviderManagedImport requires a ProviderManaged BackupClass, got %q", bc.Spec.ExecutionMode)
	}

	if bc.Spec.ProviderManaged == nil || !bc.Spec.ProviderManaged.SupportsImport {
		return fmt.Errorf("BackupClass %q does not support import", bc.Name)
	}

	if err := bc.Spec.ImportParametersSchema.Validate(c.in.Spec.DataSource.ProviderManagedImport.Parameters); err != nil {
		return fmt.Errorf("spec.dataSource.providerManagedImport.parameters validation failed: %w", err)
	}

	return nil
}

// validateJobImport validates JobImport constraints that are not
// enforced by kubebuilder CEL validation.
func (c *Context) validateJobImport() error {
	bc, err := c.DataSourceBackupClass()
	if err != nil {
		return err
	}

	if !bc.Spec.SupportedProviders.Has(c.providerName) {
		return fmt.Errorf("BackupClass %q does not support provider %q", bc.Name, c.providerName)
	}

	if bc.Spec.ExecutionMode != backupv1alpha1.BackupExecutionModeJob {
		return fmt.Errorf("JobImport requires a Job-mode BackupClass, got %q", bc.Spec.ExecutionMode)
	}

	if bc.Spec.Job == nil || bc.Spec.Job.Import == nil {
		return fmt.Errorf("BackupClass %q does not have job.import defined", bc.Name)
	}

	if err := bc.Spec.ImportParametersSchema.Validate(c.in.Spec.DataSource.JobImport.Parameters); err != nil {
		return fmt.Errorf("spec.dataSource.jobImport.parameters validation failed: %w", err)
	}

	return nil
}
