/**
 * Tests the Bubble Private Cloud using the DataServer requirements tests from @bubble-protocol/server
 * 
 * run 'npm test' or 'npm run test-cov' from the project's root directory.
*/

import * as fs from 'node:fs/promises';
import { testDataServerRequirements } from '@bubble-protocol/server/test/DataServerTestSuite/requirementsTests.js';
import { TrivialDataServer } from '../../src/v2/TrivialDataServer.js';
import { UnitTestPoint } from './UnitTestPoint.js';

describe("v2 TrivialDataServer Unit Tests", function() {

  //
  // Config
  //

  const SERVER_BUBBLE_PATH = "./test-bubbles";


  //
  // Tests
  //
 
  var testBubbleServer = new TrivialDataServer(SERVER_BUBBLE_PATH);


  beforeAll( async () => {
    await fs.mkdir(SERVER_BUBBLE_PATH);
  });


  afterAll( async () => {
    await fs.rmdir(SERVER_BUBBLE_PATH, {recursive: true, force: true});
  });


  testDataServerRequirements(testBubbleServer, new UnitTestPoint(SERVER_BUBBLE_PATH));


});

