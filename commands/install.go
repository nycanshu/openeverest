// everest
// Copyright (C) 2023 Percona LLC
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

// Package commands ...
package commands

import (
	"os"

	"github.com/spf13/cobra"

	"github.com/openeverest/openeverest/v2/pkg/cli"
	"github.com/openeverest/openeverest/v2/pkg/cli/helm"
	"github.com/openeverest/openeverest/v2/pkg/cli/install"
	"github.com/openeverest/openeverest/v2/pkg/cli/namespaces"
	"github.com/openeverest/openeverest/v2/pkg/common"
	"github.com/openeverest/openeverest/v2/pkg/logger"
	"github.com/openeverest/openeverest/v2/pkg/output"
)

var (
	installCmd = &cobra.Command{
		Use:    "install [flags]",
		Args:   cobra.NoArgs,
		Short:  "Install OpenEverest",
		Long:   "Install OpenEverest",
		PreRun: installPreRun,
		Run:    installRun,
	}
	installCfg      = install.NewInstallConfig()
	namespacesToAdd string
)

func init() {
	rootCmd.AddCommand(installCmd)

	// local command flags
	installCmd.Flags().StringVar(&installCfg.Namespace, cli.FlagInstallSystemNamespace, "everest-system", "Namespace where OpenEverest system components will be installed")
	_ = installCmd.Flags().MarkHidden(cli.FlagInstallSystemNamespace)
	installCmd.Flags().StringVar(&namespacesToAdd, cli.FlagNamespaces, common.DefaultDBNamespaceName, "Comma-separated list of namespaces to provision after install")
	installCmd.Flags().StringVar(&installCfg.VersionMetadataURL, cli.FlagVersionMetadataURL, "https://check.percona.com", "URL to retrieve version metadata information from")
	installCmd.Flags().StringVar(&installCfg.Version, cli.FlagVersion, "", "Everest version to install. By default the latest version is installed")
	installCmd.Flags().BoolVar(&installCfg.DisableTelemetry, cli.FlagDisableTelemetry, false, "Disable telemetry")
	_ = installCmd.Flags().MarkHidden(cli.FlagDisableTelemetry)
	installCmd.Flags().BoolVar(&installCfg.SkipEnvDetection, cli.FlagSkipEnvDetection, false, "Skip detecting Kubernetes environment where Everest is installed")

	// --helm.* flags
	installCmd.Flags().StringVar(&installCfg.HelmConfig.ChartDir, helm.FlagChartDir, "", "Path to the chart directory. If not set, the chart will be downloaded from the repository")
	_ = installCmd.Flags().MarkHidden(helm.FlagChartDir)
	installCmd.Flags().StringVar(&installCfg.HelmConfig.RepoURL, helm.FlagRepository, helm.DefaultHelmRepoURL, "Helm chart repository to download the Everest charts from")
	installCmd.Flags().StringSliceVar(&installCfg.HelmConfig.Values.Values, helm.FlagHelmSet, []string{}, "Set helm values on the command line (can specify multiple values with commas: key1=val1,key2=val2)")
	installCmd.Flags().StringSliceVarP(&installCfg.HelmConfig.Values.ValueFiles, helm.FlagHelmValues, "f", []string{}, "Specify values in a YAML file or a URL (can specify multiple)")
}

func installPreRun(cmd *cobra.Command, _ []string) { //nolint:revive
	// Copy global flags to config
	installCfg.Pretty = rootCmdFlags.Pretty
	installCfg.KubeconfigPath = rootCmdFlags.KubeconfigPath

	if namespacesToAdd != "" {
		nsList := namespaces.ParseNamespaceNames(namespacesToAdd)
		nsAddCfg := namespaces.NewNamespaceAddConfig()
		nsAddCfg.KubeconfigPath = rootCmdFlags.KubeconfigPath
		nsAddCfg.SystemNamespace = installCfg.Namespace
		if err := nsAddCfg.ValidateNamespaces(cmd.Context(), nsList); err != nil {
			output.PrintError(err, logger.GetLogger(), installCfg.Pretty)
			os.Exit(1)
		}
		nsAddCfg.NamespaceList = nsList
		installCfg.NamespaceAddConfig = nsAddCfg
	}

	// Check if Everest is already installed.
	if err := install.CheckEverestAlreadyInstalled(cmd.Context(), logger.GetLogger(), installCfg.KubeconfigPath, installCfg.Namespace); err != nil {
		output.PrintError(err, logger.GetLogger(), installCfg.Pretty)
		os.Exit(1)
	}
}

func installRun(cmd *cobra.Command, _ []string) { //nolint:revive
	op, err := install.NewInstall(installCfg, logger.GetLogger())
	if err != nil {
		output.PrintError(err, logger.GetLogger(), installCfg.Pretty)
		os.Exit(1)
	}

	if err := op.Run(cmd.Context()); err != nil {
		output.PrintError(err, logger.GetLogger(), installCfg.Pretty)
		os.Exit(1)
	}
}
