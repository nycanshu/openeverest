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

// Package common provides shared utilities for preset handling across handlers.
package common

import (
	"strings"

	corev1 "k8s.io/api/core/v1"
)

// InferSupportedResourceType derives resource type from field name.
// Returns empty string if field is not a supported resource type.
// Examples:
//   - secretRef -> "Secret"
//   - monitoringConfigName -> "MonitoringConfig"
func InferSupportedResourceType(fieldName string) string {
	lower := strings.ToLower(fieldName)

	// Check for secret patterns
	secretPatterns := []string{"secret", "secretname", "secretref"}
	for _, pattern := range secretPatterns {
		if strings.Contains(lower, pattern) {
			return "Secret"
		}
	}

	// Check for configmap patterns
	configmapPatterns := []string{"configmap", "configmapname", "configmapref"}
	for _, pattern := range configmapPatterns {
		if strings.Contains(lower, pattern) {
			return "ConfigMap"
		}
	}

	// Check for monitoring config patterns
	monitoringPatterns := []string{"monitoringconfig", "monitoringconfigname", "monitoringconfigref"}
	for _, pattern := range monitoringPatterns {
		if strings.Contains(lower, pattern) {
			return "MonitoringConfig"
		}
	}

	return ""
}

// IsEmptyValue checks if a value represents an empty namespace-scoped reference.
// It handles:
//   - Empty strings
//   - Empty LocalObjectReference
//   - Empty maps or maps with only an empty "name" field
func IsEmptyValue(value any) bool {
	switch v := value.(type) {
	case string:
		return v == ""
	case corev1.LocalObjectReference:
		return v.Name == ""
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
