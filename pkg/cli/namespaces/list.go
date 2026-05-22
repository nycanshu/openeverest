// everest
// Copyright (C) 2025 Percona LLC
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

// Package namespaces provides the functionality to manage namespaces.
package namespaces

import (
	"context"
	"slices"

	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	cliutils "github.com/openeverest/openeverest/v2/pkg/cli/utils"
	"github.com/openeverest/openeverest/v2/pkg/common"
	"github.com/openeverest/openeverest/v2/pkg/kubernetes"
)

// getSkipNamespaces returns a list of namespaces that cannot be added to Everest management.
// It contains Kubernetes system, reserved by Everest core and cloud providers specific namespaces.
func getSkipNamespaces(systemNamespace string) []string {
	return []string{
		// Kubernetes native system namespaces.
		"kube-system",
		"kube-public",
		"kube-node-lease",

		// Everest core namespaces.
		systemNamespace,
		common.MonitoringNamespace,

		// GKE namespaces.
		"gke-managed-cim",
		"gke-managed-system",
		"gke-managed-volumepopulator",
		"gmp-public",
		"gmp-system",
	}
}

type (
	// NamespaceListConfig is the configuration for the  namespace listing operation.
	NamespaceListConfig struct {
		// KubeconfigPath is a path to a kubeconfig
		KubeconfigPath string
		// Pretty if set print the output in pretty mode.
		Pretty bool
		// ListAllNamespaces if set, list all namespaces.
		// Note: this flag skips namespaces that cannot be added to Everest management
		// (i.e. Kubernetes system, specific to cloud providers and Everest Core namespaces).
		ListAllNamespaces bool
	}

	// NamespaceInfo contains information about a namespace.
	NamespaceInfo struct {
		// Name is the namespace name.
		Name string
		// ManagedByEverest indicates whether the namespace is managed by Everest.
		ManagedByEverest bool
	}

	// NamespaceLister is the CLI operation to list namespaces.
	NamespaceLister struct {
		cfg        NamespaceListConfig
		kubeClient kubernetes.KubernetesConnector
		l          *zap.SugaredLogger
	}
)

// NewNamespaceLister returns a new CLI operation to list namespaces.
func NewNamespaceLister(c NamespaceListConfig, l *zap.SugaredLogger) (*NamespaceLister, error) {
	n := &NamespaceLister{
		cfg: c,
		l:   l.With("component", "namespace-lister"),
	}
	if c.Pretty {
		n.l = zap.NewNop().Sugar()
	}

	k, err := cliutils.NewKubeConnector(n.l, n.cfg.KubeconfigPath)
	if err != nil {
		return nil, err
	}
	n.kubeClient = k
	return n, nil
}

// Run the namespace list operation.
func (nsL *NamespaceLister) Run(ctx context.Context) ([]NamespaceInfo, error) {
	var err error
	// This command expects a Helm based installation (< 1.4.0)
	_, err = cliutils.CheckHelmInstallation(ctx, nsL.kubeClient)
	if err != nil {
		return nil, err
	}

	var nsList *corev1.NamespaceList
	opts := []client.ListOption{client.MatchingFields{"status.phase": string(corev1.NamespaceActive)}}

	if !nsL.cfg.ListAllNamespaces {
		// show only namespaces already managed by Everest.
		opts = append(opts, client.MatchingLabels{common.KubernetesManagedByLabel: common.Everest})
	}

	if nsList, err = nsL.kubeClient.ListNamespaces(ctx, opts...); err != nil {
		return nil, err
	}

	// filter out namespaces that are listed in skipNamespaces and non-active namespaces.
	skip := getSkipNamespaces(nsL.kubeClient.Namespace())
	nsList.Items = slices.DeleteFunc(nsList.Items, func(ns corev1.Namespace) bool {
		return slices.Contains(skip, ns.Name)
	})

	var toReturn []NamespaceInfo
	for _, ns := range nsList.Items {
		toReturn = append(toReturn, NamespaceInfo{
			Name:             ns.GetName(),
			ManagedByEverest: isManagedByEverest(&ns),
		})
	}
	return toReturn, nil
}
