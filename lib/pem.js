"use strict";

const pem = require( 'pem' );

class PEM {

	static getFingerprint( cert ) {

		return new Promise( ( resolve, reject ) => {
			pem.getFingerprint( cert, 'sha256', ( err, info ) => {
				if( err ) return reject( err );
				return resolve( info.fingerprint.toLowerCase() );
			} );
		} );

	}

}


module.exports = PEM;
