"use strict";
const fili = require('fili');

/** @class DSPLib contains raw EEG data preprocessing functions
 * (filtering, epoching, reshaping, etc...)
 *
 */
class DSPLib {
  
  
  /**
   * epoch function binds stimuli data with EEG data on timestamp by adding to EEG data
   * stimulus ID (keyID), thus the stimulus ID becomes an ID of epoch.
   *
   * @param {Array} stimuli - stream, buffer or object that contains set of pairs {id, timestamp}
   * @param {Array} series - stream, buffer or object that contains set of vectors [timestamp, ch0, ch1, ... , chN]
   * with values of N EEG channels
   * @param samplingRate - sampling rate of digital signal
   * @param {number} duration - epoch length in seconds (equals to samples number per epoch divided by sample rate)
   * @return {Array} array of epoch objects - {key: id, timestamp: stimulusTime, channels:[ch][values]},
   * where key - selected key (assosiated with epoch), ch - channel of signal, [values] - set of digital signal values
   * for distinct channel
   **/
  static epochs(stimuli, series, samplingRate, duration) {
    
    let result = [];
    let epoch = {};
    
    epoch.channels = [];
    
    for (let stimulus in stimuli) {
      epoch.key = stimulus.id;
      epoch.timestamp = stimulus.timestamp;
      epoch.samplingRate = samplingRate;
      epoch.duration = duration;
      for (let entry in series) {
        //  (until timeseries[i].timestamp >= stimulus.timestamp && timeseries[i].timestamp <= stimulus.timestamp + duration)
        if (entry.timestamp >= stimulus.timestamp && entry.timestamp <= stimulus.timestamp + duration) {
          for (let ch = 1; ch < series.length; ch++) {
            if (epoch.channels.length < ch) {
              epoch.channels.push([]);
            }
            epoch.channels[ch - 1].push(entry[ch])
          }
        }
      }
      result.push(epoch);
      //here could be the test assertion: sampleRate * duration === channels[i].length
    }
    
    return result;
  }
  
  /** lowpass fourth order Butterworth filter with zero-phase (or forward backward filtering)
   *
   * @param {Array} timeseries - stream, buffer or object with values to filter
   * @param {number} samplingrate - timeseries sampling rate, Hz
   * @param {number} cutoff - low pass cut off frequency, Hz
   * @param {boolean} passthrough if true function returns array equal to input timeseries (default = false)
   * @return {Array} time series filtered data (same size as input flow)
   */
  static butterworth4Bulanov(timeseries, samplingrate = 0, cutoff = 0, passthrough = false) {
    
    if (!timeseries.length) return null;
    if (!cutoff || passthrough) return timeseries.slice();
    if (!samplingrate) throw 'Butterworth4 error! Non zero sampling rate parameter is required!';
    if (timeseries.length < 2 / cutoff) throw 'Butterworth4 error! The length of timeseries must be at least as doubled 1/cutoff!';
    if (samplingrate / 2 < cutoff) throw 'Butterworth4 error! The sampling rate of input time series must be at least as doubled cutoff frequiency!';
    
    let dF2 = timeseries.length;
    let dat2 = Array.apply(null, new Array(dF2 + 3)).map(Number.prototype.valueOf, 0);
    
    dat2[1] = timeseries[0];
    dat2[0] = timeseries[0];
    for (let r = 0; r < dF2; r++) dat2[r + 2] = timeseries[r];
    // dat2[dF2 + 2] = timeseries[dF2-1];
    // dat2[dF2 + 1] = timeseries[dF2-1];
    
    let w = cutoff * Math.PI / samplingrate;
    let wc = Math.tan(w); //let wc = Math.pow(w, 3) / 3 + Math.pow(w, 5) * 2 / 15; //tangent by MacLaurin series
    
    let k1 = Math.SQRT2 * wc;
    let k2 = wc * wc; // Math.pow(wc,2);
    let a = k2 / (1 + k1 + k2);
    let b = 2 * a;
    let c = a;
    let k3 = b / k2;
    let d = -2 * a + k3;
    let e = 1 - (2 * a) - k3;
    
    //Recursive triggers - enabled. Filter is performed (first, last points constant)
    let datYt = Array.apply(null, new Array(dF2 + 4)).map(Number.prototype.valueOf, 0);
    datYt[1] = timeseries[0];
    datYt[0] = timeseries[0];
    for (let i = 1; i <= dF2 + 1; i++)
      datYt[i + 1] = a * dat2[i + 1] + b * dat2[i] + c * dat2[i - 1] + d * datYt[i] + e * datYt[i - 1];
    
    datYt[dF2 + 3] = datYt[dF2 + 1];
    datYt[dF2 + 2] = datYt[dF2 + 1];
    
    //Forward filter
    let datZt = Array.apply(null, new Array(dF2 + 2)).map(Number.prototype.valueOf, 0);
    
    datZt[dF2] = datYt[dF2 + 2];
    datZt[dF2 + 1] = datYt[dF2 + 3];
    for (let i = dF2 - 1; i >= 0; i--)
      datZt[i] = a * datYt[i + 2] + b * datYt[i + 3] + c * datYt[i + 4] + d * datZt[i + 1] + e * datZt[i + 2];
    
    return datZt.splice(1, dF2);
  }
  
  /** custom detrend of time series data
   *
   * @param {Array} timeseries - stream, buffer or object with values ot detrend
   * @param {boolean} passtrough if true return trend & detrend equals to input timeseries (default = false)
   * @return {Array} detrend - detrended data, the same size as series input is
   */
  static detrend(timeseries, passtrough = false) {
    if (passtrough) {
      let arr = timeseries.slice();
      return {trend: arr, detrend: arr};
    }
    if (!timeseries) throw `Detrend error! No input data!`;
    let n = timeseries.length;
    let sumxy = 0;
    for (let i = 0; i < n; i++) sumxy += (i + 1) * timeseries[i];
    let sumx = 0;
    for (let i = 0; i < n; i++) sumx += (i + 1);
    let sumy = 0;
    for (let i = 0; i < n; i++) sumy += timeseries[i];
    let sumxx = 0;
    for (let i = 1; i <= n; i++) sumxx += Math.pow((i + 1), 2);
    let a = (n * sumxy - sumx * sumy) / (n * sumxx - sumx * sumx);
    let b = (sumy - a * sumx) / n;
    
    let trend = new Array(n);
    let detrend = new Array(n);
    
    for (let i = 0; i < n; i++) {
      trend[i] = (i + 1) * a + b;
      detrend[i] = (timeseries[i] / trend[i] - 1) * 100;
    }
    
    return detrend;
  }
  
  /** common average reference filter (CAR-filter) filters noise common for all channels by subtracting sum of channels
   * from each channel multiplied to channels number
   *
   * @param {Array} series - stream, buffer or object that contains set vectors {timestamp, ch0, ch1, ... , chN} with values of N EEG channels
   * @param {number} start - column number which is first channels data column in matrix (default = 0)
   * @return {Array} - stream, buffer or object that contains vectors {timestamp, ch0, ch1, ... , chN} with modified values of N EEG channels
   */
  static car(series, start = 0) {
    let n = series[0].length - start;
    let arr = series.slice(0);
    for (let i = 0; i < series.length; i++) {
      for (let j = start; j < series[i].length; j++) {
        arr[i][j] = arr[i][j] * n - arr[i].reduce((a, b) => a + b, 0);
      }
    }
    return arr;
  }
  
  /** function adds additional columns to series matrix with respective to existing channels CAR filtered values
   *
   * @param {Array} series - stream, buffer or object that contains set vectors {timestamp, ch0, ch1, ... , chN} with values of N EEG channels
   * @param {number} start - column number which is first channels data column in matrix (default = 0)
   * @param {Array} car - stream, buffer or object that contains vectors {timestamp, ch0, ch1, ... , chN} with modified values of N EEG channels
   * @return {Array} - stream, buffer or object that contains vectors {timestamp, ch0, ch1, ... , chN} with modified values of N EEG channels
   */
  static seriesCARExtension(series, start = 0, car = null) {
    let arr = series.slice();
    if (!car) car = this.car(series, start);
    for (let i = 0; i < series.length; i++) {
      for (let j = 0; j < car[i][j].length; j++) {
        arr[i][j].push(car[j]);
      }
    }
    return arr;
  }
  
  /** calculates rereferenced value equals to current value minus mean value calculated for current epoch
   *
   * @param {Array} epochs - array of epoch objects - {key: id, channels:[ch][values]}, where key - selected key
   * (associated with epoch), ch - channel of signal, [values] - set of digital signal values for distinct channel
   * @return {Array} epochs array with rereferenced channel values
   */
  static rereference(epochs) {
    let results = [];
    let rereferenced = {};
    rereferenced.channels = [];
    
    for (let epoch in epochs) {
      rereferenced.key = epoch.key;
      rereferenced.timestamp = epoch.timestamp;
      for (let c = 0; c < epoch.channels.length; c++) {
        rereferenced.channels.push(epoch.channels[c].reduce((a, b) => a + b) / epoch.channels.length);
      }
      results.push(rereferenced);
    }
    return results;
  }
}

module.exports = DSPLib;