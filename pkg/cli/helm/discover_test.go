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
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart"
	kubefake "helm.sh/helm/v3/pkg/kube/fake"
	"helm.sh/helm/v3/pkg/release"
	"helm.sh/helm/v3/pkg/storage"
	"helm.sh/helm/v3/pkg/storage/driver"
)

func newTestActionCfg(t *testing.T, ns string) *action.Configuration {
	t.Helper()
	cfg := &action.Configuration{}
	require.NoError(t, cfg.Init(nil, ns, "memory", nil))
	cfg.KubeClient = &kubefake.PrintingKubeClient{Out: io.Discard}
	return cfg
}

func storeRelease(t *testing.T, cfg *action.Configuration, rel *release.Release) {
	t.Helper()
	mem := driver.NewMemory()
	mem.SetNamespace(rel.Namespace)
	cfg.Releases = storage.Init(mem)
	require.NoError(t, cfg.Releases.Create(rel))
}

func TestFindEverestRelease(t *testing.T) {
	t.Parallel()

	t.Run("finds everest release", func(t *testing.T) {
		t.Parallel()
		cfg := newTestActionCfg(t, "custom-everest")
		storeRelease(t, cfg, &release.Release{
			Name:      "custom-everest",
			Namespace: "custom-everest",
			Version:   1,
			Info:      &release.Info{Status: release.StatusDeployed},
			Chart:     &chart.Chart{Metadata: &chart.Metadata{Name: EverestChartName}},
		})

		rel, err := findEverestRelease(cfg)
		require.NoError(t, err)
		assert.Equal(t, "custom-everest", rel.Namespace)
	})

	t.Run("no matching release", func(t *testing.T) {
		t.Parallel()
		cfg := newTestActionCfg(t, "default")
		storeRelease(t, cfg, &release.Release{
			Name:      "other-app",
			Namespace: "default",
			Version:   1,
			Info:      &release.Info{Status: release.StatusDeployed},
			Chart:     &chart.Chart{Metadata: &chart.Metadata{Name: "other-chart"}},
		})

		_, err := findEverestRelease(cfg)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no OpenEverest Helm release found")
	})

	t.Run("empty release store", func(t *testing.T) {
		t.Parallel()
		cfg := newTestActionCfg(t, "")

		_, err := findEverestRelease(cfg)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no OpenEverest Helm release found")
	})
}

func TestMonitoringNamespaceFromRelease(t *testing.T) {
	t.Parallel()

	t.Run("reads from user config", func(t *testing.T) {
		t.Parallel()
		rel := &release.Release{
			Chart:  &chart.Chart{Metadata: &chart.Metadata{Name: EverestChartName}},
			Config: map[string]interface{}{"monitoring": map[string]interface{}{"namespaceOverride": "everest-monitoring"}},
		}
		ns, err := monitoringNamespaceFromRelease(rel)
		require.NoError(t, err)
		assert.Equal(t, "everest-monitoring", ns)
	})

	t.Run("user config wins over chart defaults", func(t *testing.T) {
		t.Parallel()
		rel := &release.Release{
			Chart: &chart.Chart{
				Metadata: &chart.Metadata{Name: EverestChartName},
				Values:   map[string]interface{}{"monitoring": map[string]interface{}{"namespaceOverride": "everest-monitoring"}},
			},
			Config: map[string]interface{}{"monitoring": map[string]interface{}{"namespaceOverride": "custom-monitoring"}},
		}
		ns, err := monitoringNamespaceFromRelease(rel)
		require.NoError(t, err)
		assert.Equal(t, "custom-monitoring", ns)
	})

	t.Run("falls back to chart defaults when config missing", func(t *testing.T) {
		t.Parallel()
		rel := &release.Release{
			Chart: &chart.Chart{
				Metadata: &chart.Metadata{Name: EverestChartName},
				Values:   map[string]interface{}{"monitoring": map[string]interface{}{"namespaceOverride": "everest-monitoring"}},
			},
			Config: nil,
		}
		ns, err := monitoringNamespaceFromRelease(rel)
		require.NoError(t, err)
		assert.Equal(t, "everest-monitoring", ns)
	})

	t.Run("error when value missing from both config and chart defaults", func(t *testing.T) {
		t.Parallel()
		rel := &release.Release{
			Chart: &chart.Chart{
				Metadata: &chart.Metadata{Name: EverestChartName},
				Values:   map[string]interface{}{"monitoring": map[string]interface{}{}},
			},
			Config: nil,
		}
		_, err := monitoringNamespaceFromRelease(rel)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "monitoring.namespaceOverride not found")
	})

	t.Run("error when monitoring key absent", func(t *testing.T) {
		t.Parallel()
		rel := &release.Release{
			Chart:  &chart.Chart{Metadata: &chart.Metadata{Name: EverestChartName}, Values: map[string]interface{}{}},
			Config: nil,
		}
		_, err := monitoringNamespaceFromRelease(rel)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "monitoring.namespaceOverride not found")
	})
}
