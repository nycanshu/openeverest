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

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { Delete, Edit, Visibility } from '@mui/icons-material';
import TableActionsMenu from 'components/table-actions-menu';
import { InstancePreset } from 'shared-types/api.types';
import { Messages } from './instance-presets.messages';

// Minimal view over the (loosely typed) InstancePreset spec. Only the fields we
// surface on the card are described here; everything is read defensively.
type ResourceRequirements = {
  limits?: { cpu?: string | number; memory?: string };
  requests?: { cpu?: string | number; memory?: string };
};

type EngineComponent = {
  replicas?: number;
  resources?: ResourceRequirements;
  storage?: { size?: string; storageClass?: string };
};

type PresetSpecView = {
  provider?: string;
  version?: string;
  topology?: { type?: string };
  components?: { engine?: EngineComponent };
};

const getPresetSummary = (preset: InstancePreset) => {
  const spec = (preset.spec ?? {}) as PresetSpecView;
  const engine = spec.components?.engine;
  const resources = engine?.resources;

  return {
    provider: spec.provider,
    version: spec.version,
    topology: spec.topology?.type,
    replicas: engine?.replicas,
    cpu: resources?.limits?.cpu ?? resources?.requests?.cpu,
    memory: resources?.limits?.memory ?? resources?.requests?.memory,
    storage: engine?.storage?.size,
  };
};

type MetaItemProps = {
  label: string;
  value?: string | number;
};

const MetaItem = ({ label, value }: MetaItemProps) => (
  <Box>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body2" data-testid={`preset-meta-${label}`}>
      {value !== undefined && value !== '' ? value : Messages.card.notSet}
    </Typography>
  </Box>
);

export type PresetCardProps = {
  preset: InstancePreset;
  onView: (name: string) => void;
  onEdit: (name: string) => void;
  onDelete: (preset: InstancePreset) => void;
};

export const PresetCard = ({
  preset,
  onView,
  onEdit,
  onDelete,
}: PresetCardProps) => {
  const name = preset.metadata?.name ?? '';
  const summary = getPresetSummary(preset);

  const menuItems = [
    <MenuItem
      key="view"
      onClick={() => onView(name)}
      sx={{ gap: 1 }}
      data-testid={`preset-view-${name}`}
    >
      <Visibility fontSize="small" /> {Messages.actions.view}
    </MenuItem>,
    <MenuItem
      key="edit"
      onClick={() => onEdit(name)}
      sx={{ gap: 1 }}
      data-testid={`preset-edit-${name}`}
    >
      <Edit fontSize="small" /> {Messages.actions.edit}
    </MenuItem>,
    <MenuItem
      key="delete"
      onClick={() => onDelete(preset)}
      sx={{ gap: 1 }}
      data-testid={`preset-delete-${name}`}
    >
      <Delete fontSize="small" /> {Messages.actions.delete}
    </MenuItem>,
  ];

  return (
    <Card
      variant="outlined"
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      data-testid={`preset-card-${name}`}
    >
      <CardHeader
        title={
          <Typography
            variant="h6"
            sx={{ cursor: 'pointer' }}
            onClick={() => onView(name)}
          >
            {name}
          </Typography>
        }
        action={<TableActionsMenu menuItems={menuItems} />}
        subheader={
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {summary.provider && (
              <Chip size="small" label={summary.provider} variant="outlined" />
            )}
            {summary.topology && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={summary.topology}
              />
            )}
          </Stack>
        }
      />
      <Divider />
      <CardContent sx={{ flexGrow: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 2,
          }}
        >
          <MetaItem label={Messages.card.version} value={summary.version} />
          <MetaItem label={Messages.card.replicas} value={summary.replicas} />
          <MetaItem label={Messages.card.cpu} value={summary.cpu} />
          <MetaItem label={Messages.card.memory} value={summary.memory} />
          <MetaItem label={Messages.card.storage} value={summary.storage} />
        </Box>
      </CardContent>
    </Card>
  );
};

export default PresetCard;
