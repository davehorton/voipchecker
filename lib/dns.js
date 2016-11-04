'use strict' ;

var dns = require('dns') ;

exports = module.exports = function( opts, callback ) {
  
  dns.resolve( opts.hostname, opts.type, function(err, addresses) {

    if( err ) { return callback( err ); }

    if( !opts.expects ) { return callback(null, addresses); }

    if( opts.expects.length !== addresses.length ) {
      var msg = `${opts.hostname}:${opts.type} - incorrect number of results: expected ${opts.expects.length} got ${addresses.length}: ${JSON.stringify(addresses)}`;
      return callback(new Error(msg), addresses) ;
    }

    callback(null, addresses) ;

  }) ;
}