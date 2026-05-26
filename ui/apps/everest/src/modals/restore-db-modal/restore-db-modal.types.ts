export interface RestoreDbModalProps {
  isOpen: boolean;
  closeModal: () => void;
  instanceName: string;
  namespace: string;
  // TODO: Re-enable when create-new-db-from-backup flow is restored.
  // isNewClusterMode?: boolean;
  preselectedBackupName?: string;
}

export interface RestorableBackupOption {
  name: string;
  startedAt?: string;
}

export interface ModalContentProps {
  isLoading: boolean;
  header: string;
  succeededBackups: RestorableBackupOption[];
  // TODO: Re-enable PITR props when PITR restore flow is implemented.
  // pitrData?: DatabaseClusterPitr;
  // backupName?: string;
}
