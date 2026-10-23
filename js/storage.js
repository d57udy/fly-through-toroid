// Saved configurations live in this browser's localStorage only. Every access
// is guarded: storage can be unavailable (private windows, blocked site data).

const SAVED_KEY = 'flyThroughToroid.saved.v1';
const LAST_KEY = 'flyThroughToroid.last.v1';

function read( key, fallback ) {

	try {

		const raw = localStorage.getItem( key );
		return raw ? JSON.parse( raw ) : fallback;

	} catch {

		return fallback;

	}

}

function write( key, value ) {

	try {

		localStorage.setItem( key, JSON.stringify( value ) );
		return true;

	} catch {

		return false;

	}

}

export function storageAvailable() {

	try {

		const probe = SAVED_KEY + '.probe';
		localStorage.setItem( probe, '1' );
		localStorage.removeItem( probe );
		return true;

	} catch {

		return false;

	}

}

// Newest first.
export function listSaved() {

	const list = read( SAVED_KEY, [] );
	if ( ! Array.isArray( list ) ) return [];
	return list.filter( ( e ) => e && typeof e.id === 'string' && typeof e.name === 'string' && e.params && typeof e.params === 'object' );

}

// Saving under an existing name (ignoring case) replaces that entry.
export function saveConfig( name, params ) {

	const list = listSaved();
	const index = list.findIndex( ( e ) => e.name.toLowerCase() === name.toLowerCase() );
	const entry = {
		id: index >= 0 ? list[ index ].id : Date.now().toString( 36 ) + Math.random().toString( 36 ).slice( 2, 7 ),
		name,
		params: { ...params },
		savedAt: Date.now(),
	};

	if ( index >= 0 ) list.splice( index, 1 );
	list.unshift( entry );
	return { ok: write( SAVED_KEY, list ), replaced: index >= 0, entry };

}

export function deleteConfig( id ) {

	return write( SAVED_KEY, listSaved().filter( ( e ) => e.id !== id ) );

}

export function hasSavedName( name ) {

	return listSaved().some( ( e ) => e.name.toLowerCase() === name.toLowerCase() );

}

// The most recent settings, restored when the page opens without a shared link.
export function loadLast() {

	return read( LAST_KEY, null );

}

export function saveLast( params ) {

	write( LAST_KEY, params );

}

export function isStorageEvent( event ) {

	return event.key === null || event.key === SAVED_KEY;

}
