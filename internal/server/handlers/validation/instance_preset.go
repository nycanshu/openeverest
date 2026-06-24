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
	"github.com/openeverest/openeverest/v2/pkg/common"
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

// CreateInstancePreset validates and proxies the request to the next handler.
func (h *validateHandler) CreateInstancePreset(ctx context.Context, cluster string, preset *corev1alpha1.InstancePreset) (*corev1alpha1.InstancePreset, error) {
	if err := h.validateInstancePreset(preset); err != nil {
		return nil, errors.Join(ErrInvalidRequest, fmt.Errorf("invalid instance preset: %w", err))
	}
	return h.next.CreateInstancePreset(ctx, cluster, preset)
}

// UpdateInstancePreset validates and proxies the request to the next handler.
func (h *validateHandler) UpdateInstancePreset(ctx context.Context, cluster string, preset *corev1alpha1.InstancePreset) (*corev1alpha1.InstancePreset, error) {
	if err := h.validateInstancePreset(preset); err != nil {
		return nil, errors.Join(ErrInvalidRequest, fmt.Errorf("invalid instance preset: %w", err))
	}
	return h.next.UpdateInstancePreset(ctx, cluster, preset)
}

// DeleteInstancePreset proxies the request to the next handler.
func (h *validateHandler) DeleteInstancePreset(ctx context.Context, cluster, name string) error {
	return h.next.DeleteInstancePreset(ctx, cluster, name)
}

// CreateInstancePresetFromInstance proxies the request to the next handler.
func (h *validateHandler) CreateInstancePresetFromInstance(ctx context.Context, cluster, namespace, instanceName, presetName string) (*corev1alpha1.InstancePreset, error) {
	return h.next.CreateInstancePresetFromInstance(ctx, cluster, namespace, instanceName, presetName)
}

// validateInstancePreset validates namespace-scoped fields are left empty.
func (h *validateHandler) validateInstancePreset(preset *corev1alpha1.InstancePreset) error {
	// Ensure namespace-scoped fields are empty
	for name, component := range preset.Spec.Components {
		// Check Config for secret/configmap references
		if component.Config != nil {
			if component.Config.SecretRef.Name != "" {
				return fmt.Errorf("component %s: config.secretRef.name must be empty in preset (namespace-scoped reference)", name)
			}
			if component.Config.ConfigMapRef.Name != "" {
				return fmt.Errorf("component %s: config.configMapRef.name must be empty in preset (namespace-scoped reference)", name)
			}
		}

		// Check CustomSpec for namespace-scoped references
		if component.CustomSpec != nil && len(component.CustomSpec.Raw) > 0 {
			var customSpecMap map[string]any
			if err := json.Unmarshal(component.CustomSpec.Raw, &customSpecMap); err != nil {
				return fmt.Errorf("failed to parse customSpec for component %s: %w", name, err)
			}
			if err := h.checkEmptyNamespacedRefs(customSpecMap, name); err != nil {
				return err
			}
		}
	}

	return nil
}

// checkEmptyNamespacedRefs recursively checks that namespace-scoped reference fields are empty.
func (h *validateHandler) checkEmptyNamespacedRefs(data map[string]any, componentName string) error {
	for key, value := range data {
		// Find namespace-scoped fields using common utility
		if common.InferSupportedResourceType(key) != "" {
			// Validation action: check if empty and return error if not
			if !common.IsEmptyValue(value) {
				// Get the actual non-empty value for error message
				valueStr := fmt.Sprintf("%v", value)
				if mapVal, ok := value.(map[string]any); ok {
					if nameVal, hasName := mapVal["name"]; hasName {
						valueStr = fmt.Sprintf("%v", nameVal)
					}
				}
				return fmt.Errorf("component %s: field %s must be empty in preset (namespace-scoped reference), got: %s", componentName, key, valueStr)
			}
		}

		// Recursively check nested maps
		if nestedMap, ok := value.(map[string]any); ok {
			if err := h.checkEmptyNamespacedRefs(nestedMap, componentName); err != nil {
				return err
			}
		}
	}
	return nil
}
