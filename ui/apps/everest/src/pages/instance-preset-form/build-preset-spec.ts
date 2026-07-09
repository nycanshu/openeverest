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

import { deepMerge } from 'components/ui-generator/utils/object-path/object-path';
import { InstancePreset } from 'shared-types/api.types';
import { PresetFormValues } from './preset-form.types';

/**
 * Builds an InstancePreset spec from post-processed form values.
 *
 * Mirrors the Instance spec builder: the schema-driven fields are nested under
 * `spec` while identity/layout fields (`provider`, `topology`) sit at the top
 * level. The preset name is metadata (not part of spec) and is stripped here.
 * Namespace-scoped references are left empty by the preset form, so no extra
 * stripping is required.
 */
export const buildPresetSpec = (
  formValue: PresetFormValues
): NonNullable<InstancePreset['spec']> => {
  const { presetName, provider, spec, ...rest } = formValue;
  void presetName;

  return {
    provider,
    ...(deepMerge(
      rest as Record<string, unknown>,
      (spec as Record<string, unknown>) ?? {}
    ) as Record<string, unknown>),
  } as NonNullable<InstancePreset['spec']>;
};
