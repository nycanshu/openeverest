// everest
// Copyright (C) 2023 Percona LLC
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
import { test, expect } from '@fixtures';

test.describe('Everest CLI install', async () => {
  test('install everest and provision namespaces separately', async ({ page, cli, request }) => {
    const verifyNamespaceManaged = async (namespace: string) => {
      await test.step(`verify namespace '${namespace}' is managed by Everest`, async () => {
        const out = await cli.exec(`kubectl get namespace ${namespace} -o jsonpath='{.metadata.labels.app\\.kubernetes\\.io/managed-by}'`);

        await out.outContainsNormalizedMany(['everest']);
      });
    },

    verifyNamespaceNotManaged = async (namespace: string) => {
      await test.step(`verify namespace '${namespace}' is not managed by Everest`, async () => {
        const out = await cli.exec(`kubectl get namespace ${namespace} -o jsonpath='{.metadata.labels.app\\.kubernetes\\.io/managed-by}'`);

        await out.outNotContains(['everest']);
      });
    },

    verifyEverestSystem = async () => {
      await test.step('verify Everest system', async () => {
        const out = await cli.exec(`kubectl get deploy --namespace=everest-system`);

        await out.outContainsNormalizedMany([
          'everest-server',
        ]);
      });
    };

    await test.step('run everest install (no namespaces)', async () => {
      const out = await cli.everestExecSkipWizard(
        `install --version 0.0.0 --helm.set server.image=ghcr.io/openeverest/openeverest-dev`,
      );

      await out.assertSuccess();
      await out.outContainsNormalizedMany([
        '✅ Installing Everest Helm chart',
        '✅ Ensuring Everest API deployment is ready',
        '✅ Ensuring monitoring stack is ready',
        'Thank you for installing Everest',
      ]);
    });
    await page.waitForTimeout(10_000);
    await verifyEverestSystem();

    await test.step('run everest install again (fail)', async () => {
      const out = await cli.everestExecSkipWizard(
        `install`,
      );

      await out.outErrContainsNormalizedMany([
        '❌ everest is already installed',
      ]);
    });

    await test.step('create namespace', async () => {
      const out = await cli.everestExecNamespaces(
        `add everest`,
      );

      await out.assertSuccess();
      await out.outContainsNormalizedMany([
        `✅ Provisioning namespace 'everest'`,
      ]);
    });
    await page.waitForTimeout(10_000);
    await verifyEverestSystem();
    await verifyNamespaceManaged('everest');

    await test.step('create namespace again (fail)', async () => {
      const out = await cli.everestExecNamespaces(
        `add everest`,
      );

      await out.outErrContainsNormalizedMany([
        `❌ 'everest': namespace already exists and is managed by Everest`,
      ]);
    });

    await test.step('remove namespace', async () => {
      let out = await cli.everestExecNamespaces(
        `remove everest`,
      );

      await out.assertSuccess();
      await out.outContainsNormalizedMany([
        `✅ Deleting database instances in namespace 'everest'`,
        `✅ Deleting backup storages in namespace 'everest'`,
        `✅ Deleting monitoring configs in namespace 'everest'`,
        `✅ Deleting database namespace 'everest'`,
      ]);

      out = await cli.exec(`kubectl get namespace everest`);
      await out.outErrContainsNormalizedMany([
        'Error from server (NotFound): namespaces "everest" not found',
      ]);
    });
    await page.waitForTimeout(10_000);
    await verifyEverestSystem();

    await test.step('create namespace with --take-ownership', async () => {
      let out = await cli.exec(`kubectl create namespace existing-ns`);

      await out.assertSuccess();

      out = await cli.everestExecNamespaces(
        `add existing-ns --take-ownership`,
      );
      await out.assertSuccess();
      await out.outContainsNormalizedMany([
        `✅ Provisioning namespace 'existing-ns'`,
      ]);
    });
    await page.waitForTimeout(10_000);
    await verifyEverestSystem();
    await verifyNamespaceManaged('existing-ns');

    await test.step('remove namespace with --keep-namespace', async () => {
      let out = await cli.everestExecNamespaces(
        `remove existing-ns --keep-namespace`,
      );

      await out.assertSuccess();
      await out.outContainsNormalizedMany([
        `✅ Deleting database instances in namespace 'existing-ns'`,
        `✅ Deleting backup storages in namespace 'existing-ns'`,
        `✅ Deleting monitoring configs in namespace 'existing-ns'`,
        `✅ Deleting resources from namespace 'existing-ns'`,
      ]);

      out = await cli.exec(`kubectl get namespace existing-ns`);
      await out.assertSuccess();
      await out.outContainsNormalizedMany([
        'existing-ns',
      ]);
    });
    await page.waitForTimeout(10_000);
    await verifyEverestSystem();
    await verifyNamespaceNotManaged('existing-ns');
  });
});
