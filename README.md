# voipchecker

A nodejs application utilizing the [drachtio](https://github.com/davehorton/drachtio#readme) framework that periodically checks the health of one or more VoIP server applications and alerts via PagerDuty if the application is down.

Currently-implented checks include:
* DNS Query
* SIP Registration

The application is driven by a configuration file, which is described below.  Currently, the application performs each configured check every 30 seconds.

To run the application, clone or download it, run <code>npm install</code>, copy lib/config.json/example to lib/config.json and edit it to your needs (see below), and then <code>node app.js</code>.

## DNS check

To perform DNS checks, add one or more entries to the "dns" array of the "checks" property of the config file:

```js
{
  "checks": {
    "dns": [
      {
        "hostname": "_sip._udp.foo.bar.com",
        "type": "SRV",
        "expects": [
          {
            "priority": 1,
            "weight": 5,
            "port": 5060,
            "name": "sip1.foo.bar.com"
          }, 
          {
            "priority": 2,
            "weight": 10,
            "port": 5060,
            "name": "sip2.foo.bar.com"
          }
        ]
      }
    ],
    ...
```
As shown in the example above, the entry for a DNS check must include a hostname and a type of DNS query to be sent.  Additionally, an 'expects' array may be provided to describe the expected results.  An alert will be generated if the DNS query fails to return any results, or (if an 'expects' property is provided) results different from those expected are returned.

## SIP registration checks

To perform SIP registration checks, add one or more entries to the "register" array of the "checks" property in the config file:

```js
    "register": [
      {
        "domain": "foo.bar.com",
        "user": "rallycat",
        "password": "qtMuc464?as",
        "expects": {
          "registrar": "162.243.62.116"
        }

      }
    ]
```
Each entry must include the domain to register against and a sip username and password to authenticate with.  Additionally, an 'expects' property can be provide that contains the expected IP address of the server that is expected to handle the registration transaction .  An alert will be generated if the registration failed for any reason, or (if an 'expects' property is provided) a server other than the expected server handled the registration (this can be useful, for instance, to determine if the registration unexpectedly went to a backup server).

## PagerDuty integration

#### PagerDuty service keys

The application uses the generic API of PagerDuty, and requires a service and associated service key to be created using the PagerDuty dashboard.

The configuration file contains the pagerduty service keys that will be used to create (and resolve) incidents on PagerDuty.  The "serviceKeys" property in the configuration file contains an array of pagerduty service keys, and alerts will be sent to all configured pagerduty services using those keys.

```js
"serviceKeys": ['your-service-key-here','another-service-key-if-you-want']
```

#### Throttling alerts

The 'events' property in the configuration file contains a list of the types of alerts that can be sent to pagerduty by the application.  For each event, it is optionally possible to throttle how frequently an alert for that event is sent to pagerduty, e.g. to alert about a DNS problem no more frequently than every 5 minutes:

```js
    "events": [
      {
        "name": "DNS-FAILED",
        "description": "Dns query failed with error",
        "throttle": "5 mins"    // => also accepts "90 secs", for instance
      },
      ...
```

#### Automatically resolving alerts

The application will automatically resolve incidents on pagerduty once DNS queries or SIP registrations start working again after a prior failure.  This is accomplished by means of the event definitions in the configuration file that indicate which event resolves which other event:

```js
      {
        "name": "DNS-FAILED",
        "description": "Dns query failed with error"
      },
      {
        "name": "DNS-UNEXPECTED",
        "description": "Dns query returned unexpected results"
      },
      {
        "name": "DNS-SUCCESS",
        "description": "Dns query returned expected results",
        "resolves": ["DNS-FAILED", "DNS-UNEXPECTED"],
        "notify": false     // => means: resolve the incident on pagerduty but dont send a new alert
      },
      ...
```

For more information on the pagerduty integration, please refer to the documentation for [pagerduty-plus](https://github.com/davehorton/pagerduty-plus#readme)

## Full configuration file 

```js
{
  "drachtioServer" : {
    "address": "127.0.0.1", // => address drachtio-server is listening on for apps
    "secret" : "cymru"      // => shared secret
  },
  "checks": {               // => described above
    "dns": [
      {
        "type": "SRV",
        "hostname": "_sip._udp.foo.bar.com",
        "expects": [
          {
            "priority": 1,
            "weight": 5,
            "port": 5060,
            "name": "sip1.foo.bar.com"
          }, 
          {
            "priority": 2,
            "weight": 10,
            "port": 5060,
            "name": "sip2.foo.bar.com"
          }
        ]
      },
      {
        "type": "SRV",
        "hostname": "_sip._tcp.foo.bar.com",
        "expects": [
          {
            "priority": 1,
            "weight": 5,
            "port": 5060,
            "name": "sip1.foo.bar.com"
          }, 
          {
            "priority": 2,
            "weight": 10,
            "port": 5060,
            "name": "sip2.foo.bar.com"
          }
        ]
      }
    ],
    "register": [
      {
        "domain": "foo.bar.com",
        "user": "394940-5--",
        "password": "asdfasfdasdYDad2@",
        "expects": {
          "registrar": "142.242.62.126"
        }

      }
    ]
  },
  "alerts": {
    "events": [
      {
        "name": "DNS-FAILED",
        "description": "Dns query failed with error",
        "throttle": "5 mins"
      },
      {
        "name": "DNS-UNEXPECTED",
        "description": "Dns query returned unexpected results",
        "throttle": "5 mins"
      },
      {
        "name": "DNS-SUCCESS",
        "description": "Dns query returned expected results",
        "resolves": ["DNS-FAILED", "DNS-UNEXPECTED"],
        "notify": false
      },
      {
        "name": "REG-FAILED",
        "description": "REGISTER failed",
        "throttle": "2 min"
      },
      {
        "name": "REG-BACKUP",
        "description": "REGISTER succeeded, but was handled by a backup server",
        "throttle": "2 min"
      },
      {
        "name": "REG-SUCCESS",
        "description": "REGISTER succeeded",
        "resolves": ["REG-FAILED","REG-BACKUP"],
        "notify": false      
      }

    ], 
    "serviceKeys": [
      "91dfd6f5740c2874d4bc4faea221b14"
    ]
  },
  "log": {
    "file": "/tmp/checker.log",   // => application log file
    "maxsize": 10000000,          // => max size in bytes before archiving
    "maxFiles": 10                // => number of archived files to keep
  }
}
```