/**
 * Tests notification delivery for Bubble Private Cloud v2.
 */

import http from 'http';
import * as fs from 'node:fs/promises';
import { createRequire } from 'module';
import { bubbleProviders, ROOT_PATH } from '@bubble-protocol/client';
import { TestContract } from '@bubble-protocol/server/test/BubbleServerTestSuite/TestContract.js';


const require = createRequire(import.meta.url);
const allPermissionsContractSrc = require('@bubble-protocol/server/test/BubbleServerTestSuite/contracts/AllPermissionsContract.json');


const NOTIFICATION_CONFIG_FILE = '0xb9f67f2a5b929a7c1f97864c755308c84d01d3764ba7d8061f6de8de52e0eec8';
const DIRECTORY = '0x0000000000000000000000000000000000000000000000000000000000000003';
const FILE = `${DIRECTORY}/hello.txt`;
const FILE_IN_ROOT = '0x000000000000000000000000000000000000000000000000000000000000000f';

export function notificationTests(web3, bubbleServerURL, CONFIG, options = {}) {

  describe('v2 notifications', function() {
    const expectedProviderUrl = options.providerUrl || bubbleServerURL;

    let bubbleProvider;
    let webhookServer;
    let webhookUrl;
    let webhookRequests;
    let responseStatuses;

    beforeAll(async () => {
      await fs.mkdir(CONFIG.rootPath, {recursive: true});
      bubbleProvider = await openBubbleProvider(bubbleServerURL);
      console.log('Bubble provider connected for notification tests');
      const webhook = await startWebhookServer();
      console.log('Webhook server started for notification tests at '+webhook.url);
      webhookServer = webhook.server;
      webhookUrl = webhook.url;
      webhookRequests = webhook.requests;
      responseStatuses = webhook.responseStatuses;
    }, 10000);

    afterAll(async () => {
      if (bubbleProvider?.close) await bubbleProvider.close();
      if (webhookServer) await closeServer(webhookServer);
      await fs.rm(CONFIG.rootPath, {recursive: true, force: true});
    });

    beforeEach(() => {
      webhookRequests.length = 0;
      responseStatuses.clear();
    });

    test('posts a webhook notification after a successful write mutation', async () => {
      const { bubble, contract } = await createTestBubble(web3, CONFIG.chainId, bubbleServerURL, bubbleProvider);
      const targetPath = '/write';

      await writeNotificationConfig(bubble, [
        {
          id: 'write-target',
          enabled: true,
          transport: { type: 'webhook', url: webhookUrl + targetPath },
          paths: [
            { path: FILE, match: 'exact', operations: ['write'] }
          ]
        }
      ]);

      await bubble.write(FILE, 'hello world');

      const [request] = await waitForRequests(webhookRequests, 1);
      expect(request.path).toBe(targetPath);
      expect(request.body).toEqual(expect.objectContaining({
        operation: 'write',
        signer: contract.getAccount(),
        requestTimestamp: expect.any(Number),
        requestNonce: expect.any(String),
        contentId: {
          chain: CONFIG.chainId,
          contract: contract.getAddress().toLowerCase(),
          provider: expectedProviderUrl,
          file: FILE
        }
      }));
    }, 10000);

    test('posts webhook notifications for mkdir, append, delete and terminate mutations', async () => {
      const { bubble, contract } = await createTestBubble(web3, CONFIG.chainId, bubbleServerURL, bubbleProvider);
      const targetPath = '/mutations';

      await writeNotificationConfig(bubble, [
        {
          id: 'mutation-target',
          enabled: true,
          transport: { type: 'webhook', url: webhookUrl + targetPath },
          paths: [
            { path: DIRECTORY, match: 'exact', operations: ['mkdir'] },
            { path: DIRECTORY, match: 'children', operations: ['append', 'delete'] },
          ]
        }
      ]);

      await bubble.mkdir(DIRECTORY);
      await bubble.write(FILE, 'seed');
      await bubble.append(FILE, ' data');
      await bubble.delete(FILE);

      const requests = await waitForRequests(webhookRequests, 3);
      expect(requests.map((request) => request.body.operation)).toEqual(['mkdir', 'append', 'delete']);
      expect(requests.map((request) => request.body.contentId.file)).toEqual([DIRECTORY, FILE, FILE]);
      requests.forEach((request) => {
        expect(request.path).toBe(targetPath);
        expect(request.body.signer).toBe(contract.getAccount());
        expect(request.body.contentId.contract).toBe(contract.getAddress().toLowerCase());
        expect(request.body.contentId.provider).toBe(expectedProviderUrl);
      });
    }, 10000);

    test('ignores failed webhook posts and still completes the mutation', async () => {
      const { bubble } = await createTestBubble(web3, CONFIG.chainId, bubbleServerURL, bubbleProvider);
      const targetPath = '/fail';

      responseStatuses.set(targetPath, 500);

      await writeNotificationConfig(bubble, [
        {
          id: 'failing-target',
          enabled: true,
          transport: { type: 'webhook', url: webhookUrl + targetPath },
          paths: [
            { path: FILE, match: 'exact', operations: ['write'] }
          ]
        }
      ]);

      await expect(bubble.write(FILE, 'still succeeds')).resolves.toBeDefined();

      const [request] = await waitForRequests(webhookRequests, 1);
      expect(request.path).toBe(targetPath);
      expect(request.body.operation).toBe('write');
    }, 10000);

    test('posts a webhook notification for children of the root', async () => {
      const { bubble, contract } = await createTestBubble(web3, CONFIG.chainId, bubbleServerURL, bubbleProvider);
      const targetPath = '/write';

      await writeNotificationConfig(bubble, [
        {
          id: 'write-target',
          enabled: true,
          transport: { type: 'webhook', url: webhookUrl + targetPath },
          paths: [
            { path: ROOT_PATH, match: 'children', operations: ['write'] }
          ]
        }
      ]);

      await bubble.write(FILE_IN_ROOT, 'hello world');

      const requests = await waitForRequests(webhookRequests, 2);
      expect(requests.map((request) => request.body.contentId.file)).toEqual([NOTIFICATION_CONFIG_FILE, FILE_IN_ROOT]);
      requests.forEach((request) => {
        expect(request.body.operation).toEqual('write');
        expect(request.path).toBe(targetPath);
        expect(request.body.signer).toBe(contract.getAccount());
        expect(request.body.contentId.contract).toBe(contract.getAddress().toLowerCase());
        expect(request.body.contentId.provider).toBe(expectedProviderUrl);
      });
    }, 10000);

    test('does not post a webhook notification for descendents of the root when path type is children', async () => {
      const { bubble, contract } = await createTestBubble(web3, CONFIG.chainId, bubbleServerURL, bubbleProvider);
      const targetPath = '/write';

      await writeNotificationConfig(bubble, [
        {
          id: 'write-target',
          enabled: true,
          transport: { type: 'webhook', url: webhookUrl + targetPath },
          paths: [
            { path: ROOT_PATH, match: 'children', operations: ['write'] }
          ]
        }
      ]);

      await bubble.write(FILE, 'hello world');

      const requests = await waitForRequests(webhookRequests, 1);
      expect(requests.map((request) => request.body.contentId.file)).toEqual([NOTIFICATION_CONFIG_FILE]);
      requests.forEach((request) => {
        expect(request.body.operation).toEqual('write');
        expect(request.path).toBe(targetPath);
        expect(request.body.signer).toBe(contract.getAccount());
        expect(request.body.contentId.contract).toBe(contract.getAddress().toLowerCase());
        expect(request.body.contentId.provider).toBe(expectedProviderUrl);
      });
    }, 10000);

    test('posts a webhook notification for descendents of the root when path type is descendents', async () => {
      const { bubble, contract } = await createTestBubble(web3, CONFIG.chainId, bubbleServerURL, bubbleProvider);
      const targetPath = '/write';

      await writeNotificationConfig(bubble, [
        {
          id: 'write-target',
          enabled: true,
          transport: { type: 'webhook', url: webhookUrl + targetPath },
          paths: [
            { path: ROOT_PATH, match: 'descendents', operations: ['write'] }
          ]
        },
      ]);

      await bubble.write(FILE, 'hello world');

      const requests = await waitForRequests(webhookRequests, 2);
      expect(requests.map((request) => request.body.contentId.file)).toEqual([NOTIFICATION_CONFIG_FILE, FILE]);
      requests.forEach((request) => {
        expect(request.body.operation).toEqual('write');
        expect(request.path).toBe(targetPath);
        expect(request.body.signer).toBe(contract.getAccount());
        expect(request.body.contentId.contract).toBe(contract.getAddress().toLowerCase());
        expect(request.body.contentId.provider).toBe(expectedProviderUrl);
      });
    }, 10000);

    test('posts a webhook notification for descendents of a directory (acts like children)', async () => {
      const { bubble, contract } = await createTestBubble(web3, CONFIG.chainId, bubbleServerURL, bubbleProvider);
      const targetPath = '/write';

      await writeNotificationConfig(bubble, [
        {
          id: 'write-target',
          enabled: true,
          transport: { type: 'webhook', url: webhookUrl + targetPath },
          paths: [
            { path: DIRECTORY, match: 'descendents', operations: ['write'] }
          ]
        },
      ]);

      await bubble.write(FILE, 'hello world');

      const requests = await waitForRequests(webhookRequests, 1);
      expect(requests.map((request) => request.body.contentId.file)).toEqual([FILE]);
      requests.forEach((request) => {
        expect(request.body.operation).toEqual('write');
        expect(request.path).toBe(targetPath);
        expect(request.body.signer).toBe(contract.getAccount());
        expect(request.body.contentId.contract).toBe(contract.getAddress().toLowerCase());
        expect(request.body.contentId.provider).toBe(expectedProviderUrl);
      });
    }, 10000);

  });

}


async function createTestBubble(web3, chainId, bubbleServerURL, bubbleProvider) {
  const contract = new TestContract(web3, allPermissionsContractSrc);
  await contract.deploy();
  await contract.testContractIsAvailable();
  const bubble = contract.getBubble(chainId, bubbleServerURL, bubbleProvider);
  await bubble.create();
  return { contract, bubble };
}


async function writeNotificationConfig(bubble, targets) {
  await bubble.write(NOTIFICATION_CONFIG_FILE, JSON.stringify({
    version: 1,
    enabled: true,
    targets
  }), { encrypted: false });
}


async function openBubbleProvider(bubbleServerURL) {
  const url = new URL(bubbleServerURL);
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    const provider = new bubbleProviders.WebsocketBubbleProvider(url);
    await new Promise((resolve, reject) => {
      provider.open();
      provider.on('open', resolve);
      provider.on('error', reject);
    });
    return provider;
  }
  return new bubbleProviders.HTTPBubbleProvider(url);
}


async function startWebhookServer() {
  const requests = [];
  const responseStatuses = new Map();
  const server = http.createServer((request, response) => {
    const body = [];
    request.on('data', (chunk) => body.push(chunk));
    request.on('end', () => {
      requests.push({
        path: request.url,
        body: JSON.parse(Buffer.concat(body).toString() || '{}')
      });
      response.writeHead(responseStatuses.get(request.url) || 204);
      response.end();
    });
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const { port } = server.address();
  return {
    server,
    requests,
    responseStatuses,
    url: `http://127.0.0.1:${port}`
  };
}


function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}


async function waitForRequests(requests, count, timeout = 2000) {
  const start = Date.now();
  while (requests.length < count) {
    if (Date.now() - start > timeout) {
      throw new Error(`timed out waiting for ${count} notification requests; received ${requests.length}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return requests.slice(0, count);
}
