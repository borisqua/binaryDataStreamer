"use strict";
const
  log = require('debug')('mbeeg:DSHProcessor')
  , {Tools} = require('mbeeg')
;

/**
 * @class classifier transforms input sample sequence into array of pairs (identity, probability of identification)
 */
class DSHProcessor extends require('stream').Transform {
  constructor({
                method
                // , parameters: {}
                // learning = false,
              } = {}) {
    super({objectMode: true});
    this._method = method;
    // this._parameters = Tools.copyObject(parameters);
  }
  
  // noinspection JSUnusedGlobalSymbols
  _transform(cycle, encoding, cb) {
    log(`           ::NextFeatureReady--`);
    cb(
      null,
      cycle.map(key =>
        key.map(ch =>
          ch.map(samples =>
            this._method(samples))))
    );
  }
  
}

module.exports = DSHProcessor;
