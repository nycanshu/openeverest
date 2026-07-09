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

export const Messages = {
  title: 'Instance Presets',
  subtitle:
    'Reusable, cluster-scoped templates that pre-fill instance configuration. Namespace-specific values are selected when an instance is created.',
  create: 'Create Instance Preset',
  createFromInstance: 'Create from Instance',
  empty: {
    title: 'No Instance Presets yet',
    description:
      'Create a preset from scratch or from an existing instance to reuse its configuration.',
  },
  actions: {
    view: 'View',
    edit: 'Edit',
    delete: 'Delete',
  },
  card: {
    provider: 'Provider',
    topology: 'Topology',
    version: 'Version',
    replicas: 'Replicas',
    cpu: 'CPU',
    memory: 'Memory',
    storage: 'Storage',
    notSet: '—',
  },
  deleteDialog: {
    header: 'Delete Instance Preset',
    confirmButton: 'Delete',
    cancelButton: 'Cancel',
    message: (name: string) =>
      `Are you sure you want to delete the Instance Preset "${name}"? This action cannot be undone.`,
  },
  fromInstance: {
    header: 'Create Instance Preset from Instance',
    description:
      'Select an existing instance to capture its configuration as a reusable preset. Namespace-specific values are not copied.',
    instanceLabel: 'Source instance',
    instancePlaceholder: 'Select an instance',
    nameLabel: 'Preset name',
    namePlaceholder: 'e.g. mongodb-production',
    noInstances: 'No instances available.',
    submit: 'Create Preset',
    cancel: 'Cancel',
  },
} as const;
