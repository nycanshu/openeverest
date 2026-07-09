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

import { z } from 'zod';
import { MAX_DB_CLUSTER_NAME_LENGTH } from 'consts';
import { rfc_123_schema } from 'utils/common-validation';
import { PresetFormFields } from './preset-form.types';
import { Messages } from './preset-form.messages';

const basePresetSchema = (existingNames: string[]) =>
  z
    .object({
      [PresetFormFields.presetName]: rfc_123_schema({
        fieldName: 'preset name',
      })
        .max(MAX_DB_CLUSTER_NAME_LENGTH, Messages.errors.presetName.tooLong)
        .nonempty(),
      [PresetFormFields.provider]: z.string().nonempty(),
      topology: z.object({ type: z.string() }),
    })
    .passthrough()
    .superRefine(({ presetName }, ctx) => {
      if (existingNames.includes(presetName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [PresetFormFields.presetName],
          message: Messages.errors.presetName.duplicate,
        });
      }
    });

/**
 * Combines the base preset identity validation (name/provider/topology) with
 * the schema-driven OpenAPI validation produced by the form engine.
 *
 * `existingNames` are used to prevent duplicate names on create; pass an empty
 * list when editing (the name is immutable there).
 */
export const getPresetValidationSchema = (
  existingNames: string[],
  openApiValidationSchema?: z.ZodTypeAny
) => {
  let combined: z.ZodTypeAny = basePresetSchema(existingNames);

  if (openApiValidationSchema) {
    combined = combined.superRefine((data, ctx) => {
      const result = openApiValidationSchema.safeParse(data);
      if (!result.success) {
        result.error.issues.forEach((issue) => ctx.addIssue(issue));
      }
    });
  }

  return combined;
};
