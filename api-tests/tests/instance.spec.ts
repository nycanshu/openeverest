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

const testPrefix = 'inst'

test.describe.serial('Instance API tests', () => {
  test.describe.configure({timeout: 120 * 1000});

  const instanceName = th.limitedSuffixedName(testPrefix)
  // the provider deployed by api-tests/manifests/dummy-provider.yaml
  const providerName = 'dummy-provider'

  test.afterAll(async ({request}) => {
    try { await th.deleteInstance(request, instanceName) } catch (_) {}
  })

  test('create instance', async ({request}) => {
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

  test('list instances', async ({request}) => {
    const list = await th.listInstances(request)

    expect(list).toBeTruthy()
    expect(list.items).toBeTruthy()
    expect(list.items.length).toBeGreaterThanOrEqual(1)

    const found = list.items.find((i: any) => i.metadata.name === instanceName)
    expect(found).toBeTruthy()
  })

  test('get instance', async ({request}) => {
    const instance = await th.getInstance(request, instanceName)

    expect(instance).toBeTruthy()
    expect(instance.metadata.name).toBe(instanceName)
    expect(instance.spec.provider).toBe(providerName)
  })

  test('update instance', async ({request}) => {
    await expect(async () => {
      const instance = await th.getInstance(request, instanceName)

      // Add a component to the instance
      if (!instance.spec.components) {
        instance.spec.components = {}
      }
      instance.spec.components.engine = {
        type: 'dummy-engine',
      }

      const updated = await th.updateInstance(request, instanceName, instance)
      expect(updated.spec.components.engine.type).toBe('dummy-engine')
    }).toPass({
      intervals: [1000],
      timeout: 30 * 1000,
    })
  })

  test('delete instance', async ({request}) => {
    await th.deleteInstance(request, instanceName)
  })
});
