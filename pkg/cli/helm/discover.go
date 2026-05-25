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

package helm

import (
	"errors"
	"fmt"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/release"
)

// DiscoverOpenEverestNamespace returns the namespace where OpenEverest is installed.
// It scans all deployed Helm releases for the OpenEverest chart because the
// namespace is user-chosen at install time and not stored in a fixed location.
func DiscoverOpenEverestNamespace(kubeconfigPath string) (string, error) {
	cfg, err := newActionsCfg("", kubeconfigPath)
	if err != nil {
		return "", fmt.Errorf("failed to create Helm configuration: %w", err)
	}

	rel, err := findEverestRelease(cfg)
	if err != nil {
		return "", err
	}
	return rel.Namespace, nil
}

// DiscoverMonitoringNamespace returns the namespace where OpenEverest monitoring stack
// is installed. It reads monitoring.namespaceOverride from the deployed
// OpenEverest Helm release, preferring user-supplied overrides over chart defaults.
func DiscoverMonitoringNamespace(kubeconfigPath string) (string, error) {
	cfg, err := newActionsCfg("", kubeconfigPath)
	if err != nil {
		return "", fmt.Errorf("failed to create Helm configuration: %w", err)
	}

	return discoverMonitoringNamespace(cfg)
}

// discoverMonitoringNamespace reads monitoring.namespaceOverride from the
// deployed OpenEverest Helm release. User-supplied config values take priority
// over chart default values.
func discoverMonitoringNamespace(cfg *action.Configuration) (string, error) {
	rel, err := findEverestRelease(cfg)
	if err != nil {
		return "", err
	}

	// User-supplied overrides take priority over chart defaults.
	for _, vals := range []map[string]interface{}{rel.Config, rel.Chart.Values} {
		if monitoring, ok := vals["monitoring"].(map[string]interface{}); ok {
			if ns, ok := monitoring["namespaceOverride"].(string); ok && ns != "" {
				return ns, nil
			}
		}
	}

	return "", errors.New("monitoring.namespaceOverride not found in OpenEverest Helm release values")
}

// findEverestRelease lists all deployed Helm releases and returns the one
// whose chart name matches EverestChartName.
func findEverestRelease(cfg *action.Configuration) (*release.Release, error) {
	list := action.NewList(cfg)
	list.AllNamespaces = true
	list.StateMask = action.ListDeployed

	releases, err := list.Run()
	if err != nil {
		return nil, fmt.Errorf("failed to list Helm releases: %w", err)
	}

	for _, rel := range releases {
		if rel.Chart != nil && rel.Chart.Metadata != nil && rel.Chart.Metadata.Name == EverestChartName {
			return rel, nil
		}
	}

	return nil, errors.New("no OpenEverest Helm release found; is OpenEverest installed?")
}
