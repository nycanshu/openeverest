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

// Form mode for the Instance Preset create/edit/view page.
export enum PresetPageMode {
  Create = 'create',
  Edit = 'edit',
  View = 'view',
}

// Form field names for the Instance Preset base step.
export const PresetFormFields = {
  presetName: 'presetName',
  provider: 'provider',
  topology: 'topology.type',
} as const;

export type PresetFormValues = Record<string, unknown> & {
  presetName?: string;
  provider?: string;
  topology?: { type?: string };
};
