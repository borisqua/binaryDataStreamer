/*
* todo>> - Controller class with samples & stimuli on input and
* todo>> emits raw and vertically processed epochs, epochsSeries matrices, horizontal
* todo>> processed epochs (features), classification verdicts, and decisions
*
* todo>> - refactoring of mbeegntsrv & carousel using controller object of Controller class
*/
'use strict';

module.exports = {
  
  //Core
  EBMLReader: require('./ebml/reader')
  , OVReader: require('./openvibe/reader')
  , Stimuli: require('./stimuli')
  , Epochs: require('./epochs')
  , EpochSeries: require('./epochseries')
  , DSVProcessor: require('./dsvprocessor')
  , DSHProcessor: require('./dshprocessor')
  , Classifier: require('./classifier')
  , Decisions: require('./decisions')
  // , Controller: require('./controller')
  
  //Helpers
  , Tools: require('./tools').Tools
  , Stringifier: require('./tools').Stringifier
  , Objectifier: require('./tools').Objectifier
  , NTVerdictStringifier: require('./tools').NTVerdictStringifier
  , NTStimuliStringifier: require('./tools').NTStimuliStringifier
  , Channels: require('./tools').Channels
  , Sampler: require('./tools').Sampler
  , EpochsHorizontalLogger: require('./tools').EpochsHorizontalLogger
  , EpochsVerticalLogger: require('./tools').EpochsVerticalLogger
  , FeatureHorizontalLogger: require('./tools').FeatureHorizontalLogger
  , FeatureVerticalLogger: require('./tools').FeatureVerticalLogger
  
};
