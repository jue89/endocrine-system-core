"use strict";

let assert = require( 'assert' );


describe( "Class EndocrineSystem", function() {

	let EndocrineSystem;

	before( ( done ) => {

		EndocrineSystem = require( '../lib/es.js' );

	} );

	it( "should complain missing cert / key / CA", ( done ) => {

	} );

	it( "should complain unsuccessful backend connection", ( done ) => {

	} );

	it( "should reject connection attemps without client certificate", ( done ) => {

	} );

	it( "should reject connection attemps with client certificates signed by the wrong CA", ( done ) => {

	} );

	it( "should reject any publish / forward if no access control is defined", ( done ) => {

	} );

	it( "should reject published hormone / definition if access control rejects", ( done ) => {

	} );

	it( "should reject other published messages if access control rejects", ( done ) => {

	} );

	it( "should accept hormone / definition bot should not forward it if access control rejects", ( done ) => {

	} );

	it( "should accept other messages bot should not forward them if access control rejects", ( done ) => {

	} );

	it( "should forward hormone / definition if access control allows", ( done ) => {

	} );

	it( "should forward other messages if access control allows", ( done ) => {

	} );

	it( "should not forward retained messages if access control rejects", ( done ) => {

	} );

	it( "should forward retained messages if access control allows", ( done ) => {

	} );

	it( "should forward retained messages even if the endocrine system has been restartet", ( done ) => {

	} );

} );
