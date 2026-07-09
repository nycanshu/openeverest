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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Add, CloudDownload } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from 'components/confirm-dialog/confirm-dialog';
import {
  INSTANCE_PRESETS_QUERY_KEY,
  useCreateInstancePresetFromInstance,
  useDeleteInstancePreset,
  useInstancePresets,
} from 'hooks/api/instance-presets';
import { InstancePreset } from 'shared-types/api.types';
import { PresetCard } from './preset-card';
import { CreateFromInstanceModal } from './create-from-instance-modal';
import { Messages } from './instance-presets.messages';

export const InstancePresets = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: presets = [], isLoading } = useInstancePresets();
  const { mutate: deletePreset, isPending: isDeleting } =
    useDeleteInstancePreset();
  const { mutate: createFromInstance, isPending: isCreatingFromInstance } =
    useCreateInstancePresetFromInstance();

  const [selectedPreset, setSelectedPreset] = useState<InstancePreset>();
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openFromInstance, setOpenFromInstance] = useState(false);

  const invalidatePresets = () =>
    queryClient.invalidateQueries({
      queryKey: [INSTANCE_PRESETS_QUERY_KEY],
    });

  const handleCreate = () => navigate('/instance-presets/new');
  const handleView = (name: string) => navigate(`/instance-presets/${name}`);
  const handleEdit = (name: string) =>
    navigate(`/instance-presets/${name}/edit`);

  const handleDeleteClick = (preset: InstancePreset) => {
    setSelectedPreset(preset);
    setOpenDeleteDialog(true);
  };

  const handleCloseDelete = () => {
    setSelectedPreset(undefined);
    setOpenDeleteDialog(false);
  };

  const handleConfirmDelete = (name: string) => {
    deletePreset(
      { name },
      {
        onSuccess: () => {
          invalidatePresets();
          handleCloseDelete();
        },
      }
    );
  };

  const handleFromInstanceSubmit = (params: {
    name: string;
    instanceName: string;
    instanceNamespace: string;
  }) => {
    createFromInstance(params, {
      onSuccess: () => {
        invalidatePresets();
        setOpenFromInstance(false);
      },
    });
  };

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5">{Messages.title}</Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, maxWidth: 720 }}
          >
            {Messages.subtitle}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button
            variant="outlined"
            startIcon={<CloudDownload />}
            onClick={() => setOpenFromInstance(true)}
            data-testid="create-preset-from-instance"
          >
            {Messages.createFromInstance}
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreate}
            data-testid="create-instance-preset"
          >
            {Messages.create}
          </Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Stack alignItems="center" sx={{ mt: 8 }}>
          <CircularProgress />
        </Stack>
      ) : presets.length === 0 ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1}
          sx={{ mt: 8, textAlign: 'center' }}
          data-testid="instance-presets-empty"
        >
          <Typography variant="h6">{Messages.empty.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {Messages.empty.description}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreate}
            sx={{ mt: 2 }}
          >
            {Messages.create}
          </Button>
        </Stack>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 2,
          }}
          data-testid="instance-presets-grid"
        >
          {presets.map((preset) => (
            <PresetCard
              key={preset.metadata?.name}
              preset={preset}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))}
        </Box>
      )}

      {openDeleteDialog && selectedPreset && (
        <ConfirmDialog
          open={openDeleteDialog}
          selectedId={selectedPreset.metadata?.name || ''}
          closeModal={handleCloseDelete}
          headerMessage={Messages.deleteDialog.header}
          cancelMessage={Messages.deleteDialog.cancelButton}
          submitMessage={Messages.deleteDialog.confirmButton}
          handleConfirm={handleConfirmDelete}
          disabledButtons={isDeleting}
        >
          {Messages.deleteDialog.message(selectedPreset.metadata?.name || '')}
        </ConfirmDialog>
      )}

      {openFromInstance && (
        <CreateFromInstanceModal
          open={openFromInstance}
          isLoading={isCreatingFromInstance}
          onClose={() => setOpenFromInstance(false)}
          onSubmit={handleFromInstanceSubmit}
        />
      )}
    </Box>
  );
};

export default InstancePresets;
