/**
 * Tests the Bubble Private Cloud via it's http api
 * 
 * run 'npm test' from the project's root directory.
*/

import * as fs from 'node:fs/promises';
import { testBubbleServerRequirements } from '@bubble-protocol/server/test/BubbleServerTestSuite/requirementsTests.js';
import { BubbleProvider, bubbleProviders } from '@bubble-protocol/client';

export function v2ServerTests(web3, BUBBLE_SERVER_URL, CONFIG, options) {

  describe("v2", function() {

    let bubbleProvider;

    class WrappedBubbleProvider extends BubbleProvider {
      post(...params) { return bubbleProvider.post(...params) }
      subscribe(...params) { return bubbleProvider.subscribe(...params) }
      unsubscribe(...params) { return bubbleProvider.unsubscribe(...params) }
      close() { return bubbleProvider.close() }
    }

    const wrappedBubbleProvider = new WrappedBubbleProvider();

    beforeAll( async () => {
      await new Promise((resolve, reject) => {
        bubbleProvider = new bubbleProviders.WebsocketBubbleProvider(new URL(BUBBLE_SERVER_URL));
        bubbleProvider.on('error', reject)
        bubbleProvider.on('open', resolve)
      })
      bubbleProvider.on('error', error => console.error('ws provider rxd error:', error))
      await fs.mkdir(CONFIG.rootPath, {recursive: true});
    });
  
  
    afterAll( async () => {
      await fs.rm(CONFIG.rootPath, {recursive: true, force: true});
      bubbleProvider.close();
    });
  
  
    test('ping v2 path', async () => {
      await expect(wrappedBubbleProvider.post('ping')).resolves.toBe('pong');
    }, 10000)

    testBubbleServerRequirements(web3, CONFIG.chainId, BUBBLE_SERVER_URL, wrappedBubbleProvider, undefined, options);
  
  });
  
}
