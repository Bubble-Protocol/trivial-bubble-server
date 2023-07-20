import { blockchainProviders } from '@bubble-protocol/core';

const STATS_MONITOR_PERIOD = 1*60*1000;
const STATS_MONITOR_OUTPUT_PERIOD = 24*60*60*1000;
const STATS_RUNAWAY_CONSECUTIVE_QUEUE_INCREASE_THRESHOLD = 5;

export class ThrottledWeb3Provider extends blockchainProviders.Web3Provider {

  constructor(chainId, web3, abiVersion, maxWindowRequests, windowTime) {
    super(chainId, web3, abiVersion);
    this.requestQueue = [];
    this.requestPeriod = (windowTime && maxWindowRequests) ? Math.ceil(windowTime / maxWindowRequests) : 0;
    this.stats = {
      maxQueueSize: 0,
      maxQueueSizeLast24h: 0,
      runawayCheck: {
        lastQueueSize: 0,
        count: 0,
      }
    }
    this._sendNext = this._sendNext.bind(this);
    this._monitorStats = this._monitorStats.bind(this);
    this._outputStats = this._outputStats.bind(this);
    this.monitorTimer = setTimeout(this._monitorStats, STATS_MONITOR_PERIOD);
    this.outputMonitorTimer = setTimeout(this._outputStats, STATS_MONITOR_OUTPUT_PERIOD);
  }

  async getPermissions(contract, account, file) {
    if (this.requestPeriod === 0) return super.getPermissions(contract, account, file);
    return new Promise((resolve, reject) => {
      const request = () => super.getPermissions(contract, account, file).then(resolve).catch(reject);
      this.requestQueue.push(request);
      if (this.requestQueue.length === 1) {
        request();
        setTimeout(this._sendNext, this.requestPeriod);
      }
      this._updateStats();
    })
  }

  _sendNext() {
    this.requestQueue = this.requestQueue.slice(1);
    if (this.requestQueue.length > 0) {
      this.requestQueue[0]();
      setTimeout(this._sendNext, this.requestPeriod);
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
    if (this.stats.runawayCheck > STATS_RUNAWAY_CONSECUTIVE_QUEUE_INCREASE_THRESHOLD) 
      console.log('Chain', this.chainId, 'possible runaway detected. Queue size:', this.requestQueue.length);
      this.monitorTimer = setTimeout(this._monitorStats, STATS_MONITOR_PERIOD);
  }

  _outputStats() {
    console.log('Chain', this.chainId, 'server throttling stats:', {maxQueueSize: this.stats.maxQueueSize, maxQueueSizeLast24h: this.stats.maxQueueSizeLast24h});
    this.outputMonitorTimer = setTimeout(this._outputStats, STATS_MONITOR_OUTPUT_PERIOD);
  }

  close() {
    clearTimeout(this.outputMonitorTimer);
    clearTimeout(this.monitorTimer);
  }

}