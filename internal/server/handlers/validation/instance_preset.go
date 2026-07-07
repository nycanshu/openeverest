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

// Package validation provides the validation handler.
package validation

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	corev1alpha1 "github.com/openeverest/openeverest/v2/api/core/v1alpha1"
)

// ListInstancePresets proxies the request to the next handler.
func (h *validateHandler) ListInstancePresets(ctx context.Context, cluster string, provider string) (*corev1alpha1.InstancePresetList, error) {
	return h.next.ListInstancePresets(ctx, cluster, provider)
}

// GetInstancePreset proxies the request to the next handler.
func (h *validateHandler) GetInstancePreset(ctx context.Context, cluster, name string) (*corev1alpha1.InstancePreset, error) {
	return h.next.GetInstancePreset(ctx, cluster, name)
}

// ResolveInstancePreset proxies the request to the next handler.
func (h *validateHandler) ResolveInstancePreset(ctx context.Context, cluster, name, namespace string) (*corev1alpha1.InstancePreset, error) {
	return h.next.ResolveInstancePreset(ctx, cluster, name, namespace)
}

// CreateInstancePreset validates and creates an instance preset.
func (h *validateHandler) CreateInstancePreset(ctx context.Context, cluster string, preset *corev1alpha1.InstancePreset) (*corev1alpha1.InstancePreset, error) {
	// Validate the preset spec
	if err := h.validateInstancePresetSpec(&preset.Spec); err != nil {
		return nil, err
	}

	return h.next.CreateInstancePreset(ctx, cluster, preset)
}

// UpdateInstancePreset validates and updates an instance preset.
func (h *validateHandler) UpdateInstancePreset(ctx context.Context, cluster string, preset *corev1alpha1.InstancePreset) (*corev1alpha1.InstancePreset, error) {
	// Validate the preset spec
	if err := h.validateInstancePresetSpec(&preset.Spec); err != nil {
		return nil, err
	}

	return h.next.UpdateInstancePreset(ctx, cluster, preset)
}

// DeleteInstancePreset proxies the request to the next handler.
func (h *validateHandler) DeleteInstancePreset(ctx context.Context, cluster, name string) error {
	return h.next.DeleteInstancePreset(ctx, cluster, name)
}

// CreateInstancePresetFromInstance validates and creates an instance preset from an instance.
func (h *validateHandler) CreateInstancePresetFromInstance(ctx context.Context, cluster, namespace, instanceName, presetName string) (*corev1alpha1.InstancePreset, error) {
	if presetName == "" {
		return nil, errors.Join(ErrInvalidRequest, errors.New("presetName cannot be empty"))
	}

	return h.next.CreateInstancePresetFromInstance(ctx, cluster, namespace, instanceName, presetName)
}

// validateInstancePresetSpec validates an InstancePreset spec.
// It applies basic validation with checks for:
// - Namespace-scoped fields should be empty (secrets, monitoringConfig names)
func (h *validateHandler) validateInstancePresetSpec(spec *corev1alpha1.InstancePresetSpec) error {
	// Additional validation: ensure namespace-scoped fields are empty
	for componentName, component := range spec.Components {
		// Check Config.SecretRef
		if component.Config != nil {
			if component.Config.SecretRef.Name != "" {
				return errors.Join(ErrInvalidRequest, fmt.Errorf("component %s: config.secretRef.name must be empty in preset (found: %s)", componentName, component.Config.SecretRef.Name))
			}

			if component.Config.ConfigMapRef.Name != "" {
				return errors.Join(ErrInvalidRequest, fmt.Errorf("component %s: config.configMapRef.name must be empty in preset (found: %s)", componentName, component.Config.ConfigMapRef.Name))
			}
		}

		// Check customSpec for namespace-scoped fields
		if component.CustomSpec != nil && len(component.CustomSpec.Raw) > 0 {
			if err := h.validateCustomSpecEmpty(component.CustomSpec.Raw, componentName); err != nil {
				return err
			}
		}
	}

	return nil
}

// validateCustomSpecEmpty checks that namespace-scoped fields in customSpec are empty.
func (h *validateHandler) validateCustomSpecEmpty(raw []byte, componentName string) error {
	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		return errors.Join(ErrInvalidRequest, fmt.Errorf("component %s: invalid customSpec JSON", componentName))
	}

	return h.checkMapFieldsEmpty(data, componentName, "")
}

// checkMapFieldsEmpty recursively checks that namespace-scoped fields are empty.
func (h *validateHandler) checkMapFieldsEmpty(data map[string]any, componentName, path string) error {
	for fieldName, value := range data {
		currentPath := fieldName
		if path != "" {
			currentPath = path + "." + fieldName
		}

		// Check if this is a namespace-scoped field
		if isNamespaceScopedField(fieldName) {
			// Check if value is non-empty
			if !isFieldEmpty(value) {
				return errors.Join(ErrInvalidRequest, fmt.Errorf("component %s: %s must be empty in preset", componentName, currentPath))
			}
		}

		// Recursively check nested objects
		if nested, ok := value.(map[string]any); ok {
			if err := h.checkMapFieldsEmpty(nested, componentName, currentPath); err != nil {
				return err
			}
		}
	}

	return nil
}

// isNamespaceScopedField checks if a field name indicates a namespace-scoped resource reference.
func isNamespaceScopedField(fieldName string) bool {
	namespaceScopedFields := map[string]bool{
		"secret":               true,
		"secretName":           true,
		"secretRef":            true,
		"monitoringConfig":     true,
		"monitoringConfigName": true,
		"monitoringConfigRef":  true,
	}

	return namespaceScopedFields[fieldName]
}

// isFieldEmpty checks if a field value is considered empty.
func isFieldEmpty(value any) bool {
	switch v := value.(type) {
	case string:
		return v == ""
	case map[string]any:
		// Empty object like {} or {"name": ""}
		if len(v) == 0 {
			return true
		}
		if len(v) == 1 {
			if nameVal, exists := v["name"]; exists {
				if name, ok := nameVal.(string); ok {
					return name == ""
				}
			}
		}
	}

	return false
}
