"use strict";

const events = require( 'events' );
const fs = require( 'fs' );
const jsonGate = require( 'json-gate' );
const mosca = require( 'mosca' );
const pem = require( './pem.js' );


const optionSchema = jsonGate.createSchema( {
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
		advertisements: {
			type: 'array',
			default: []
		}
	},
	additionalProperties: false
} );

const topicRE = /^(hormone\/|definition\/)(.*)$/;

function extractClientInfos( client ) {

	// Return information that may be nice to know
	return {
		clientID: client.id,
		clientIP: client.connection.stream.remoteAddress,
		clientPort: client.connection.stream.remotePort,
		clientCert: client.peerCertificate
	}

}

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

		// Create a store for running advertisements
		this._advertisements = [];

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
				this._decide( this._acIn, client, topic, ( err, decision ) => {

					callback( err, decision );

					// Collect information
					let env = extractClientInfos( client );
					env.pkgTopic = topic,
					env.pkgLength = payload.length;

					// Emit event
					this.emit( ( decision === true ) ? 'inPassed' : 'inRejected', env );

				} );
			};
			server.authorizeForward = ( client, packet, callback ) => {
				this._decide( this._acOut, client, packet.topic, ( err, decision ) => {

					callback( err, decision );

					// Collect information
					let env = extractClientInfos( client );
					env.pkgTopic = packet.topic,
					env.pkgLength = packet.payload.length;

					// Emit event
					this.emit( ( decision === true ) ? 'inPassed' : 'inRejected', env );

				} );
			};

			// Install advertisement
			pem.getFingerprint( fs.readFileSync( options.caPath ) ).then( ( fingerprint ) => {

				// Kick off all advertisements
				options.advertisements.forEach( ( advertisement ) => {

					// Store the handle to stop the advertisement later
					this._advertisements.push( advertisement( fingerprint, options.port ) );

				} );

			} ).then( () => {

				// Resolve server promise
				readyCallback( server );

				this.emit( 'ready', {
					port: options.port,
					keyPath: options.keyPath,
					certPath: options.certPath,
					caPaths: options.caPath
				} );

			} );

		} );

	}

	_decide( decisionMethods, client, topic, callback ) {

		// Read client certificate
		try {
			// If the peer certificate hasn't been fetched yet, obtain information
			if( ! client.peerCertificate ) {
				client.peerCertificate = client.connection.stream.getPeerCertificate();
				if( ! client.peerCertificate ) throw new Error();
				delete client.peerCertificate.raw;
				delete client.peerCertificate.modulus;
				delete client.peerCertificate.exponent;
			}
		} catch( e ) {
			// Something is wrong ... reject!
			return callback( null, false );
		}

		// Is the topic an ES topic?
		let tmp = topicRE.exec( topic );
		let decision;
		if( tmp ) {
			// It's a message related to the ES
			decision = decisionMethods.es( client.peerCertificate, tmp[ 2 ] );
		} else {
			// It's an other message ...
			decision = decisionMethods.other( client.peerCertificate, topic );
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

			// Stop all advertisements
			this._advertisements.forEach( ( stop ) => stop() );

			// Kill server instance
			server.close();

		} );

	}

}

module.exports = EndocrineSystem;
