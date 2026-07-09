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
import { z } from 'zod';
import { getPresetValidationSchema } from './preset-form-schema';

const baseFields = {
  provider: 'percona-server-mongodb',
  topology: { type: 'replicaSet' },
};

describe('getPresetValidationSchema', () => {
  it('accepts a valid, unique preset name', () => {
    const schema = getPresetValidationSchema([]);
    const result = schema.safeParse({
      ...baseFields,
      presetName: 'valid-name',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty preset name', () => {
    const schema = getPresetValidationSchema([]);
    const result = schema.safeParse({ ...baseFields, presetName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a duplicate preset name', () => {
    const schema = getPresetValidationSchema(['existing-preset']);
    const result = schema.safeParse({
      ...baseFields,
      presetName: 'existing-preset',
    });
    expect(result.success).toBe(false);
  });

  it('allows a name that is not among the existing names', () => {
    const schema = getPresetValidationSchema(['other-preset']);
    const result = schema.safeParse({
      ...baseFields,
      presetName: 'new-preset',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing provider', () => {
    const schema = getPresetValidationSchema([]);
    const result = schema.safeParse({
      presetName: 'valid-name',
      provider: '',
      topology: { type: 'replicaSet' },
    });
    expect(result.success).toBe(false);
  });

  it('combines with the OpenAPI validation schema and surfaces its issues', () => {
    const openApi = z.object({ extra: z.string() });
    const schema = getPresetValidationSchema([], openApi);

    const missing = schema.safeParse({
      ...baseFields,
      presetName: 'valid-name',
    });
    expect(missing.success).toBe(false);

    const complete = schema.safeParse({
      ...baseFields,
      presetName: 'valid-name',
      extra: 'provided',
    });
    expect(complete.success).toBe(true);
  });
});
