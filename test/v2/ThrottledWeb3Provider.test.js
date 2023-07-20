import { ThrottledWeb3Provider } from '../../src/v2/ThrottledWeb3Provider.js';
import { blockchainProviders } from '@bubble-protocol/core';


describe.only('ThrottledWebServer', () => {

  class Contract {
    methods = {
      getAccessPermissions: () => { return {call: () => Promise.resolve(0)} }
    }
  }

  const web3Mock = {
    eth: {
      Contract: Contract
    }
  }

  const uut = new ThrottledWeb3Provider(1, web3Mock, '0.0.2', 25, 1000);

  afterAll(() => {
    uut.close();
  })

  test('[defensive test] sending 100 messages through Web3Provider takes much less than 4s', async () => {

    const web3Provider = new blockchainProviders.Web3Provider(1, web3Mock, '0.0.2');

    const promises = [];
    for(let i=0; i<100; i++) {
      promises.push(web3Provider.getPermissions());
    }

    const startTime = Date.now();

    await Promise.all(promises);

    const stopTime = Date.now();

    expect(stopTime - startTime).toBeLessThan(100);
      
  })


  test('sending 100 messages through the ThrottledWeb3Provider takes 4s', async () => {

    const promises = [];
    for(let i=0; i<100; i++) {
      promises.push(uut.getPermissions());
    }

    const startTime = Date.now();

    await Promise.all(promises);

    const stopTime = Date.now();

    expect(stopTime - startTime).toBeGreaterThan(4000);
    expect(stopTime - startTime).toBeLessThan(4100);
      
  })

})
