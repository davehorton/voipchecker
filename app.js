'use strict' ;

var drachtio = require('drachtio');
var app = drachtio() ;
var Srf = require('drachtio-srf') ;
var srf = app.srf = new Srf(app) ;
var config = app.config = require('./lib/config') ;
var logger = app.logger = require('./lib/logger')(config.log);
var Alerter = require('pagerduty-plus') ;
var alerter = app.alerter = new Alerter(config.alerts) ;
var fs = require('fs') ;
var path = require('path') ;
var debug = require('debug')('voipchecker') ;
var connected = false ;

module.exports = app ;

if (process.env.NODE_ENV === 'production') { 
  process.on('uncaughtException', function (err) {
    logger.error('received uncaughtException:') ;
    logger.error(err.stack)  ;
  }) ;
}

logger.info('attempting to connect to SIP server: ', config.drachtioServer) ;

srf
.connect(config.drachtioServer) 
.on('connect', function(err, hostport) {
  connected = true ;
  app.hostport = hostport ;
  logger.info('connected to drachtio listening for SIP on %s', hostport) ;
})
.on('error', function(err){
  connected = false ;
  logger.error('Error connecting to drachtio server: ', err.message ) ;
})
.on('reconnecting', function(opts) {
  logger.error('attempting to reconnect: ', opts) ;
}) ;  

var dnsCheck = require('./lib/dns') ;
var regCheck = require('./lib/register') ;

setInterval( function() {

  if( 'dns' in config.checks && config.checks.dns.length > 0 ) {
    config.checks.dns.forEach( function(check) {
      dnsCheck( check, function( err, addresses ) {
        if( err ) {
          if( !addresses ) {
            alerter.alert('DNS-FAILED', {
              target: `check.hostname: ${check.type}`,
              details: {
                query: check.hostname,
                error: err.message
              }
            }) ;
          }
          else {
            alerter.alert('DNS-UNEXPECTED', {
              target: `check.hostname: ${check.type}`,
              details: {
                error: err.message,
                addresses: addresses,
                query: check.hostname
              }
            }) ;            
          }
          return logger.error(`dns error: ${err.message}`) ;
        }
        alerter.alert('DNS-SUCCESS', {target: `check.hostname:${check.type}`}) ;

        logger.info(`dns succeeded for ${check.hostname}:${check.type}`) ;
      }) ;
    }) ;
  }

  if( !connected ) {
    logger.error('skipping checks....not connected to drachtio server') ;
    return ;
  }

  if( 'register' in config.checks && config.checks.register.length > 0 ) {
    config.checks.register.forEach( function(check) {
      check.hostport = app.hostport ;
      regCheck( check, function(err, req, res) {
        if( err ) {
          alerter.alert('REG-FAILED', {
            target: `${check.domain}:${check.user}`,
            details: {
              domain: check.domain,
              user: check.user,
              error: err.message
            }
          }) ;
          return logger.error(`register failed for host ${check.domain}: ${err.message}`) ;
        }

        // verify we hit the expected server
        if( check.expects && check.expects.registrar ) {
          if( res.source_address !== check.expects.registrar ) {
            alerter.alert('REG-BACKUP', {
              target: `${check.domain}:${check.user}`,
              details: {
                domain: check.domain,
                user: check.user,
                server: res.source_address
              }
            }) ;            
            return logger.error(`register succeeded against backup server for host ${check.domain}: ${res.source_address}`) ;
          }
        }
        alerter.alert('REG-SUCCESS', {target: `${check.domain}:${check.user}`}) ;
        logger.info(`register succeeded for ${check.domain}: responding address: ${res.source_address}`) ;
      }) ;
    }) ;
  }

}, config.interval || 30000) ;

//watch config file for changes - we allow the user to dynamically add or remove targets
var configPath = path.resolve(__dirname) + '/lib/config.json' ;
fs.watchFile(configPath, function () {
  try {
    logger.info('config.js was just modified...') ;

    delete require.cache[require.resolve(configPath)] ;
    app.config = config = require(configPath) ;
    logger = app.logger = require('./lib/logger')(config.log);
    alerter = app.alerter = new Alerter(config.alerts) ;


  } catch( err ) {
    logger.info('Error re-reading config.json after modification; check to ensure there are no syntax errors: ', err) ;
  }
}) ;
