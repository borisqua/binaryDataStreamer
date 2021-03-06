"use strict";
const
  log = require('debug')('mbeeg:DSVProcessor'),
  {Tools} = require('../tools')
;

class DSVProcessor extends require('stream').Transform {
  constructor({
                method
                , parameters
              }) {
    super({objectMode: true});
    this.method = method;
    this.parameters = Tools.copyObject(parameters);
  }
  
  // noinspection JSUnusedGlobalSymbols
  _transform(chunk, encoding, cb) {
    let epoch = Tools.copyObject(chunk);
    log(`      ::Epoch-${this.method.name}-- key/#/cycle - ${epoch.key}/${epoch.number}/${epoch.cycle}`);
    for (let i = 0, channelsNumber = epoch.channels.length; i < channelsNumber; i++) {
      this.parameters.timeseries = epoch.channels[i];
      this.parameters.samplingrate = epoch.samplingRate;
      epoch.channels[i] = this.method(this.parameters);//todo>> consider adding try catch
      epoch.state = this.method.name;
    }
    cb(null, epoch);//For output into objectType pipe
  }
}

module.exports = DSVProcessor;
