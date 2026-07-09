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

import { createContext, useContext } from 'react';
import { Provider } from 'shared-types/api.types';
import { PresetPageMode } from './preset-form.types';

type PresetFormContextType = {
  mode: PresetPageMode;
  providers: Provider[];
  topologies: string[];
  hasMultipleTopologies: boolean;
  // Identity fields (name, provider, topology) are immutable when editing or
  // viewing an existing Instance Preset.
  identityLocked: boolean;
};

const PresetFormContext = createContext<PresetFormContextType | null>(null);

export const PresetFormProvider = PresetFormContext.Provider;

export const usePresetFormContext = () => {
  const context = useContext(PresetFormContext);
  if (!context) {
    throw new Error(
      'usePresetFormContext must be used within PresetFormProvider'
    );
  }
  return context;
};
