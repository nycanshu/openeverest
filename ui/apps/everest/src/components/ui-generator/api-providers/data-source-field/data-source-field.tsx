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

import React, { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import type { Component } from '../../ui-generator.types';
import { providerRegistry, useProviderOptions } from '../registry';
import { useUiGeneratorContext } from '../../ui-generator-context';
import { useClusterName } from 'hooks/api/useClusterName';
import type { DataSourceFieldProps } from './data-source-field.types';
import { getReconciledDataSourceValue } from './data-source-field.utils';

export const DataSourceField: React.FC<DataSourceFieldProps> = ({
  item,
  name,
  children,
}) => {
  const { namespace } = useUiGeneratorContext();
  const cluster = useClusterName();
  const { getValues, setValue } = useFormContext();
  const { dataSource, ...baseComponent } = item;

  const hasValidContext = !!namespace && !!cluster;

  const { options, isLoading, error, isEmpty } = useProviderOptions(
    dataSource.provider,
    {
      namespace: namespace ?? '',
      cluster,
    },
    { enabled: hasValidContext }
  );

  // Instance Preset support: cluster-scoped selects (e.g. StorageClass) may
  // offer an empty "use cluster default" option so the value can stay blank.
  const fieldParamsRecord = baseComponent.fieldParams as Record<
    string,
    unknown
  >;
  const allowEmptyOption = !!fieldParamsRecord?.allowEmptyOption;
  const emptyOptionLabel =
    (fieldParamsRecord?.emptyOptionLabel as string | undefined) ?? '';

  const effectiveOptions = useMemo(
    () =>
      allowEmptyOption
        ? [{ label: emptyOptionLabel, value: '' }, ...options]
        : options,
    [allowEmptyOption, emptyOptionLabel, options]
  );

  useEffect(() => {
    if (isLoading || !name) return;

    const nextValue = getReconciledDataSourceValue(
      getValues(name),
      effectiveOptions
    );

    if (nextValue !== null) {
      setValue(name, nextValue, { shouldValidate: true });
    }
  }, [isLoading, effectiveOptions, name, getValues, setValue]);

  const patchedItem = useMemo(() => {
    const originalHelperText = (
      baseComponent.fieldParams as Record<string, unknown>
    )?.helperText;

    const helperText = isLoading
      ? 'Loading...'
      : error
        ? 'Failed to load options'
        : isEmpty && !allowEmptyOption
          ? (originalHelperText ?? 'No options available')
          : originalHelperText;

    return {
      ...baseComponent,
      fieldParams: {
        ...baseComponent.fieldParams,
        options: effectiveOptions,
        disabled:
          isLoading ||
          !!error ||
          (baseComponent.fieldParams as Record<string, unknown>)?.disabled,
        ...(helperText !== undefined ? { helperText } : {}),
      },
    } as Component;
  }, [
    baseComponent,
    effectiveOptions,
    isLoading,
    error,
    isEmpty,
    allowEmptyOption,
  ]);

  const FallbackComponent = useMemo(() => {
    const entry = providerRegistry.get(dataSource.provider);
    return entry?.emptyStateFallback?.component ?? null;
  }, [dataSource.provider]);

  const showFallback =
    isEmpty &&
    !isLoading &&
    !allowEmptyOption &&
    !!FallbackComponent &&
    !!namespace;

  // We always render the children (Select/Controller) and hide them with
  // display:none instead of conditionally unmounting. This keeps the RHF
  // Controller mounted so the field stays registered in the form. Without this,
  // when options arrive after inline creation via the FallbackComponent, the
  // Controller would remount and setValue() would fire before the field is
  // re-registered — making it a no-op and leaving the Select empty.
  return (
    <>
      {showFallback && (
        <FallbackComponent namespace={namespace!} cluster={cluster} />
      )}
      <div
        style={{
          display: showFallback ? 'none' : 'contents',
        }}
      >
        {children(patchedItem)}
      </div>
    </>
  );
};
