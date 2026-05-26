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

import { MenuItem } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
// import AddIcon from '@mui/icons-material/Add';
// import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import { MRT_Row } from 'material-react-table';
import {
  Backup,
  BackupStatus,
  getBackupState,
} from 'shared-types/backups.types';
// import { DbCluster } from 'shared-types/dbCluster.types';
import { Messages } from './backups-list.messages';

// TODO: check main — original had restore/restoreToNewDb actions with RBAC checks.
// Restore these when restore feature is implemented in v2.
export const getBackupActionButtons = (
  row: MRT_Row<Backup>,
  // TODO: v2 restore feature — uncomment when ready
  // blockActions: boolean,
  handleDeleteBackup: (backupName: string) => void,
  // handleRestoreBackup: (backupName: string) => void,
  // handleRestoreToNewDbBackup: (backupName: string) => void,
  // dbCluster: DbCluster
  canDelete: boolean,
  isDeleting = false
) => {
  const backupName = row.original.metadata?.name ?? '';

  // TODO: v2 restore — original restore RBAC checks (from main):
  // canRestore / canCreateClusterFromBackup should be derived outside and passed in.

  return [
    // TODO: v2 restore — uncomment when restore feature is ready
    // ...(canRestore ? [
    //   <MenuItem key={0} disabled={row.original.state !== BackupStatus.OK || blockActions}
    //     onClick={() => handleRestoreBackup(row.original.name)}
    //     sx={{ m: 0, gap: 1, px: 2, py: '10px' }}>
    //     <KeyboardReturnIcon /> {Messages.restore}
    //   </MenuItem>,
    // ] : []),
    // ...(canCreateClusterFromBackup ? [
    //   <MenuItem key={1} disabled={row.original.state !== BackupStatus.OK || blockActions}
    //     onClick={() => handleRestoreToNewDbBackup(row.original.name)}
    //     sx={{ m: 0, gap: 1, px: 2, py: '10px' }}>
    //     <AddIcon /> {Messages.restoreToNewDb}
    //   </MenuItem>,
    // ] : []),
    ...(canDelete
      ? [
          <MenuItem
            key="delete"
            disabled={
              getBackupState(row.original) === BackupStatus.DELETING ||
              isDeleting
            }
            onClick={() => handleDeleteBackup(backupName)}
            sx={{ m: 0, gap: 1, px: 2, py: '10px' }}
          >
            <DeleteIcon />
            {Messages.delete}
          </MenuItem>,
        ]
      : []),
  ];
};
