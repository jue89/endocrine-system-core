"use strict";

let assert = require( 'assert' );


describe( "Class EndocrineSystem", function() {

	let EndocrineSystem;
	let mqtt;
	let pki;

	before( ( done ) => {

		let rfs = require( 'fs' ).readFileSync;

		// Dependencies
		mqtt = require( 'mqtt' );
		pki = {
			ca: rfs( './test/pki/ca.crt' ),
			clientCert: rfs( './test/pki/client.crt' ),
			clientKey: rfs( './test/pki/client.key' ),
			clientCertOtherCA: rfs( './test/pki/client_otherca.crt' ),
			clientKeyOtherCA: rfs( './test/pki/client_otherca.key' )
		};

		EndocrineSystem = require( '../lib/es.js' );

		done();

	} );

	it( "should complain missing cert / key / CA", ( done ) => {

		try {
			let es = new EndocrineSystem( {} );
		} catch( e ) { /*console.log(e);*/ done(); }

	} );

	it( "should reject connection attemps with client certificates signed by the wrong CA", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55500,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55500', {
				cert: pki.clientCertOtherCA,
				key: pki.clientKeyOtherCA,
				ca: pki.ca
			} );

			client.once( 'error', () => {
				client.end( () => {
					es.shutdown().then( () => done() );
				} );
			} );

		} );

	} );

	it( "should reject any publish / forward if no access control is defined", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55501,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55501', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				// The publish will cause the connection to be closed
				client.publish( 'test', "Hallo" );
			} );

			client.once( 'close', () => {
				client.end( () => {
					es.shutdown().then( () => done() );
				} );
			} );

		} );

	} );

	it( "should reject published hormone / definition if access control rejects", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55502,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			},
			accessControl: {
				in: ( client, name ) => {
					return Promise.reject();
				},
				inOther: ( client, name ) => {
					return Promise.resolve();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55502', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				// The publish will cause the connection to be closed
				client.publish( 'definition/test', "Hallo" );
			} );

			client.once( 'close', () => {
				client.end( () => {
					es.shutdown().then( () => done() );
				} );
			} );

		} );

	} );

	it( "should reject other published messages if access control rejects", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55503,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			},
			accessControl: {
				inOther: ( client, name ) => {
					return Promise.reject();
				},
				in: ( client, name ) => {
					return Promise.resolve();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55503', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				// The publish will cause the connection to be closed
				client.publish( 'test', "Hallo" );
			} );

			client.once( 'close', () => {
				client.end( () => {
					es.shutdown().then( () => done() );
				} );
			} );

		} );

	} );

	it( "should accept hormone / definition bot should not forward it if access control rejects", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55504,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			},
			accessControl: {
				inOther: ( client, name ) => {
					return Promise.resolve();
				},
				in: ( client, name ) => {
					return Promise.resolve();
				},
				outOther: ( client, name ) => {
					return Promise.resolve();
				},
				out: ( client, name ) => {
					return Promise.reject();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55504', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				client.subscribe( '#' );
				client.publish( 'definition/test', "Hallo" );
				client.publish( 'hormone/test', "Hallo" );

				// After 200ms we can be sure that everything is okay
				setTimeout( () => client.end( () => {
					es.shutdown().then( () => done() );
				} ), 200 );
			} );

			client.once( 'message', () => { done( "This should not happen!" ); } );

		} );

	} );

	it( "should accept other messages bot should not forward them if access control rejects", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55505,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			},
			accessControl: {
				inOther: ( client, name ) => {
					return Promise.resolve();
				},
				in: ( client, name ) => {
					return Promise.resolve();
				},
				outOther: ( client, name ) => {
					return Promise.reject();
				},
				out: ( client, name ) => {
					return Promise.resolve();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55505', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				client.subscribe( '#' );
				client.publish( 'test', "Hallo" );

				// After 200ms we can be sure that everything is okay
				setTimeout( () => client.end( () => {
					es.shutdown().then( () => done() );
				} ), 200 );
			} );

			client.once( 'message', () => { done( "This should not happen!" ); } );

		} );

	} );

	it( "should forward hormone / definition if access control allows", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55506,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			},
			accessControl: {
				inOther: ( client, name ) => {
					return Promise.resolve();
				},
				in: ( client, name ) => {
					return Promise.resolve();
				},
				outOther: ( client, name ) => {
					return Promise.reject();
				},
				out: ( client, name ) => {
					return Promise.resolve();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55506', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				client.subscribe( '#' );
				client.publish( 'definition/test', "Hallo" );
			} );

			client.once( 'message', () => client.end( () => {
				es.shutdown().then( () => done() );
			} ) );

		} );

	} );

	it( "should forward other messages if access control allows", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55507,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			},
			accessControl: {
				inOther: ( client, name ) => {
					return Promise.resolve();
				},
				in: ( client, name ) => {
					return Promise.resolve();
				},
				outOther: ( client, name ) => {
					return Promise.resolve();
				},
				out: ( client, name ) => {
					return Promise.reject();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55507', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				client.subscribe( '#' );
				client.publish( 'test', "Hallo" );
			} );

			client.once( 'message', () => client.end( () => {
				es.shutdown().then( () => done() );
			} ) );

		} );

	} );

	it( "should not forward retained messages if access control rejects", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55508,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			},
			accessControl: {
				inOther: ( client, name ) => {
					return Promise.resolve();
				},
				in: ( client, name ) => {
					return Promise.resolve();
				},
				outOther: ( client, name ) => {
					return Promise.reject();
				},
				out: ( client, name ) => {
					return Promise.resolve();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55508', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				// Create retain message
				client.publish( 'test', "Hallo", { retain: true } );

				// Close connection and reconnect
				client.end( () => {

					client = mqtt.connect( 'mqtts://localhost:55508', {
						cert: pki.clientCert,
						key: pki.clientKey,
						ca: pki.ca
					} );

					client.once( 'connect', () => {

						client.subscribe( '#' );

						client.once( 'message', () => { done( "This should not happen!" ); } );

						// After 200ms we can be sure that everything is okay
						setTimeout( () => client.end( () => {
							es.shutdown().then( () => done() );
						} ), 200 );

					} );

				} );
			} );

		} );

	} );

	it( "should forward retained messages if access control allows", ( done ) => {

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55509,
			mongo: {
				url: 'mongodb://localhost:27017/es-test-' + Date.now().toString()
			},
			accessControl: {
				inOther: ( client, name ) => {
					return Promise.resolve();
				},
				in: ( client, name ) => {
					return Promise.resolve();
				},
				outOther: ( client, name ) => {
					return Promise.resolve();
				},
				out: ( client, name ) => {
					return Promise.reject();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55509', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				// Create retain message
				client.publish( 'test', "Hallo", { retain: true } );

				// Close connection and reconnect
				client.end( () => {

					client = mqtt.connect( 'mqtts://localhost:55509', {
						cert: pki.clientCert,
						key: pki.clientKey,
						ca: pki.ca
					} );

					client.once( 'connect', () => {

						client.once( 'message', () => client.end( () => {
							es.shutdown().then( () => done() );
						} ) );

						client.subscribe( '#' );

					} );

				} );
			} );

		} );

	} );

	it( "should forward retained messages even if the endocrine system has been restartet", ( done ) => {

		let db = 'mongodb://localhost:27017/es-test-' + Date.now().toString();

		let es = new EndocrineSystem( {
			certPath: './test/pki/server.crt',
			keyPath: './test/pki/server.key',
			caPath: './test/pki/ca.crt',
			port: 55510,
			mongo: {
				url: db
			},
			accessControl: {
				inOther: ( client, name ) => {
					return Promise.resolve();
				},
				in: ( client, name ) => {
					return Promise.resolve();
				},
				outOther: ( client, name ) => {
					return Promise.resolve();
				},
				out: ( client, name ) => {
					return Promise.reject();
				}
			}
		} );

		es.on( 'ready', () => {

			let client = mqtt.connect( 'mqtts://localhost:55510', {
				cert: pki.clientCert,
				key: pki.clientKey,
				ca: pki.ca
			} );

			client.once( 'connect', () => {
				// Create retain message
				client.publish( 'test', "Hallo", { retain: true } );

				// Close connection and reconnect
				client.end( () => {

					es.shutdown();

					es = new EndocrineSystem( {
						certPath: './test/pki/server.crt',
						keyPath: './test/pki/server.key',
						caPath: './test/pki/ca.crt',
						port: 55511,
						mongo: {
							url: db
						},
						accessControl: {
							inOther: ( client, name ) => {
								return Promise.resolve();
							},
							in: ( client, name ) => {
								return Promise.resolve();
							},
							outOther: ( client, name ) => {
								return Promise.resolve();
							},
							out: ( client, name ) => {
								return Promise.reject();
							}
						}
					} );

					es.on( 'ready', () => {

						client = mqtt.connect( 'mqtts://localhost:55511', {
							cert: pki.clientCert,
							key: pki.clientKey,
							ca: pki.ca
						} );

						client.once( 'connect', () => {

							client.once( 'message', () => client.end( () => {
								es.shutdown().then( () => done() );
							} ) );

							client.subscribe( '#' );

						} );

					} );

				} );
			} );

		} );

	} );

} );
