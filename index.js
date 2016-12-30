"use strict";

const EndocrineSystem = require( './lib/es.js' );

module.exports = function( options ) {
	return new EndocrineSystem( options );
};

// Table of all events that might be emitted by Core instances.
// Format: each event has its own translation function, that outputs a (mostly)
// human-readable message (I'm not a Goethe, sry!) and an object representing
// the environment in that the event occured.
module.exports.eventTable = {
	'ready': ( env ) => [ 'notice', `Listening to port ${env.port}`, env ],
	'stats': ( env ) => [ 'notice', `Stats: ${env.messagesIn} ingress messages (${env.bytesIn}B); ${env.messagesOut} outgress messages (${env.bytesOut}B)`, env ],
	'inPassed': ( env ) => [ 'debug', `Granted ingress message on topic ${env.pkgTopic} from ${env.clientID} (IP: ${env.clientIP})`, env ],
	'inRejected': ( env ) => [ 'notice', `Rejected ingress message on topic ${env.pkgTopic} from ${env.clientID} (IP: ${env.clientIP})`, env ],
	'outPassed': ( env ) => [ 'debug', `Granted outgress message on topic ${env.pkgTopic} from ${env.clientID} (IP: ${env.clientIP})`, env ],
	'outRejected': ( env ) => [ 'notice', `Rejected outgress message on topic ${env.pkgTopic} from ${env.clientID} (IP: ${env.clientIP})`, env ]
};
