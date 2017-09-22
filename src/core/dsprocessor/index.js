"use strict";
//TODO refactor to use writable capabilities of the DSProcessor stream, by writing merged stream of stimuli and eeg data. For this purpose DSProcess should have capability to distinguish chunks of this two streams.
const
  appRoot = require(`app-root-path`),
  Tools = require(`${appRoot}/src/tools/helpers`).mbTools;

class DSProcessor extends require(`stream`).Transform {
//TODO channels selecting
  constructor({
                stimuli
                , eeg
                , channels = [1] //first channel by default
                , learning = false
                , epochDuration = 1000
                , samplingRate = 128
                , sequence = `filter, detrend`
                , objectMode = true
              }) {
    super({objectMode: true});
    
    let epochsFIFO = [];
    let samplesFIFO = [];
    let currentStimulus = [];
    let currentSample = [];
    
    this.channels= channels;
    this.samplingRate = samplingRate;
    this.learning = null;
    this.objectMode = objectMode;
    this.steps = sequence.split(/\s*,\s*/);
    
    stimuli.on('data', stimulus => {
      // currentStimulus = JSON.parse(stimulus);
      currentStimulus = stimulus;
      
      // let stimulusPeriod = stimuli.signalDuration + stimuli.pauseDuration;
      // if (currentStimulus[0] - currentSample[0] < -stimulusPeriod) eeg.pause();
      // else eeg.resume();
      // if (currentStimulus[0] - currentSample[0] > stimulusPeriod) stimuli.pause();
      // else stimuli.resume();
      
      let epoch = {};
      epoch.key = currentStimulus[1];
      epoch.stimulusDuration = stimuli.signalDuration;
      epoch.stimulusPause = stimuli.pauseDuration;
      epoch.epochDuration = epochDuration;
      epoch.samplingRate = this.samplingRate;
      epoch.state = `raw`;//[cycle_idx]
      epoch.full = false;//[cycle_idx]
      epoch.timestamp = currentStimulus[0];//[cycle_idx]
      epoch.target = currentStimulus[2];//[cycle_idx]
      epoch.channels = [];//[ch_idx][sample_idx][cycle_idx]
      epochsFIFO.push(epoch);
      
      let obsoleteSampleIndex = null;
      
      for (let i = 0, epochsFIFOlength = epochsFIFO.length; i < epochsFIFOlength; i++) {
        let e = epochsFIFO[i];
        for (let j = 0, samplesFIFOlength = samplesFIFO.length; j < samplesFIFOlength; j++) {
          let s = samplesFIFO[j];
          if (_sampleInsideEpoch(e, s[0])) {
            _addSamples(this, e, s);
            if (e.channels.length && e.channels[0].length === parseInt(e.epochDuration * e.samplingRate / 1000)) {
              e.full = true;
              this.write(epochsFIFO.splice(i, 1)[0]);
              i--;
              epochsFIFOlength--;
            }
          } else if (s[0] < e.timestamp) {
            obsoleteSampleIndex = j;
          }
        }
      }
      samplesFIFO.splice(0, obsoleteSampleIndex + 1);
      // console.log(`---- epochs: ${epochsFIFO.length}; samples: ${samplesFIFO.length}  ${currentStimulus[0]} ${currentSample[0]} delta(e-s): ${currentStimulus[0] - currentSample[0]}`);
    });
    
    eeg.on('data', sample => {
      // currentSample = JSON.parse(sample);
      currentSample = sample;
      
      // let stimulusPeriod = stimuli.signalDuration + stimuli.pauseDuration;
      // if (currentStimulus[0] - currentSample[0] < -stimulusPeriod) eeg.pause();
      // else eeg.resume();
      // if (currentStimulus[0] - currentSample[0] > stimulusPeriod) stimuli.pause();
      // else stimuli.resume();
      
      if (epochsFIFO.length === 0 || epochsFIFO[0].timestamp <= currentSample[0])
        samplesFIFO.push(currentSample);//here it's only has sense to store sample if there isn't epochs in the epochsFIFO queue (so we don't know if epochs for current sample will be) or if the sample came after the earliest epoch available in epochsFIFO queue
      for (let i = 0, epochsFIFOlength = epochsFIFO.length; i < epochsFIFOlength; i++) {
        let e = epochsFIFO[i];
        if (_sampleInsideEpoch(e, currentSample[0])) {
          _addSamples(this, e, currentSample);
          if (e.channels.length && e.channels[0].length === e.epochDuration * e.samplingRate / 1000) {
            e.full = true;
            // this.epochs.write(JSON.stringify(epochsFIFO.splice(i, 1)[0], null, 2));
            this.write(epochsFIFO.splice(i, 1)[0]);
            i--;
            epochsFIFOlength--;
          }
        }
      }
      // console.log(`ssss epochs: ${epochsFIFO.length}; samples: ${samplesFIFO.length}  ${currentStimulus[0]} ${currentSample[0]} delta(e-s): ${currentStimulus[0] - currentSample[0]}`);
    });
    
    function _sampleInsideEpoch(epoch, sampleTimestamp) {
      return sampleTimestamp >= epoch.timestamp && sampleTimestamp <= epoch.timestamp + epoch.epochDuration;
    }
    
    function _addSamples(context, epoch, sample) {
      for (let ch = 1; ch < sample.length; ch++) {
        // if (context.channels.includes(ch))
        let channelIndex = context.channels.indexOf(ch);
        if (channelIndex>=0)
          if (epoch.channels[channelIndex] === undefined) {
            epoch.channels[channelIndex] = [sample[ch]];
          } else {
            epoch.channels[channelIndex].push(sample[ch]);
          }
      }
    }
  }
  
  // noinspection JSUnusedGlobalSymbols
  _transform(epoch, encoding, cb) {
    
    for (let i = 0, channelsNumber = epoch.channels.length; i < channelsNumber; i++) {
      for (let step of this.steps) {
        switch (step) {
          case 'filter':
            epoch.channels[i] = Tools.butterworth4Bulanov(epoch.channels[i], epoch.samplingRate, 9);
            epoch.state = step;
            break;
          case 'detrend':
            epoch.channels[i] = Tools.detrend(epoch.channels[i]);
            epoch.state = step;
            break;
        }
      }
    }
    if (this.objectMode)
      cb(null, epoch);//For output into objectType pipe
    else
      cb(null, JSON.stringify(epoch, null, 2)); //For output into process.stdout (and maybe TCP)
  }
}

module.exports = DSProcessor;
