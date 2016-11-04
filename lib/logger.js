'use strict' ;

var winston = require('winston') ;
var moment = require('moment') ;

module.exports = function(opts) {
  return new winston.Logger({
    transports: [
        new (winston.transports.File)({
          timestamp: function() {
            return moment().format();
          },
          json: false,
          filename: opts.file,
          maxsize: opts.maxsize,
          maxFiles: opts.maxFiles,
          rotationFormat: function() {
            return moment().format('-YYYY-MM-DD-HH-mm-ss') ;
          },
          formatter: function(options) {
            return options.timestamp() +':  '+ (undefined !== options.message ? options.message : '') +
              (options.meta && Object.keys(options.meta).length ? '\n\t'+ JSON.stringify(options.meta) : '' );
          }          
        })
    ]
  })
};