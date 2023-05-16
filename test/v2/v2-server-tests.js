/**
 * Tests the Bubble Private Cloud via it's http api
 * 
 * run 'npm test' from the project's root directory.
*/

import * as fs from 'node:fs/promises';
import { testBubbleServerRequirements } from '@bubble-protocol/server/test/BubbleServerTestSuite/requirementsTests.js';
import { bubbleProviders } from '@bubble-protocol/bubble-sdk';

export function v2ServerTests(web3, BUBBLE_SERVER_URL, CONFIG) {

  describe("v2", function() {
  
    const bubbleProvider = new bubbleProviders.HTTPBubbleProvider(new URL(BUBBLE_SERVER_URL+'/v2'));


    beforeAll( async () => {
      await fs.mkdir(CONFIG.rootPath, {recursive: true});
    });
  
  
    afterAll( async () => {
      await fs.rmdir(CONFIG.rootPath, {recursive: true, force: true});
    });
  
  
    test('ping v2 path', async () => {
      await expect(bubbleProvider.post('ping')).resolves.toBe('pong');
    })

    testBubbleServerRequirements(web3, CONFIG.chainId, BUBBLE_SERVER_URL, bubbleProvider);
  
  });
  
}
