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

import { getProviderScope } from '../../api-providers/registry';
import {
  Component,
  ComponentGroup,
  Section,
  Topology,
  TopologyUISchemas,
} from '../../ui-generator.types';

export const EMPTY_STORAGE_CLASS_LABEL = 'Use cluster default';

/**
 * Transforms a preprocessed UI schema so it is valid for an Instance Preset.
 *
 * Instance Presets are cluster-scoped and carry no namespace, so fields backed
 * by a data-source provider are relaxed based on that provider's scope:
 *
 * - Namespace-scoped fields (MonitoringConfig, Secret, ConfigMap) are converted
 *   to `hidden`, with their validation and data-source stripped. They are not
 *   rendered, are not prefetched, and their value stays empty — any schema
 *   validation that required a namespace-scoped value is therefore ignored.
 *
 * - Cluster-scoped fields (StorageClass) stay selectable but have `required`
 *   relaxed and gain an empty "use cluster default" option, so a preset may be
 *   installed with an empty StorageClass (resolved to the cluster default when
 *   an Instance is later created).
 *
 * Must run after applyModeOverrides so that its output is not overwritten.
 */
const applyToComponent = (
  item: Component | ComponentGroup
): Component | ComponentGroup => {
  if (
    (item.uiType === 'group' || item.uiType === 'hidden') &&
    'components' in item
  ) {
    const group = item as ComponentGroup;
    return {
      ...group,
      components: applyToComponents(group.components),
    };
  }

  const component = item as Component;

  if (!component.dataSource) {
    return component;
  }

  const scope = getProviderScope(component.dataSource.provider);

  // Namespace-scoped → hide + strip validation and data-source.
  if (scope === 'namespace') {
    const rest = { ...component } as Record<string, unknown>;
    delete rest.dataSource;
    delete rest.validation;
    return {
      ...rest,
      uiType: 'hidden',
    } as unknown as Component;
  }

  // Cluster-scoped → keep selectable, relax required, allow empty value.
  if (scope === 'cluster') {
    return {
      ...component,
      validation: component.validation
        ? { ...component.validation, required: false }
        : undefined,
      fieldParams: {
        ...component.fieldParams,
        displayEmpty: true,
        allowEmptyOption: true,
        emptyOptionLabel: EMPTY_STORAGE_CLASS_LABEL,
      },
    } as Component;
  }

  return component;
};

const applyToComponents = (
  components: Record<string, Component | ComponentGroup>
): Record<string, Component | ComponentGroup> =>
  Object.fromEntries(
    Object.entries(components).map(([key, item]) => [
      key,
      applyToComponent(item),
    ])
  );

export const applyPresetOverrides = (
  sections: Record<string, Section>
): Record<string, Section> =>
  Object.fromEntries(
    Object.entries(sections).map(([sectionKey, section]) => [
      sectionKey,
      {
        ...section,
        components: applyToComponents(section.components),
      },
    ])
  );

/**
 * Applies {@link applyPresetOverrides} across every topology of a full UI
 * schema. Used to pre-transform a provider's schema before it is fed to the
 * form engine, so both the rendered fields and the generated Zod validation
 * are relaxed for Instance Presets.
 */
export const applyPresetOverridesToUiSchema = (
  uiSchema: TopologyUISchemas
): TopologyUISchemas => {
  const result: Record<string, unknown> = {};
  for (const [topologyKey, topology] of Object.entries(uiSchema)) {
    if (
      topology &&
      typeof topology === 'object' &&
      'sections' in (topology as Topology)
    ) {
      const typedTopology = topology as Topology;
      result[topologyKey] = {
        ...typedTopology,
        sections: applyPresetOverrides(typedTopology.sections),
      };
    } else {
      result[topologyKey] = topology;
    }
  }
  return result as TopologyUISchemas;
};
