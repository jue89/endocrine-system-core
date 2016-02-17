"use strict";

let events = require( 'events' );
let fs = require( 'fs' );
let jsonGate = require( 'json-gate' );
let mosca = require( 'mosca' );
let mdns = require( 'mdns' );
let pem = require( './pem.js' );


let optionSchema = jsonGate.createSchema( {
	type: 'object',
	properties: {
		port: {
			type: 'number',
			required: false,
			default: 8883
		},
		certPath: {
			type: 'string',
			required: true
		},
		keyPath: {
			type: 'string',
			required: true
		},
		caPath: {
			type: 'string',
			required: true
		},
		mongo: {
			type: 'object',
			required: true,
			properties: {
				url: {
					type: 'string',
					required: true
				}
			}
		},
		mDNSadvertise: {
			type: 'boolean',
			required: false,
			default: false
		}
	},
	additionalProperties: false
} );

let topicRE = /^(hormone\/|definition\/)(.*)$/;

class EndocrineSystem extends events.EventEmitter {

	constructor( options ) {

		super();

		// Make sure obtions is an object
		if( typeof options != 'object' ) {
			throw new Error( "Options object is missing" );
		}

		// Get access control methods:
		this._acIn = {};
		this._acOut = {};

		if( typeof options.accessControl != 'object' ) options.accessControl = {};

		let ac = options.accessControl;

		// - Publish
		if( typeof ac.in == 'function' ) {
			this._acIn.es = ac.in;
		} else {
			this._acIn.es = () => { return Promise.reject(); };
		}

		// - Publish other topics
		if( typeof ac.inOther == 'function' ) {
			this._acIn.other = ac.inOther;
		} else {
			this._acIn.other = () => { return Promise.reject(); };
		}

		// - Forward
		if( typeof ac.out == 'function' ) {
			this._acOut.es = ac.out;
		} else {
			this._acOut.es = () => { return Promise.reject(); };
		}

		// - Forward other topics
		if( typeof ac.outOther == 'function' ) {
			this._acOut.other = ac.outOther;
		} else {
			this._acOut.other = () => { return Promise.reject(); };
		}

		// - Remove access control stuff
		delete options.accessControl;

		// Schema check the rest of options
		optionSchema.validate( options );

		// Create a new mosca instance
		let server = new mosca.Server( {
			interfaces: [ {
				type: 'mqtts',
				port: options.port,
				credentials: {
					keyPath: options.keyPath,
					certPath: options.certPath,
					caPaths: [ options.caPath ],
					requestCert: true,
					rejectUnauthorized: true
				}
			} ],
			persistence: {
				factory: mosca.persistence.Mongo,
				url: options.mongo.url,
				mongo: options.mongo
			},
			backend: {
				type: 'mongo',
				url: options.mongo.url,
				pubsubCollection: 'ascoltatori',
				mongo: options.mongo
			}
		} );

		// Create promise for server instance
		let readyCallback;
		this._server = new Promise( ( resolve ) => {
			readyCallback = resolve;
		} );

		// Setup mosca
		server.on( 'ready', () => {

			// Install handler for incoming and outgoing packets
			server.authorizePublish = ( client, topic, payload, callback ) => {
				this._decide( this._acIn, client, topic, callback );
			};
			server.authorizeForward = ( client, packet, callback ) => {
				this._decide( this._acOut, client, packet.topic, callback );
			};

			// Shall we advertise this broker via mDNS?
			if( options.mDNSadvertise ) {

				pem.getFingerprint( fs.readFileSync( options.caPath ) ).then( ( fingerprint ) => {

					// Define mDNS advertisement and start advertising
					this._mdns = mdns.createAdvertisement(
						mdns.tcp( 'es-' + fingerprint.replace( /\:/g, '' ).substr( 0, 7 ) ),
						options.port
					);

					this._mdns.start();

				} ).then( () => {

					// Resolve server promise
					readyCallback( server );

					this.emit( 'ready' );

				} );

			} else {

				// Resolve server promise
				readyCallback( server );

				this.emit( 'ready' );

			}

		} );

	}

	_decide( decisionMethods, client, topic, callback ) {

		// Read client certificate
		let clientCert = null;
		try {
			clientCert = client.connection.stream.getPeerCertificate( true );
			if( ! clientCert ) throw new Error();
		} catch( e ) {
			// Something is wrong ... reject!
			return callback( null, false );
		}

		// Is the topic an ES topic?
		let tmp = topicRE.exec( topic );
		let decision;
		if( tmp ) {
			// It's a message related to the ES
			decision = decisionMethods.es( clientCert, tmp[ 2 ] );
		} else {
			// It's an other message ...
			decision = decisionMethods.other( clientCert, topic );
		}

		// No promise -> reject
		if( ! (decision instanceof Promise) ) return callback( null, false );

		// Wait for the decision
		decision.then( () => {
			callback( null, true );
		} ).catch( () => {
			callback( null, false );
		} );

	}

	shutdown() {

		return this._server.then( ( server ) => {
			server.close();
		} );

	}

}

module.exports = EndocrineSystem;
