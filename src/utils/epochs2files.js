"use strict";

const
  Net = require('net')
  , fs = require('fs')
  , cli = require('commander')
  , {EBMLReader, OVReader, DSProcessor, Stimuli, Stringifier, Tools, Channels} = require('mbeeg')
  , config = Tools.loadConfiguration(`config.json`)
  , ovStringifier = new Stringifier({
    beginWith: `{`
    , chunkBegin: `"openViBE_Stream":`
    , chunksDelimiter: `, `
    , chunkEnd: `}`
    , endWith: `}\r\n`
    , indentationSpace: 2
  })
  , plainSamplesStringifier = new Stringifier({
    chunkEnd: `\r\n`
  })
  , plainStimsStringifier = new Stringifier({
    chunkEnd: `\r\n`
  })
  , epochsRawStringifier = new Stringifier({
    beginWith: `{"epochs": [`
    , chunksDelimiter: `,`
    , endWith: `]}\r\n`
    , indentationSpace: 2
  })
  , epochsFilteredStringifier = new Stringifier({
    beginWith: `{"epochs": [`
    , chunksDelimiter: `,`
    , endWith: `]}\r\n`
    , indentationSpace: 2
  })
  , epochsDetrendedStringifier = new Stringifier({
    beginWith: `{"epochs": [`
    , chunkBegin: ``
    , chunksDelimiter: `,`
    , endWith: `]}\r\n`
    , indentationSpace: 2
  })
  , openVibeClient = new Net.Socket() //3. Create TCP client for openViBE eeg data server
  , tcpFeeder = (context, tcpchunk) => {
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
    ebmlSource: openVibeClient.connect(config.signal.port, config.signal.host, () => {})
    , ebmlCallback: tcpFeeder
  })
  , samples = new OVReader({
    ovStream: openVibeJSON
  })
  , stimuli = new Stimuli({ //should pipe simultaneously to the dsprocessor and to the carousel
    signalDuration: config.stimulation.duration
    , pauseDuration: config.stimulation.pause
    , stimuliArray: config.stimulation.sequence.stimuli
  })
  , epochsRaw = new DSProcessor({
    stimuli: stimuli
    , samples: samples
    , channels: config.signal.channels
    , epochDuration: config.signal.epoch.duration
    , processingSequence: []//config.signal.dsp.vertical.steps
    , cyclesLimit: config.signal.cycles
  })
  , epochsFiltered = new DSProcessor({
    stimuli: stimuli
    , samples: samples
    , channels: config.signal.channels
    , epochDuration: config.signal.epoch.duration
    , processingSequence: config.signal.dsp.vertical.steps.slice(0, 1)
    , cyclesLimit: config.signal.cycles
  })
  , epochsDetrended = new DSProcessor({
    stimuli: stimuli
    , samples: samples
    , channels: config.signal.channels
    , epochDuration: config.signal.epoch.duration
    , processingSequence: config.signal.dsp.vertical.steps
    , cyclesLimit: config.signal.cycles
  })
  , channelsMonitor = new Channels({
    // keys: [20],
    // channels: [1] //, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  })
;
let
  ovStreamFile = fs.createWriteStream(`ovStream.json`)
  , samplesFile = fs.createWriteStream(`samples.json`)
  , stimuliFile = fs.createWriteStream(`stimuli.json`)
  , epochsRawFile = fs.createWriteStream(`epochsRaw.json`)
  , epochsFilteredFile = fs.createWriteStream(`epochsFiltered.json`)
  , epochsDetrendedFile = fs.createWriteStream(`epochsDetrended.json`)
;

cli.version('0.0.1')
  .description(`Epochs generator. Gets stimuli & samples flows and produces stream of json epoch objects.`)
  .usage(`<option>`)
  .option(`-c, --channels`, `Outputs activity by channels`)
  .option(`-e --epochs`, `Outputs json epoch-objects`)
  // .option(`-p --pipe`, `Gets stimuli flow from stdin through pipe`)
  .parse(process.argv)
;

// if (process.argv.length <= 2) cli.help();
openVibeJSON.pipe(ovStringifier).pipe(ovStreamFile);
samples.pipe(plainSamplesStringifier).pipe(samplesFile);
stimuli.pipe(plainStimsStringifier).pipe(stimuliFile);
epochsRaw.pipe(epochsRawStringifier).pipe(epochsRawFile);
epochsFiltered.pipe(epochsFilteredStringifier).pipe(epochsFilteredFile);
epochsDetrended.pipe(epochsDetrendedStringifier).pipe(epochsDetrendedFile);

epochsDetrended.pipe(channelsMonitor).pipe(process.stdout);

