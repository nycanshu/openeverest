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

import { describe, it, expect, beforeAll } from 'vitest';
import {
  applyPresetOverrides,
  applyPresetOverridesToUiSchema,
  EMPTY_STORAGE_CLASS_LABEL,
} from './apply-preset-overrides';
import { providerRegistry } from '../../api-providers/registry';
import { buildSectionZodSchema } from '../schema-builder/build-section-zod-schema';
import { buildDefaultsFromComponents } from '../default-values/build-defaults-from-components';
import { convertToNestedObject } from '../default-values/convert-to-nested-object';
import {
  Component,
  ComponentGroup,
  FieldType,
  Section,
  TopologyUISchemas,
} from '../../ui-generator.types';

// Register the providers the overrides rely on. Detection is by provider key
// (StorageClass vs everything else). Guarded so the test is robust whether or
// not the real providers module has already registered them.
beforeAll(() => {
  const stub = () =>
    ({
      description: 'test',
      useOptions: () => ({
        options: [],
        isLoading: false,
        error: null,
        isEmpty: true,
        rawData: undefined,
      }),
      emptyStateFallback: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

  if (!providerRegistry.has('monitoringConfigs')) {
    providerRegistry.register('monitoringConfigs', stub());
  }
  if (!providerRegistry.has('storageClasses')) {
    providerRegistry.register('storageClasses', stub());
  }
});

const makeComponent = (
  path: string,
  overrides: Partial<Component> = {}
): Component =>
  ({
    uiType: FieldType.Text,
    path,
    fieldParams: { label: path },
    ...overrides,
  }) as Component;

const namespaceField = () =>
  makeComponent('spec.monitoring', {
    dataSource: { provider: 'monitoringConfigs' } as Component['dataSource'],
    validation: { required: true },
  });

const clusterField = () =>
  makeComponent('spec.storageClass', {
    dataSource: { provider: 'storageClasses' } as Component['dataSource'],
    validation: { required: true },
  });

describe('applyPresetOverrides', () => {
  it('hides namespace-scoped fields and strips their validation and data source', () => {
    const sections: Record<string, Section> = {
      advanced: {
        components: { monitoring: namespaceField() },
      },
    };

    const result = applyPresetOverrides(sections);
    const comp = result.advanced.components.monitoring as Component;

    expect(comp.uiType).toBe('hidden');
    expect(comp.dataSource).toBeUndefined();
    expect(comp.validation).toBeUndefined();
  });

  it('keeps cluster-scoped fields selectable but relaxes required and allows empty', () => {
    const sections: Record<string, Section> = {
      advanced: {
        components: { storageClass: clusterField() },
      },
    };

    const result = applyPresetOverrides(sections);
    const comp = result.advanced.components.storageClass as Component;
    const fieldParams = comp.fieldParams as Record<string, unknown>;

    expect(comp.uiType).toBe(FieldType.Text);
    expect(comp.dataSource).toBeDefined();
    expect(comp.validation?.required).toBe(false);
    expect(fieldParams.displayEmpty).toBe(true);
    expect(fieldParams.emptyOptionLabel).toBe(EMPTY_STORAGE_CLASS_LABEL);
    expect(fieldParams.allowEmptyOption).toBeUndefined();
  });

  it('leaves fields without a data source untouched', () => {
    const plain = makeComponent('spec.name', {
      validation: { required: true },
    });
    const sections: Record<string, Section> = {
      basic: { components: { name: plain } },
    };

    const result = applyPresetOverrides(sections);
    expect(result.basic.components.name).toEqual(plain);
  });

  it('recurses into nested component groups', () => {
    const group: ComponentGroup = {
      uiType: 'group',
      components: {
        monitoring: namespaceField(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const sections: Record<string, Section> = {
      advanced: { components: { grp: group } },
    };

    const result = applyPresetOverrides(sections);
    const nested = (result.advanced.components.grp as ComponentGroup).components
      .monitoring as Component;
    expect(nested.uiType).toBe('hidden');
  });
});

describe('applyPresetOverridesToUiSchema', () => {
  it('applies overrides across every topology and preserves non-section keys', () => {
    const uiSchema = {
      replicaSet: {
        someMeta: 'keep-me',
        sections: {
          advanced: {
            components: {
              monitoring: namespaceField(),
              storageClass: clusterField(),
            },
          },
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as TopologyUISchemas;

    const result = applyPresetOverridesToUiSchema(uiSchema);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topology = result.replicaSet as any;

    expect(topology.someMeta).toBe('keep-me');
    expect(topology.sections.advanced.components.monitoring.uiType).toBe(
      'hidden'
    );
    expect(
      topology.sections.advanced.components.storageClass.validation.required
    ).toBe(false);
  });
});

describe('preset override → Zod validation relaxation', () => {
  const sections: Record<string, Section> = {
    advanced: {
      components: {
        monitoring: namespaceField(),
        storageClass: clusterField(),
      },
    },
  };

  // Mirrors what the real form feeds to validation: default values built from
  // the (possibly relaxed) schema via getDefaultValues. This matters because a
  // field relaxed to `hidden` is keyed under a `g-<section>` wrapper, which the
  // generated Zod schema expects to be present.
  const buildDefaults = (secs: Record<string, Section>) => {
    const flat: Record<string, unknown> = {};
    for (const [sectionKey, section] of Object.entries(secs)) {
      Object.assign(
        flat,
        buildDefaultsFromComponents(section.components, sectionKey)
      );
    }
    return convertToNestedObject(flat);
  };

  it('enforces required namespace/cluster fields before relaxation', () => {
    const { schema } = buildSectionZodSchema('advanced', sections);
    const result = schema.safeParse(buildDefaults(sections));
    expect(result.success).toBe(false);
  });

  it('drops required for namespace- and cluster-scoped fields after relaxation', () => {
    const relaxed = applyPresetOverrides(sections);
    const { schema } = buildSectionZodSchema('advanced', relaxed);
    const result = schema.safeParse(buildDefaults(relaxed));
    expect(result.success).toBe(true);
  });
});
