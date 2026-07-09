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

import { describe, it, expect } from 'vitest';
import { buildPresetSpec } from './build-preset-spec';
import { PresetFormValues } from './preset-form.types';

describe('buildPresetSpec', () => {
  it('strips presetName and nests schema fields under the provider', () => {
    const formValue = {
      presetName: 'my-preset',
      provider: 'percona-server-mongodb',
      topology: { type: 'replicaSet' },
      spec: {
        components: { engine: { replicas: 3 } },
      },
    } as unknown as PresetFormValues;

    const result = buildPresetSpec(formValue) as Record<string, unknown>;

    expect(result).toMatchObject({
      provider: 'percona-server-mongodb',
      topology: { type: 'replicaSet' },
      components: { engine: { replicas: 3 } },
    });
    expect(result.presetName).toBeUndefined();
  });

  it('deep-merges top-level fields with the spec object', () => {
    const formValue = {
      presetName: 'p',
      provider: 'percona-server-mongodb',
      topology: { type: 'sharded' },
      spec: {
        topology: { config: { numShards: 2 } },
        components: { engine: { replicas: 3 } },
      },
    } as unknown as PresetFormValues;

    const result = buildPresetSpec(formValue) as Record<string, unknown>;

    expect(result.topology).toMatchObject({
      type: 'sharded',
      config: { numShards: 2 },
    });
    expect(result.components).toMatchObject({ engine: { replicas: 3 } });
  });

  it('handles a missing spec object', () => {
    const formValue = {
      presetName: 'p',
      provider: 'percona-server-mongodb',
      topology: { type: 'replicaSet' },
    } as unknown as PresetFormValues;

    const result = buildPresetSpec(formValue) as Record<string, unknown>;

    expect(result.provider).toBe('percona-server-mongodb');
    expect(result.topology).toMatchObject({ type: 'replicaSet' });
  });
});
