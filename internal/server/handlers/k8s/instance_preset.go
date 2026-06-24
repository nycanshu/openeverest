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

package k8s

import (
	"context"
	"encoding/json"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	corev1alpha1 "github.com/openeverest/openeverest/v2/api/core/v1alpha1"
	monitoringv1alpha1 "github.com/openeverest/openeverest/v2/api/monitoring/v1alpha1"
	"github.com/openeverest/openeverest/v2/pkg/common"
)

// ListInstancePresets returns list of instance presets, optionally filtered by provider.
func (h *k8sHandler) ListInstancePresets(ctx context.Context, cluster string, provider string) (*corev1alpha1.InstancePresetList, error) {
	list, err := h.kubeConnector.ListInstancePresets(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list instance presets: %w", err)
	}

	if provider != "" {
		filtered := make([]corev1alpha1.InstancePreset, 0)
		for _, preset := range list.Items {
			if preset.Spec.Provider == provider {
				filtered = append(filtered, preset)
			}
		}
		list.Items = filtered
	}

	return list, nil
}

// GetInstancePreset returns an instance preset that matches the criteria.
func (h *k8sHandler) GetInstancePreset(ctx context.Context, cluster, name string) (*corev1alpha1.InstancePreset, error) {
	return h.kubeConnector.GetInstancePreset(ctx, types.NamespacedName{Name: name})
}

// ResolveInstancePreset returns an instance preset with namespace-specific default values populated.
func (h *k8sHandler) ResolveInstancePreset(ctx context.Context, cluster, name, namespace string) (*corev1alpha1.InstancePreset, error) {
	preset, err := h.kubeConnector.GetInstancePreset(ctx, types.NamespacedName{Name: name})
	if err != nil {
		return nil, fmt.Errorf("failed to get instance preset: %w", err)
	}

	// Create a copy to avoid modifying the original
	resolved := preset.DeepCopy()

	return h.resolveNamespaceDefaults(ctx, resolved, namespace)
}

// CreateInstancePreset creates a new instance preset.
func (h *k8sHandler) CreateInstancePreset(ctx context.Context, cluster string, preset *corev1alpha1.InstancePreset) (*corev1alpha1.InstancePreset, error) {
	if err := h.kubeConnector.CreateInstancePreset(ctx, preset); err != nil {
		return nil, fmt.Errorf("failed to create instance preset: %w", err)
	}
	return preset, nil
}

// UpdateInstancePreset updates an existing instance preset.
func (h *k8sHandler) UpdateInstancePreset(ctx context.Context, cluster string, preset *corev1alpha1.InstancePreset) (*corev1alpha1.InstancePreset, error) {
	if err := h.kubeConnector.UpdateInstancePreset(ctx, preset); err != nil {
		return nil, fmt.Errorf("failed to update instance preset: %w", err)
	}
	return preset, nil
}

// DeleteInstancePreset deletes an instance preset.
func (h *k8sHandler) DeleteInstancePreset(ctx context.Context, cluster, name string) error {
	preset, err := h.kubeConnector.GetInstancePreset(ctx, types.NamespacedName{Name: name})
	if err != nil {
		return fmt.Errorf("failed to get instance preset: %w", err)
	}
	if err := h.kubeConnector.DeleteInstancePreset(ctx, preset); err != nil {
		return fmt.Errorf("failed to delete instance preset: %w", err)
	}
	return nil
}

// CreateInstancePresetFromInstance creates a new preset from an existing Instance.
// It strips out namespace-scoped values and creates a cluster-scoped preset.
func (h *k8sHandler) CreateInstancePresetFromInstance(ctx context.Context, cluster, namespace, instanceName, presetName string) (*corev1alpha1.InstancePreset, error) {
	// Get the source instance
	instance, err := h.kubeConnector.GetInstance(ctx, types.NamespacedName{
		Namespace: namespace,
		Name:      instanceName,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get source instance: %w", err)
	}

	// Create a new preset from the instance spec
	preset := &corev1alpha1.InstancePreset{
		ObjectMeta: metav1.ObjectMeta{
			Name: presetName,
		},
		Spec: corev1alpha1.InstancePresetSpec{
			InstanceSpec: instance.Spec,
		},
	}

	// Strip out namespace-scoped values
	h.stripNamespaceScopedValues(&preset.Spec)

	// Create the preset
	if err := h.kubeConnector.CreateInstancePreset(ctx, preset); err != nil {
		return nil, fmt.Errorf("failed to create preset: %w", err)
	}

	return preset, nil
}

// resolveNamespaceDefaults scans components and resolves
// empty namespace reference fields and populates them.
// The fields that could have namespace references are in config and customSpec.
// It skips other fields like resources, image, etc. since they are not
// namespace-specific, and also skips fields with unknown type.
// Supported types are Secret and MonitoringConfig.
// The resolution is based on the most recently created resource with the
// annotation "openeverest.io/is-default-components-<componentName>" set
// to "true" in the specified namespace.
func (h *k8sHandler) resolveNamespaceDefaults(ctx context.Context, preset *corev1alpha1.InstancePreset, namespace string) (*corev1alpha1.InstancePreset, error) {
	for componentName, component := range preset.Spec.Components {
		var err error

		// Resolve Config fields
		if component.Config != nil {
			component, err = h.resolveConfigFields(ctx, component, componentName, namespace)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve component %s: %w", componentName, err)
			}
		}

		// Resolve customSpec fields
		if component.CustomSpec != nil && len(component.CustomSpec.Raw) > 0 {
			component, err = h.resolveCustomSpecFields(ctx, component, componentName, namespace)
			if err != nil {
				return nil, fmt.Errorf("failed to resolve component %s: %w", componentName, err)
			}
		}

		preset.Spec.Components[componentName] = component
	}

	return preset, nil
}

// resolveConfigFields handles structured Config.SecretRef.Name.
// TODO: support Config.ConfigMapRef.Name.
func (h *k8sHandler) resolveConfigFields(ctx context.Context, component corev1alpha1.ComponentSpec, componentName, namespace string) (corev1alpha1.ComponentSpec, error) {
	if component.Config == nil {
		return component, nil
	}

	if common.IsEmptyValue(component.Config.SecretRef) {
		defaultSecretName, err := h.findDefaultResource(ctx, namespace, "Secret", componentName)
		if err != nil {
			return component, err
		}
		component.Config.SecretRef.Name = defaultSecretName
	}

	return component, nil
}

// resolveCustomSpecFields handles unstructured customSpec fields recursively.
func (h *k8sHandler) resolveCustomSpecFields(ctx context.Context, component corev1alpha1.ComponentSpec, componentName, namespace string) (corev1alpha1.ComponentSpec, error) {
	var data map[string]any
	if err := json.Unmarshal(component.CustomSpec.Raw, &data); err != nil {
		return component, err
	}

	modified, err := h.resolveMapFieldsRecursive(ctx, data, componentName, namespace)
	if err != nil {
		return component, err
	}

	if modified {
		resolvedRaw, err := json.Marshal(data)
		if err != nil {
			return component, err
		}
		component.CustomSpec.Raw = resolvedRaw
	}

	return component, nil
}

// resolveMapFieldsRecursive walks customSpec and resolves empty fields matching patterns
func (h *k8sHandler) resolveMapFieldsRecursive(ctx context.Context, data map[string]any, componentName, namespace string) (bool, error) {
	var modified bool

	for fieldName, value := range data {
		resourceType := common.InferSupportedResourceType(fieldName)
		if resourceType == "" {
			if nested, ok := value.(map[string]any); ok {
				m, err := h.resolveMapFieldsRecursive(ctx, nested, componentName, namespace)
				if err != nil {
					return modified, err
				}

				modified = modified || m
			}
			continue
		}

		// Try to resolve if value is empty
		if !common.IsEmptyValue(value) {
			continue
		}

		defaultName, err := h.findDefaultResource(ctx, namespace, resourceType, componentName)
		if err != nil {
			return modified, err
		}

		if defaultName == "" {
			continue
		}

		// Handle ref-like objects (e.g., {} or {"name": ""})
		if refMap, ok := value.(map[string]any); ok {
			refMap["name"] = defaultName
		} else {
			// Handle string values
			data[fieldName] = defaultName
		}

		modified = true
	}

	return modified, nil
}

// stripNamespaceScopedValues removes namespace-scoped references from a preset spec.
func (h *k8sHandler) stripNamespaceScopedValues(spec *corev1alpha1.InstancePresetSpec) {
	for name, component := range spec.Components {
		// Clear Config refs
		if component.Config != nil {
			component.Config.SecretRef = corev1.LocalObjectReference{}
			component.Config.ConfigMapRef = corev1.LocalObjectReference{}
		}

		// Strip namespace-scoped fields from CustomSpec
		if component.CustomSpec != nil && len(component.CustomSpec.Raw) > 0 {
			var data map[string]any
			if err := json.Unmarshal(component.CustomSpec.Raw, &data); err == nil {
				h.stripNamespacedRefsRecursive(data)
				if cleanedRaw, err := json.Marshal(data); err == nil {
					component.CustomSpec.Raw = cleanedRaw
				}
			}
		}

		spec.Components[name] = component
	}
}

// stripNamespacedRefsRecursive clears namespace-scoped field values in customSpec.
func (h *k8sHandler) stripNamespacedRefsRecursive(data map[string]any) {
	for key, value := range data {
		// Find namespace-scoped fields using common utility
		if common.InferSupportedResourceType(key) != "" {
			// Stripping action: set to empty value
			if refMap, ok := value.(map[string]any); ok {
				refMap["name"] = ""
			} else {
				data[key] = ""
			}
		} else if nestedMap, ok := value.(map[string]any); ok {
			// Recursively process nested maps
			h.stripNamespacedRefsRecursive(nestedMap)
		}
	}
}

// findDefaultResource finds the default resource for a component field
func (h *k8sHandler) findDefaultResource(ctx context.Context, namespace, resourceType, componentName string) (string, error) {
	if resourceType == "" {
		return "", nil
	}

	// Build annotation key for this component
	annotationKey := fmt.Sprintf("openeverest.io/is-default-components-%s", componentName)

	// Query the appropriate resource type
	var mostRecent ctrlclient.Object
	var err error

	switch resourceType {
	case "Secret":
		mostRecent, err = h.findDefaultSecret(ctx, namespace, annotationKey)
	case "ConfigMap":
		// TODO: Implement findDefaultConfigMap when needed
		return "", nil
	case "MonitoringConfig":
		mostRecent, err = h.findDefaultMonitoringConfig(ctx, namespace, annotationKey)
	default:
		return "", nil
	}

	if err != nil || mostRecent == nil {
		return "", err
	}

	return mostRecent.GetName(), nil
}

// findDefaultSecret finds the most recent Secret with the annotation
func (h *k8sHandler) findDefaultSecret(ctx context.Context, namespace, annotationKey string) (ctrlclient.Object, error) {
	secrets, err := h.kubeConnector.ListSecrets(ctx,
		ctrlclient.InNamespace(namespace),
	)
	if err != nil {
		return nil, err
	}

	// Filter by annotation. Note: Kubernetes API doesn't support annotation selectors,
	// so we must list all Secrets and filter client-side (same limitation as StorageClass).
	// If performance becomes an issue with many Secrets, consider adding labels instead.
	filtered := make([]corev1.Secret, 0)
	for _, secret := range secrets.Items {
		if annotations := secret.GetAnnotations(); annotations != nil {
			if annotations[annotationKey] == "true" {
				filtered = append(filtered, secret)
			}
		}
	}

	if len(filtered) == 0 {
		return nil, nil
	}

	return getMostRecentlyCreated(convertSecretsToObjects(filtered)), nil
}

// findDefaultMonitoringConfig finds the most recent MonitoringConfig with the annotation
func (h *k8sHandler) findDefaultMonitoringConfig(ctx context.Context, namespace, annotationKey string) (ctrlclient.Object, error) {
	configs, err := h.kubeConnector.ListMonitoringConfigsV2(ctx,
		ctrlclient.InNamespace(namespace),
	)
	if err != nil {
		return nil, err
	}

	// Filter by annotation. Note: Kubernetes API doesn't support annotation selectors,
	// so we must list all MonitoringConfigs and filter client-side (same limitation as StorageClass).
	// If performance becomes an issue with many configs, consider adding labels instead.
	filtered := make([]monitoringv1alpha1.MonitoringConfig, 0)
	for _, config := range configs.Items {
		if annotations := config.GetAnnotations(); annotations != nil {
			if annotations[annotationKey] == "true" {
				filtered = append(filtered, config)
			}
		}
	}

	if len(filtered) == 0 {
		return nil, nil
	}

	return getMostRecentlyCreated(convertMonitoringConfigsToObjects(filtered)), nil
}

// getMostRecentlyCreated returns the most recently created resource
func getMostRecentlyCreated(items []ctrlclient.Object) ctrlclient.Object {
	if len(items) == 0 {
		return nil
	}

	mostRecent := items[0]
	for i := 1; i < len(items); i++ {
		if items[i].GetCreationTimestamp().After(mostRecent.GetCreationTimestamp().Time) {
			mostRecent = items[i]
		}
	}

	return mostRecent
}

func convertSecretsToObjects(items []corev1.Secret) []ctrlclient.Object {
	result := make([]ctrlclient.Object, len(items))
	for i := range items {
		result[i] = &items[i]
	}
	return result
}

func convertMonitoringConfigsToObjects(items []monitoringv1alpha1.MonitoringConfig) []ctrlclient.Object {
	result := make([]ctrlclient.Object, len(items))
	for i := range items {
		result[i] = &items[i]
	}
	return result
}
