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

// Package namespaces provides the functionality to manage namespaces.
package namespaces

import (
	"context"
	"fmt"

	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/openeverest/openeverest/v2/pkg/cli/steps"
	cliutils "github.com/openeverest/openeverest/v2/pkg/cli/utils"
	"github.com/openeverest/openeverest/v2/pkg/common"
	"github.com/openeverest/openeverest/v2/pkg/kubernetes"
)

type (
	// NamespaceAddConfig is the configuration for adding namespaces.
	NamespaceAddConfig struct {
		// NamespaceList is a list of namespaces to be managed by Everest.
		// The property shall be set in case the namespaces are parsed and validated using ValidateNamespaces func.
		NamespaceList []string
		// KubeconfigPath is the path to the kubeconfig file.
		KubeconfigPath string
		// SystemNamespace is the namespace where OpenEverest is installed.
		// Required during install (when Helm discovery is not available).
		SystemNamespace string
		// TakeOwnership make an existing namespace managed by Everest.
		TakeOwnership bool
		// Pretty if set print the output in pretty mode.
		Pretty bool
	}

	// NamespaceAdder provides the functionality to add namespaces.
	NamespaceAdder struct {
		l          *zap.SugaredLogger
		cfg        NamespaceAddConfig
		kubeClient kubernetes.KubernetesConnector
	}
)

// --- NamespaceAddConfig functions

// NewNamespaceAddConfig returns a new NamespaceAddConfig.
func NewNamespaceAddConfig() NamespaceAddConfig {
	return NamespaceAddConfig{
		Pretty: true,
	}
}

// ValidateNamespaces validates the provided list of namespaces.
// It validates namespace names and namespace ownership.
func (cfg *NamespaceAddConfig) ValidateNamespaces(ctx context.Context, nsList []string) error {
	var (
		k   kubernetes.KubernetesConnector
		err error
	)
	if cfg.SystemNamespace != "" {
		k, err = kubernetes.New(cfg.KubeconfigPath, zap.NewNop().Sugar(), cfg.SystemNamespace)
	} else {
		k, err = cliutils.NewKubeConnector(zap.NewNop().Sugar(), cfg.KubeconfigPath)
	}
	if err != nil {
		return err
	}

	if err := validateNamespaceNames(nsList, k.Namespace()); err != nil {
		return err
	}

	for _, ns := range nsList {
		if err := cfg.validateNamespaceOwnership(ctx, k, ns); err != nil {
			return err
		}
	}
	return nil
}

// validateNamespaceOwnership validates the namespace existence and ownership.
func (cfg *NamespaceAddConfig) validateNamespaceOwnership(
	ctx context.Context,
	k kubernetes.KubernetesConnector,
	namespace string,
) error {
	nsExists, ownedByEverest, err := namespaceExists(ctx, k, namespace)
	if err != nil {
		return err
	}

	if nsExists && ownedByEverest {
		return NewErrNamespaceAlreadyManagedByEverest(namespace)
	}

	if nsExists && !cfg.TakeOwnership {
		return NewErrNamespaceAlreadyExists(namespace)
	}

	return nil
}

// --- NewNamespaceAdd functions

// NewNamespaceAdd returns a new CLI operation to add namespaces.
func NewNamespaceAdd(c NamespaceAddConfig, l *zap.SugaredLogger) (*NamespaceAdder, error) {
	if len(c.NamespaceList) == 0 {
		return nil, ErrNamespaceListEmpty
	}

	n := &NamespaceAdder{
		cfg: c,
		l:   l.With("component", "namespace-adder"),
	}
	if c.Pretty {
		n.l = zap.NewNop().Sugar()
	}

	var (
		k   kubernetes.KubernetesConnector
		err error
	)
	if c.SystemNamespace != "" {
		k, err = kubernetes.New(c.KubeconfigPath, n.l, c.SystemNamespace)
	} else {
		k, err = cliutils.NewKubeConnector(n.l, c.KubeconfigPath)
	}
	if err != nil {
		return nil, err
	}
	n.kubeClient = k
	return n, nil
}

// Run namespace add operation.
func (n *NamespaceAdder) Run(ctx context.Context) error {
	if _, err := cliutils.CheckHelmInstallation(ctx, n.kubeClient); err != nil {
		return err
	}
	return steps.RunStepsWithSpinner(ctx, n.l, n.GetNamespaceInstallSteps(), n.cfg.Pretty)
}

// GetNamespaceInstallSteps returns the steps to provision namespaces.
func (n *NamespaceAdder) GetNamespaceInstallSteps() []steps.Step {
	var installSteps []steps.Step
	for _, namespace := range n.cfg.NamespaceList {
		installSteps = append(installSteps, n.newStepProvisionNamespace(namespace))
	}
	return installSteps
}

func (n *NamespaceAdder) newStepProvisionNamespace(namespace string) steps.Step {
	return steps.Step{
		Desc: fmt.Sprintf("Provisioning namespace '%s'", namespace),
		F: func(ctx context.Context) error {
			return n.provisionNamespace(ctx, namespace)
		},
	}
}

func (n *NamespaceAdder) provisionNamespace(ctx context.Context, namespace string) error {
	nsExists, _, err := namespaceExists(ctx, n.kubeClient, namespace)
	if err != nil {
		return err
	}
	if !nsExists {
		ns := &corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name:   namespace,
				Labels: map[string]string{common.KubernetesManagedByLabel: common.Everest},
			},
		}
		_, err = n.kubeClient.CreateNamespace(ctx, ns)
		return err
	}
	ns, err := n.kubeClient.GetNamespace(ctx, types.NamespacedName{Name: namespace})
	if err != nil {
		return err
	}
	labels := ns.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}
	labels[common.KubernetesManagedByLabel] = common.Everest
	ns.SetLabels(labels)
	_, err = n.kubeClient.UpdateNamespace(ctx, ns)
	return err
}
