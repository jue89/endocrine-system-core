# Endocrine System: Edge

This is the Endocrine System Core that connects several [Endocrine System Edges](https://github.com/jue89/endocrine-system-edge) with each other. For a better understanding also check out the Readme of the Egde.

The main tasks of the Core are:

 * Exchanging hormones and definitions
 * Access control

At the moment the core depends on MongoDB for clustering purposes. This shall be improved in later versions.



## Example

While running this example you should start several instances of the [Endocrine System Edge](https://github.com/jue89/endocrine-system-edge).

``` javascript
"use strict";

const mdns = require( 'es-discovery-mdns' );
const ES = require( './lib/es.js' );

let es = new ES( {
  keyPath: 'server.key',
  certPath: 'server.crt',
  caPath: 'ca.crt',
  mongo: { url: 'mongodb://localhost:27017/es' },
  advertisements: [ mdns.advertisement ],
  accessControl: {
    in: ( client, name ) => {
      // The hormone name must match with the CN of the client certificate
      let cn = client.subject.CN;
      if( name.substr( 0, cn.length ) == cn ) return Promise.resolve();
      else return Promise.reject();
    },
    out: ( client, name ) => {
      // All hormones are sent to every connected client
      return Promise.resolve();
    }
  }
} );

es.on( 'inRejected', ( client, topic ) => {
  // Notify that we just rejected someone's published message
  let ip = client.connection.stream.remoteAddress;
  console.error( "Publish rejected from " + ip + " on topic " + topic );
} );
```



## API

The Endocrine System Core system can be required as follows. The API description refers to ES.
``` javascript
const ES = require( 'es-core' );
```

### Endocrine System Core

``` javascript
let es = ES( options );
```

Offers a broker for [Endocrine System Edge](https://github.com/jue89/endocrine-system-edge) and returns a broker handle.

```options``` can be:
 * ```certPath```: Path to the PEM client certificate.
 * ```keyPath```: Path to the PEM client key.
 * ```caPath```: Path to the PEM certificate authority that signed the client certificate.
 * ```port```: (optional) Port to listen on. Default: 8883.
 * ```advertisements```: (optional) Array of advertisement services. They will make the Core discoverable.
 * ```mongo```: MongoDB configuration:
   * ```url```: URL to the MongoDB server.
 * ```accessControl```: Callback functions for deciding whether or not a message shall pass. If not specified the core will reject by default.
   * ```in```: Callback method called for every incoming hormone. Interface: ```( cert, hormoneName ) => {}``` expecting a promise.
   * ```out```: Callback method called for every outgoing hormone. Interface: ```( cert, hormoneName ) => {}``` expecting a promise.
   * ```inOther```: Callback method called for every MQTT message not related to the endocrine system. Interface: ```( cert, topic ) => {}``` expecting a promise.
   * ```outOther```: Callback method called for every MQTT message not related to the endocrine system. Interface: ```( cert, topic ) => {}``` expecting a promise.


### Class: Endocrine System Core

The connection handle ```es``` offers some events and methods:


#### Event: ready

``` javascript
es.on( 'ready', () => { ... } );
```

Emitted when the server is able to accept incoming connections.


#### Event: inRejected

``` javascript
es.on( 'inRejected', ( client, topic ) => { ... } );
```

Emitted if an incoming message is rejected.


#### Event: outRejected

``` javascript
es.on( 'outRejected', ( client, topic ) => { ... } );
```

Emitted if an outgoing message is rejected.


#### Event: inPassed

``` javascript
es.on( 'inPassed', ( client, topic ) => { ... } );
```

Emitted if an incoming message passed.


#### Event: outPassed

``` javascript
es.on( 'outPassed', ( client, topic ) => { ... } );
```

Emitted if an outgoing message passed.


#### Method: shutdown

``` javascript
es.shutdown();
```

Shuts down the endorcine system. A promise is returned, that will be resolved if the system has been successfully shut down.
