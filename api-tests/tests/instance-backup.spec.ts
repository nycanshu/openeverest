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

import {test, expect} from '@fixtures'
import * as th from '@tests/utils/api';

const testPrefix = 'instbkp'

test.describe.serial('Instance Backup API tests', () => {
  test.describe.configure({timeout: 120 * 1000});

  const instanceName = th.limitedSuffixedName(testPrefix)
  // the provider deployed by api-tests/manifests/dummy-provider.yaml
  const providerName = 'dummy-provider'
  // the backup class deployed by api-tests/manifests/dummy-backup-class.yaml
  const backupClassName = 'dummy-backup-class'
  const backupStorageName = th.limitedSuffixedName('bs')
  const backupName = th.limitedSuffixedName('bkp')

  test.afterAll(async ({request}) => {
    try { await th.deleteBackup(request, backupName) } catch (_) {}
    try { await th.deleteInstance(request, instanceName) } catch (_) {}
  })

  test('create instance for backup tests', async ({request}) => {
    const payload = th.getInstanceData(instanceName, providerName)

    const instance = await th.createInstance(request, payload)

    expect(instance).toBeTruthy()
    expect(instance.metadata.name).toBe(instanceName)

    await expect(async () => {
      const fetched = await th.getInstance(request, instanceName)
      expect(fetched.spec.provider).toBe(providerName)
    }).toPass({
      intervals: [1000],
      timeout: 30 * 1000,
    })
  })

  test('create backup for instance', async ({request}) => {
    const payload = th.getBackupData(backupName, instanceName, backupClassName, backupStorageName)

    const backup = await th.createBackup(request, payload)

    expect(backup).toBeTruthy()
    expect(backup.metadata.name).toBe(backupName)
    expect(backup.spec.instanceName).toBe(instanceName)
    expect(backup.spec.backupClassName).toBe(backupClassName)
    expect(backup.spec.storageName).toBe(backupStorageName)
  })

  test('get backup', async ({request}) => {
    const backup = await th.getBackup(request, backupName)

    expect(backup).toBeTruthy()
    expect(backup.metadata.name).toBe(backupName)
    expect(backup.spec.instanceName).toBe(instanceName)
  })

  test('list backups for instance', async ({request}) => {
    const backups = await th.listInstanceBackups(request, instanceName)

    expect(backups).toBeTruthy()
    expect(backups.items).toBeTruthy()
    expect(backups.items.length).toBeGreaterThanOrEqual(1)

    const found = backups.items.find((b: any) => b.metadata.name === backupName)
    expect(found).toBeTruthy()
    expect(found.spec.instanceName).toBe(instanceName)
    expect(found.spec.backupClassName).toBe(backupClassName)
  })

  test('delete backup', async ({request}) => {
    await th.deleteBackup(request, backupName)
  })

  test('delete instance after backup tests', async ({request}) => {
    await th.deleteInstance(request, instanceName)
  })
});
