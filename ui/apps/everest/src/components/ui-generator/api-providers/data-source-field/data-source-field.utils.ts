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

import type { Component } from '../../ui-generator.types';
import type { ComponentWithDataSource } from './data-source-field.types';

type OptionValue = { value: string };

export const getReconciledDataSourceValue = (
  current: unknown,
  options: OptionValue[],
  opts?: { allowEmpty?: boolean }
): string | null => {
  const validValues = options.map((o) => o.value);
  const currentStr = typeof current === 'string' ? current : '';

  // When empty is an allowed, intentional choice — e.g. a select with
  // displayEmpty such as an Instance Preset's "use cluster default"
  // StorageClass — leave an empty value untouched instead of auto-selecting
  // the first option.
  if (opts?.allowEmpty && currentStr === '') {
    return null;
  }

  // The current value is already valid: nothing to reconcile. Returning null
  // avoids a redundant setValue() that would re-trigger the effect each render.
  if (validValues.includes(currentStr)) {
    return null;
  }

  // Invalid or unset: fall back to the first option when one exists, otherwise
  // clear a stale non-empty value.
  if (options.length > 0) {
    return options[0].value;
  }

  return currentStr ? '' : null;
};

export const hasDataSource = (
  item: Component
): item is ComponentWithDataSource => {
  return (
    'dataSource' in item &&
    typeof (item as Record<string, unknown>).dataSource === 'object' &&
    !!(item as Record<string, unknown>).dataSource
  );
};
