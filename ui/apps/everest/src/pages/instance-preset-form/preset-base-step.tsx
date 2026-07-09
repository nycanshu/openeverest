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

import { FormGroup, MenuItem } from '@mui/material';
import { useEffect } from 'react';
import { SelectInput, TextInput } from '@percona/ui-lib';
import { useFormContext } from 'react-hook-form';
import { StepHeader } from 'pages/database-form/database-form-body/steps-old/step-header/step-header';
import { PresetFormFields, PresetPageMode } from './preset-form.types';
import { usePresetFormContext } from './preset-form-context';
import { Messages } from './preset-form.messages';

export const PresetBaseStep = () => {
  const { mode, providers, topologies, hasMultipleTopologies, identityLocked } =
    usePresetFormContext();
  const { watch, setValue, getFieldState } = useFormContext();

  const currentTopology = watch(PresetFormFields.topology);
  const isView = mode === PresetPageMode.View;

  // Default the topology to the first available one when creating.
  useEffect(() => {
    const { isTouched } = getFieldState(PresetFormFields.topology);
    if (
      !isTouched &&
      mode === PresetPageMode.Create &&
      topologies.length > 0 &&
      !currentTopology
    ) {
      setValue(PresetFormFields.topology, topologies[0], {
        shouldValidate: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, topologies.length, currentTopology]);

  return (
    <>
      <StepHeader
        pageTitle={Messages.baseStep.title}
        pageDescription={Messages.baseStep.description}
      />
      <FormGroup sx={{ mt: 3 }}>
        <TextInput
          name={PresetFormFields.presetName}
          label={Messages.labels.presetName}
          textFieldProps={{
            placeholder: Messages.placeholders.presetName,
            // Name is immutable once the preset exists.
            disabled: identityLocked,
          }}
        />
        <SelectInput
          name={PresetFormFields.provider}
          label={Messages.labels.provider}
          selectFieldProps={{
            // Provider drives the entire schema and cannot change after creation.
            disabled: identityLocked,
          }}
        >
          {providers.map((provider) => {
            const name = provider.metadata?.name ?? '';
            return (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            );
          })}
        </SelectInput>
        {hasMultipleTopologies && (
          <SelectInput
            name={PresetFormFields.topology}
            label={Messages.labels.topology}
            selectFieldProps={{
              // Topology is immutable once the preset exists.
              disabled: identityLocked || isView,
            }}
          >
            {topologies.map((topology) => (
              <MenuItem key={topology} value={topology}>
                {topology}
              </MenuItem>
            ))}
          </SelectInput>
        )}
      </FormGroup>
    </>
  );
};

export default PresetBaseStep;
