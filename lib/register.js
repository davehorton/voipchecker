'use strict' ;

var srf = require('../app').srf ;

exports = module.exports = function( opts, callback ) {

  var domain = opts.domain ;
  var user = opts.user ;
  var password = opts.password ;
  var hostport = opts.hostport ;

  srf.request(`sip:${user}@${domain}`, {
      method: 'REGISTER',
      headers: {
          'Expires': '3600',
          'From': `sip:${user}@${domain}`,
          'Contact':`<sip:${user}@${hostport}>`
      }, 
      auth: {
        username: user,   
        password: password 
      }
  }, function(err, req){
      if( err ) { 
        return callback(err) ; 
      }
      req.on('response', function(res) {
          if( 200 !== res.msg.status) { 
            return callback( new Error(`Error registering: ${res.status}`) ); 
          }
          callback(null, req, res) ;
      }) ;
  }) ;
}

