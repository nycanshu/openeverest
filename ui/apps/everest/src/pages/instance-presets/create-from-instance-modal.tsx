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

import { useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DialogTitle } from '@percona/ui-lib';
import { useInstancesForNamespaces, useNamespaces } from 'hooks';
import { CreateInstancePresetFromInstanceParams } from 'shared-types/api.types';
import { Messages } from './instance-presets.messages';

const INSTANCE_SEPARATOR = '/';

export type CreateFromInstanceModalProps = {
  open: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onSubmit: (params: CreateInstancePresetFromInstanceParams) => void;
};

export const CreateFromInstanceModal = ({
  open,
  isLoading,
  onClose,
  onSubmit,
}: CreateFromInstanceModalProps) => {
  const [selectedInstance, setSelectedInstance] = useState('');
  const [presetName, setPresetName] = useState('');

  const { data: namespaces = [] } = useNamespaces({
    refetchInterval: 10 * 1000,
  });
  const instanceResults = useInstancesForNamespaces(
    namespaces.map((namespace) => ({ namespace }))
  );

  const instanceOptions = useMemo(
    () =>
      instanceResults
        .flatMap((result) => result.queryResult.data ?? [])
        .flatMap((instance) => {
          const name = instance.metadata?.name;
          const namespace = instance.metadata?.namespace;
          return name && namespace
            ? [
                {
                  name,
                  namespace,
                  id: `${namespace}${INSTANCE_SEPARATOR}${name}`,
                },
              ]
            : [];
        }),
    [instanceResults]
  );

  const handleClose = () => {
    setSelectedInstance('');
    setPresetName('');
    onClose();
  };

  const handleSubmit = () => {
    const [instanceNamespace, instanceName] =
      selectedInstance.split(INSTANCE_SEPARATOR);
    if (!instanceNamespace || !instanceName || !presetName) {
      return;
    }
    onSubmit({ name: presetName, instanceName, instanceNamespace });
  };

  const canSubmit = !!selectedInstance && !!presetName.trim() && !isLoading;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle onClose={handleClose}>
        {Messages.fromInstance.header}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 3 }}>
          {Messages.fromInstance.description}
        </Typography>
        <Stack spacing={3}>
          <FormControl fullWidth disabled={instanceOptions.length === 0}>
            <InputLabel id="preset-source-instance-label">
              {Messages.fromInstance.instanceLabel}
            </InputLabel>
            <Select
              labelId="preset-source-instance-label"
              label={Messages.fromInstance.instanceLabel}
              value={selectedInstance}
              displayEmpty={false}
              onChange={(event) => setSelectedInstance(event.target.value)}
              data-testid="preset-source-instance-select"
            >
              {instanceOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name} ({option.namespace})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {instanceOptions.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              {Messages.fromInstance.noInstances}
            </Typography>
          )}
          <TextField
            fullWidth
            label={Messages.fromInstance.nameLabel}
            placeholder={Messages.fromInstance.namePlaceholder}
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            data-testid="preset-from-instance-name"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {Messages.fromInstance.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit}
          data-testid="preset-from-instance-submit"
        >
          {Messages.fromInstance.submit}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateFromInstanceModal;
