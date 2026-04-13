import { blockchainProviders } from '@bubble-protocol/server';

const STATS_MONITOR_PERIOD = 1*60*1000;
const STATS_MONITOR_OUTPUT_PERIOD = 24*60*60*1000;
const STATS_RUNAWAY_CONSECUTIVE_QUEUE_INCREASE_THRESHOLD = 5;

export class ThrottledWeb3Provider extends blockchainProviders.EVMProvider {

  constructor(protocolVersion, chainId, provider, hostDomain, maxWindowRequests, windowTime) {
    super(protocolVersion, chainId, provider, hostDomain);
    this.requestQueue = [];
    this.windowTime = windowTime || 0;
    this.maxWindowRequests = maxWindowRequests;
    this.requestTimestamps = [];
    this.stats = {
      maxQueueSize: 0,
      maxQueueSizeLast24h: 0,
      runawayCheck: {
        lastQueueSize: 0,
        count: 0,
      }
    }
    this._serviceQueue = this._serviceQueue.bind(this);
    this._monitorStats = this._monitorStats.bind(this);
    this._outputStats = this._outputStats.bind(this);
    this.monitorTimer = setTimeout(this._monitorStats, STATS_MONITOR_PERIOD);
    this.outputMonitorTimer = setTimeout(this._outputStats, STATS_MONITOR_OUTPUT_PERIOD);
  }

  async getPermissions(contract, account, file) {
    if (this.windowTime === 0 || !this.maxWindowRequests) return super.getPermissions(contract, account, file);
    return new Promise((resolve, reject) => {
      const request = () => super.getPermissions(contract, account, file).then(resolve).catch(reject);
      this.requestQueue.push(request);
      this._serviceQueue();
      this._updateStats();
    })
  }

  _serviceQueue() {
    if (this.requestQueue.length === 0) return;
    const now = Date.now();
    const windowStart = now - this.windowTime;
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > windowStart);
    if (this.requestTimestamps.length >= this.maxWindowRequests) {
      const nextAvailableTime = this.requestTimestamps[0] + this.windowTime;
      clearTimeout(this.serviceTimer);
      this.serviceTimer = setTimeout(this._serviceQueue, Math.max(nextAvailableTime - now, 0));
      return;
    }
    const request = this.requestQueue.shift();
    this.requestTimestamps.push(now);
    request();
    if (this.requestQueue.length > 0) {
      clearTimeout(this.serviceTimer);
      this.serviceTimer = setTimeout(this._serviceQueue, 0);
    }
  }

  _updateStats() {
    if (this.requestQueue.length > this.stats.maxQueueSize) this.stats.maxQueueSize = this.requestQueue.length;
    if (this.requestQueue.length > this.stats.maxQueueSizeLast24h) this.stats.maxQueueSizeLast24h = this.requestQueue.length;
  }

  _monitorStats() {
    // monitor for runaway
    if (this.requestQueue.length > this.stats.runawayCheck.lastQueueSize) this.stats.runawayCheck.count++;
    else this.stats.runawayCheck.count = 0;
    this.stats.runawayCheck.lastQueueSize = this.requestQueue.length;
    if (this.stats.runawayCheck.count > STATS_RUNAWAY_CONSECUTIVE_QUEUE_INCREASE_THRESHOLD) {
      console.log('Chain', this.chainId, 'possible runaway detected. Queue size:', this.requestQueue.length);
    }
    this.monitorTimer = setTimeout(this._monitorStats, STATS_MONITOR_PERIOD);
  }

  _outputStats() {
    console.log('Chain', this.chainId, 'server throttling stats:', {maxQueueSize: this.stats.maxQueueSize, maxQueueSizeLast24h: this.stats.maxQueueSizeLast24h});
    this.outputMonitorTimer = setTimeout(this._outputStats, STATS_MONITOR_OUTPUT_PERIOD);
  }

  close() {
    clearTimeout(this.serviceTimer);
    clearTimeout(this.outputMonitorTimer);
    clearTimeout(this.monitorTimer);
  }

}
