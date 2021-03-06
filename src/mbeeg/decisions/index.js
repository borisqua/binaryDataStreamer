"use strict";
const
  log = require('debug')('mbeeg:Decisions'),
  {Tools} = require('../tools')
;

class Decisions extends require('stream').Transform {
  constructor({
                method //decision making method//should return {status, winner, ready}
                , parameters //parameters of decision making method
              }) {
    super({objectMode: true});
    this.method = method;//should return {status, winner, ready}
    this.parameters = Tools.copyObject(parameters);
    this.parameters.verdictsQueue = [];
  }
  
  _reset() {
    this.parameters.verdictsQueue = [];
    // this.parameters.winnersQueues = [[]];
    //todo>> winners can be in every channel so Decisions class should be modified to reflect this fact
  }
  
  // noinspection JSUnusedGlobalSymbols
  _transform(chunk, encoding, cb) {
    let verdicts = Tools.copyObject(chunk);
    this.parameters.verdictsQueue.push(verdicts);
    this.result = this.method(this.parameters);
    
    if (this.result.ready) {
      cb(null, this.result.winners[0]);//[0] because we work with only channel yet
      log(`                ::${this.result.status}`);//todo>> automate indentation by tracking call levels (use global variable)
      this._reset();
    }
    else {
      cb();
      log(`                ::${this.result.status}`);
    }
    
  }
}

module.exports = Decisions;
