import { DbType } from '@percona/types';
import { AutoCompleteAutoFill } from 'components/auto-complete-auto-fill/auto-complete-auto-fill';
import { useBackupStoragesByNamespace } from 'hooks/api/backup-storages/useBackupStorages';
import { useFormContext } from 'react-hook-form';
import { DbCluster } from 'shared-types/dbCluster.types';
import { dbEngineToDbType } from '@percona/utils';
import { PitrEditFields } from './edit-pitr.types';
import { Messages } from './edit-pitr.messages';

const PitrStorage = ({ dbCluster }: { dbCluster: DbCluster }) => {
  const { watch } = useFormContext();
  const [pitrEnabled] = watch([PitrEditFields.enabled]);

  const { data: backupStorages = [], isFetching: loadingBackupStorages } =
    useBackupStoragesByNamespace(dbCluster.metadata.namespace);

  const dbType = dbEngineToDbType(dbCluster.spec.engine.type);

  if (!pitrEnabled) {
    return null;
  }

  // TODO v2 check type condition usage
  if (dbType === DbType.Mysql) {
    return (
      <AutoCompleteAutoFill
        name={PitrEditFields.storageLocation}
        label={Messages.enablePITR}
        loading={loadingBackupStorages}
        options={backupStorages}
        isRequired
        enableFillFirst
      />
    );
  }
};
export default PitrStorage;
