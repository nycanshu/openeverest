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

// DiscoverNamespaces returns the system namespace where OpenEverest is
// installed and the monitoring namespace. It lists Helm releases and
// finds the OpenEverest release to determine the namespaces.
func DiscoverNamespaces(kubeconfigPath string) (systemNS, monitoringNS string, err error) {
	cfg, err := newActionsCfg("", kubeconfigPath)
	if err != nil {
		return "", "", fmt.Errorf("failed to create Helm configuration: %w", err)
	}

	rel, err := findEverestRelease(cfg)
	if err != nil {
		return "", "", err
	}

	monitoringNS, err = monitoringNamespaceFromRelease(rel)
	if err != nil {
		return "", "", err
	}
	return rel.Namespace, monitoringNS, nil
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

// monitoringNamespaceFromRelease extracts monitoring.namespaceOverride from a
// release. User-supplied rel.Config overrides take priority over chart defaults.
func monitoringNamespaceFromRelease(rel *release.Release) (string, error) {
	for _, vals := range []map[string]interface{}{rel.Config, rel.Chart.Values} {
		if monitoring, ok := vals["monitoring"].(map[string]interface{}); ok {
			if ns, ok := monitoring["namespaceOverride"].(string); ok && ns != "" {
				return ns, nil
			}
		}
	}
	return "", errors.New("monitoring.namespaceOverride not found in OpenEverest Helm release values")
}
