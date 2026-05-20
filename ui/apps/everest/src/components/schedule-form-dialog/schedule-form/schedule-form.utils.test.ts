import {
  backupScheduleFormValuesToDbClusterPayload,
  getSchedulesPayload,
} from './schedule-form.utils';
import { WizardMode } from 'shared-types/wizard.types';
import { TimeValue, WeekDays } from 'components/time-selection/time-selection.types';
import { DbEngineType } from 'shared-types/dbEngines.types';
import { DbCluster, Schedule } from 'shared-types/dbCluster.types';

const baseFormData = {
  selectedTime: TimeValue.hours,
  minute: 5,
  hour: 12,
  amPm: 'AM',
  onDay: 1,
  weekDay: WeekDays.Mo,
  scheduleName: 'schedule-1',
  storageLocation: { name: 's3' },
  retentionCopies: '3',
};

describe('schedule-form.utils', () => {
  describe('getSchedulesPayload', () => {
    it('does not update schedules when edited schedule name is not found', () => {
      const schedules: Schedule[] = [
        {
          enabled: false,
          name: 'existing-schedule',
          backupStorageName: 'existing-storage',
          retentionCopies: 1,
          schedule: '0 * * * *',
        },
      ];

      const result = getSchedulesPayload({
        formData: {
          ...baseFormData,
          scheduleName: 'missing-schedule',
        },
        mode: WizardMode.Edit,
        schedules,
      });

      expect(result).toEqual(schedules);
      expect(schedules).toEqual([
        {
          enabled: false,
          name: 'existing-schedule',
          backupStorageName: 'existing-storage',
          retentionCopies: 1,
          schedule: '0 * * * *',
        },
      ]);
    });
  });

  describe('backupScheduleFormValuesToDbClusterPayload', () => {
    it('does not mutate dbCluster schedules when edited schedule name is not found', () => {
      const dbCluster: DbCluster = {
        apiVersion: 'everest.percona.com/v1alpha1',
        kind: 'DatabaseCluster',
        metadata: {
          name: 'db-cluster',
          namespace: 'ns',
        },
        spec: {
          engine: {
            replicas: 1,
            storage: {
              size: 1,
            },
            type: DbEngineType.PXC,
          },
          proxy: {
            expose: {
              type: 'ClusterIP',
            },
            type: 'haproxy',
          },
          monitoring: {},
          backup: {
            pitr: {
              enabled: false,
              backupStorageName: '',
            },
            schedules: [
              {
                enabled: false,
                name: 'existing-schedule',
                backupStorageName: 'existing-storage',
                retentionCopies: 1,
                schedule: '0 * * * *',
              },
            ],
          },
        },
      };

      const result = backupScheduleFormValuesToDbClusterPayload(
        {
          ...baseFormData,
          scheduleName: 'missing-schedule',
        },
        dbCluster,
        WizardMode.Edit
      );

      expect(result.spec.backup?.schedules).toEqual([
        {
          enabled: false,
          name: 'existing-schedule',
          backupStorageName: 'existing-storage',
          retentionCopies: 1,
          schedule: '0 * * * *',
        },
      ]);
      expect(dbCluster.spec.backup?.schedules).toEqual([
        {
          enabled: false,
          name: 'existing-schedule',
          backupStorageName: 'existing-storage',
          retentionCopies: 1,
          schedule: '0 * * * *',
        },
      ]);
    });
  });
});
