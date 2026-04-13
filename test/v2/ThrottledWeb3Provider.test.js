import { ThrottledWeb3Provider } from '../../src/v2/ThrottledWeb3Provider.js';
import { blockchainProviders } from '@bubble-protocol/server';


describe('ThrottledWebServer', () => {

  let callTimes;

  const runner = {
    call: () => {
      callTimes.push(Date.now());
      return Promise.resolve('0x0000000000000000000000000000000000000000000000000000000000000000');
    },
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

  beforeEach(() => {
    callTimes = [];
  })

  test('[defensive test] sending 101 messages through EVMProvider takes much less than 4s', async () => {

    const evmProvider = new blockchainProviders.EVMProvider('1.0', 1, runner, '');

    const promises = [];
    for(let i=0; i<101; i++) {
      promises.push(evmProvider.getPermissions(address, address, file));
    }

    const startTime = Date.now();

    await Promise.all(promises);

    const stopTime = Date.now();

    expect(stopTime - startTime).toBeLessThan(100);
      
  })


  test('sending 101 messages through the ThrottledWeb3Provider takes 4s', async () => {

    const promises = [];
    for(let i=0; i<101; i++) {
      promises.push(uut.getPermissions(address, address, file));
    }

    const startTime = Date.now();

    await Promise.all(promises);

    const stopTime = Date.now();

    expect(stopTime - startTime).toBeGreaterThan(3900);
    expect(stopTime - startTime).toBeLessThan(4100);
      
  })

  test('never sends more than maxWindowRequests within the throttling window', async () => {

    const maxWindowRequests = 3;
    const windowTime = 1000;
    const strictUut = new ThrottledWeb3Provider('1.0', 1, runner, '', maxWindowRequests, windowTime);
    const promises = [];

    for(let i=0; i<10; i++) {
      promises.push(strictUut.getPermissions(address, address, file));
    }

    await Promise.all(promises);
    strictUut.close();

    const toleratedWindowTime = windowTime * 0.99;

    for (let startIndex = 0; startIndex < callTimes.length; startIndex++) {
      let callsInWindow = 1;
      for (let endIndex = startIndex + 1; endIndex < callTimes.length; endIndex++) {
        if (callTimes[endIndex] - callTimes[startIndex] < toleratedWindowTime) callsInWindow++;
      }
      if (callsInWindow > maxWindowRequests) console.log('Call times:', callTimes.map(time => time - callTimes[0]));
      expect(callsInWindow).toBeLessThanOrEqual(maxWindowRequests);
    }

  })

})
