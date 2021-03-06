"use strict";
const
  {Tools} = require('../tools')
  // , log = require('debug')('mbeeg:Controller')
;

class Controller {
  constructor({
                ebmlSourceParameters = {
                  host: config.mbeeg.signal.host,
                  port: config.mbeeg.signal.port
                },
                stimulationParameters = {
                  duration: config.mbeeg.stimulation.duration
                  , pause: config.mbeeg.stimulation.pause
                  , stimuliIdArray: config.mbeeg.stimulation.sequence.stimuli
                  , nextSequence: arr => {
                    let last = arr[arr.length - 1];
                    arr.sort(() => Math.random() - 0.5);
                    return arr[0] === last ? arr.push(arr.shift()) : arr;
                  }
                },
                epochParameters = {
                  cycleLength: config.mbeeg.stimulation.sequence.stimuli.length
                  , channels: config.mbeeg.signal.channels
                  , duration: config.mbeeg.signal.epoch.duration
                },
                verticalProcessingParameters = {
                 steps: [
                   {
                     method: Tools.butterworth4Bulanov,
                     parameters: config.config.mbeeg.signal.dsp.vertical.methods.butterworth4Bulanov
                   },
                   {
                     method: Tools.detrend,
                     parameters: config.mbeeg.signal.dsp.vertical.methods.detrend
                   }
                 ]
                },
                epochSeriesParameters = {
                  stimuliIdArray: config.mbeeg.stimulation.sequence.stimuli
                  , depthLimit: config.mbeeg.decision.methods.majority.maxCycles//todo>> settle bond between epochSeries depthLimit & decision methods maxCycles/Cycles
                },
                featuresParameters = {
                  method: samples => { return samples.reduce((a, b) => a + b) / samples.length; }
                },
                classifierParameters = {
                  method: Tools.absIntegral
                  , parameters: config.mbeeg.classification.methods.absIntegral
                  , postprocessing: vector => vector
                },
                decisionParameters = {
                  method: Tools.nInARowDecision
                  , parameters: config.mbeeg.decision.methods.nInARow
                }
              } = {}) {
    const
      Net = require('net')
      , {EBMLReader, OVReader, Stimuli, Epochs, DSVProcessor, EpochSeries, DSHProcessor, Stringifier, Classifier, Decisions} = require('../')
      , stringifier = new Stringifier({chunkEnd: `\r\n`})
      , openVibeClient = new Net.Socket() //3. Create TCP client for openViBE eeg data server
      , tcp2ebmlFeeder = (context, tcpchunk) => {
        if (context.tcpbuffer === undefined) {
          context.tcpbuffer = Buffer.alloc(0);
          context.tcpcursor = 0;
        }
        context.tcpbuffer = Buffer.concat([context.tcpbuffer, tcpchunk]);
        let bufferTailLength = context.tcpbuffer.length - context.tcpcursor;
        while (bufferTailLength) {
          if (!context.expectedEBMLChunkSize && bufferTailLength >= 8) {
            context.expectedEBMLChunkSize = context.tcpbuffer.readUIntLE(context.tcpcursor, 8);//first Uint64LE contains length of ebml data sent by openViBE
            context.tcpcursor += 8;
            bufferTailLength -= 8;
          }
          else if (!context.expectedEBMLChunkSize)
            break;
          if (bufferTailLength >= context.expectedEBMLChunkSize) {
            context.ebmlChunk = Buffer.from(context.tcpbuffer.slice(context.tcpcursor, context.tcpcursor + context.expectedEBMLChunkSize));
            context.tcpcursor += context.expectedEBMLChunkSize;
            bufferTailLength -= context.expectedEBMLChunkSize;
            context.expectedEBMLChunkSize = 0;
          } else
            break;
          context.write(context.ebmlChunk);
        }
        if (!bufferTailLength) {
          context.tcpbuffer = Buffer.alloc(0);
          context.tcpcursor = 0;
        }
      }
      , openVibeJSON = new EBMLReader({
        ebmlSource: openVibeClient.connect(ebmlSourceParameters.port, ebmlSourceParameters.host, () => {})
        , ebmlCallback: tcp2ebmlFeeder
      })
      , samples = new OVReader()
      , stimuli = new Stimuli({ //should pipe simultaneously to the epochs and to the carousel
        duration: stimulationParameters.duration
        , pause: stimulationParameters.pause
        , stimuliIdArray: stimulationParameters.stimuliIdArray
        , nextSequence: stimulationParameters.nextSequence
      })
      , epochs = new Epochs({
        stimuli: stimuli
        , samples: openVibeJSON.pipe(samples)
        , cycleLength: epochParameters.cycleLength
        , channels: epochParameters.channels
        , epochDuration: epochParameters.duration
      })
      , butterworth4 = new DSVProcessor({
        method: vdspFilterParameters.method
        , parameters: vdspFilterParameters.parameters
      })
      , detrend = new DSVProcessor({
        method: vdspDetrendParameters.method
        , parameters: vdspDetrendParameters.parameters
      })
      , epochSeries = new EpochSeries({
        stimuliIdArray: epochSeriesParameters.stimuliIdArray
        , depthLimit: epochSeriesParameters.depth
      })
      , features = new DSHProcessor({method: featuresParameters.method})
      , classifier = new Classifier({
        method: classifierParameters.method
        , parameters: classifierParameters.parameters
        , postprocessing: classifierParameters.postprocessing
      })
      , decisions = new Decisions({
        method: decisionParameters.method
        , parameters: decisionParameters.parameters
      });
    
    epochs
      .pipe(butterworth4)
      .pipe(detrend)
      .pipe(epochSeries)
      .pipe(features)
      .pipe(classifier)
      .pipe(decisions);
      // .pipe(stringifier)
      // .pipe(process.stdout);
    
  }
  
  get
}

module.exports = Controller;
