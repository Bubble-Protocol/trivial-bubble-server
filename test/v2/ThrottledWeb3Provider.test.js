import { ThrottledWeb3Provider } from '../../src/v2/ThrottledWeb3Provider.js';
import { blockchainProviders } from '@bubble-protocol/server';


describe.only('ThrottledWebServer', () => {

  const runner = {
    call: () => Promise.resolve('0x0000000000000000000000000000000000000000000000000000000000000000'),
    provider: {
      getNetwork: async () => ({ chainId: 1 })
    }
  }

  const address = '0x0000000000000000000000000000000000000001';
  const file = '0x0000000000000000000000000000000000000000000000000000000000000002';

  const uut = new ThrottledWeb3Provider('1.0', 1, runner, '', 25, 1000);

  afterAll(() => {
    uut.close();
  })

  test('[defensive test] sending 100 messages through EVMProvider takes much less than 4s', async () => {

    const evmProvider = new blockchainProviders.EVMProvider('1.0', 1, runner, '');

    const promises = [];
    for(let i=0; i<100; i++) {
      promises.push(evmProvider.getPermissions(address, address, file));
    }

    const startTime = Date.now();

    await Promise.all(promises);

    const stopTime = Date.now();

    expect(stopTime - startTime).toBeLessThan(100);
      
  })


  test('sending 100 messages through the ThrottledWeb3Provider takes 4s', async () => {

    const promises = [];
    for(let i=0; i<100; i++) {
      promises.push(uut.getPermissions(address, address, file));
    }

    const startTime = Date.now();

    await Promise.all(promises);

    const stopTime = Date.now();

    expect(stopTime - startTime).toBeGreaterThan(4000);
    expect(stopTime - startTime).toBeLessThan(4100);
      
  })

})
