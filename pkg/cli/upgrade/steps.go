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

package upgrade

import (
	"context"
	"fmt"

	goversion "github.com/hashicorp/go-version"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openeverest/openeverest/v2/pkg/cli/helm"
	helmutils "github.com/openeverest/openeverest/v2/pkg/cli/helm/utils"
	"github.com/openeverest/openeverest/v2/pkg/cli/steps"
	"github.com/openeverest/openeverest/v2/pkg/cli/utils"
	"github.com/openeverest/openeverest/v2/pkg/common"
	"github.com/openeverest/openeverest/v2/pkg/version"
)

func (u *Upgrade) newStepUpgradeCRDs() steps.Step {
	return steps.Step{
		Desc: "Upgrading Custom Resource Definitions",
		F: func(ctx context.Context) error {
			return u.upgradeCustomResourceDefinitions(ctx)
		},
	}
}

func (u *Upgrade) newStepUpgradeHelmChart() steps.Step {
	return steps.Step{
		Desc: "Upgrading Helm chart",
		F: func(ctx context.Context) error {
			return u.upgradeHelmChart(ctx)
		},
	}
}

func (u *Upgrade) newStepEnsureEverestAPI() steps.Step {
	return steps.Step{
		Desc: "Ensuring Everest API deployment is ready",
		F: func(ctx context.Context) error {
			return u.waitForDeployment(ctx, common.PerconaEverestDeploymentName, u.kubeConnector.Namespace())
		},
	}
}

func (u *Upgrade) waitForDeployment(ctx context.Context, name, namespace string) error {
	u.l.Infof("Waiting for Deployment '%s' in namespace '%s'", name, namespace)
	if err := u.kubeConnector.WaitForRollout(ctx, types.NamespacedName{Namespace: namespace, Name: name}); err != nil {
		return err
	}
	u.l.Infof("Deployment '%s' in namespace '%s' is ready", name, namespace)
	return nil
}

func (u *Upgrade) upgradeCustomResourceDefinitions(ctx context.Context) error {
	// Use legacy method for versions below 1.9.0.
	if goversion.Must(goversion.NewVersion(u.upgradeToVersion)).LessThan(goversion.Must(goversion.NewVersion("1.9.0"))) &&
		!version.IsDev(u.upgradeToVersion) {
		return u.legacyUpgradeCRDs(ctx)
	}
	installer := helm.Installer{
		ReleaseName:      helm.EverestCRDChartName,
		ReleaseNamespace: u.kubeConnector.Namespace(),
	}
	if err := installer.Init(u.config.KubeconfigPath, helm.ChartOptions{
		URL:       u.config.RepoURL,
		Directory: utils.CRDSubChartPath(u.config.ChartDir),
		Name:      helm.EverestCRDChartName,
		Version:   u.upgradeToVersion,
	}); err != nil {
		return fmt.Errorf("could not initialize Helm installer: %w", err)
	}
	return installer.Install(ctx)
}

// legacyUpgradeCRDs upgrades the CRDs for any version below 1.9.0.
// This is kept for backward compatibility with versions below 1.9.0.
func (u *Upgrade) legacyUpgradeCRDs(ctx context.Context) error {
	manifests, err := u.helmInstaller.RenderTemplates(ctx)
	if err != nil {
		return fmt.Errorf("could not render Helm templates: %w", err)
	}
	crds, err := manifests.GetCRDs()
	if err != nil {
		return fmt.Errorf("could not get CRDs: %w", err)
	}
	return u.kubeConnector.ApplyManifestFile(ctx, helmutils.YAMLStringsToBytes(crds), u.kubeConnector.Namespace())
}

func (u *Upgrade) upgradeHelmChart(ctx context.Context) error {
	// Upgrade the main chart.
	return u.helmInstaller.Upgrade(ctx, helm.UpgradeOptions{
		ReuseValues:          u.config.ReuseValues,
		ResetValues:          u.config.ResetValues,
		ResetThenReuseValues: u.config.ResetThenReuseValues,
	})
}
