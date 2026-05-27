import { useLocation } from 'react-router-dom';
import { FormMode } from 'components/ui-generator/ui-generator.types';

export const useDatabasePageMode = (): FormMode => {
  const { state } = useLocation();
  if (state?.selectedDbCluster && state?.backupName) {
    return FormMode.Restore;
  }
  return FormMode.New;
};
