import { DEFAULTS, MATERIALS, ENVIRONMENTS, QUALITY } from './config.js';

const SECTIONS = [
	{
		title: 'Saved configurations', open: true, controls: [
			{ type: 'library' },
		],
	},
	{
		title: 'Toroid', open: true, controls: [
			{ key: 'ringDiameter', label: 'Ring diameter', min: 6, max: 80, step: 0.1, digits: 1 },
			{ key: 'toroidDiameter', label: 'Toroid diameter', min: 0.4, max: 16, step: 0.05, digits: 2, hint: 'Centre line of each small toroid' },
			{ key: 'tubeThickness', label: 'Tube thickness', min: 0.04, max: 8, step: 0.01, digits: 2 },
			{ key: 'count', label: 'Number of toroids', min: 3, max: 240, step: 1, digits: 0 },
			{ type: 'readout', id: 'geometryReadout' },
		],
	},
	{
		title: 'Arrangement', open: true, controls: [
			{ key: 'tilt', label: 'Tilt', min: - 90, max: 90, step: 0.5, digits: 1, unit: '°' },
			{ key: 'twist', label: 'Twist', min: 0, max: 12, step: 1, digits: 0, unit: ' turns', hint: 'Rotates the tilt direction around the ring' },
			{ key: 'waveHeight', label: 'Wave height', min: 0, max: 16, step: 0.05, digits: 2 },
			{ key: 'waveCount', label: 'Waves', min: 0, max: 12, step: 1, digits: 0 },
		],
	},
	{
		title: 'Material', open: true, controls: [
			{ type: 'swatches', key: 'material' },
			{ type: 'select', key: 'colorMode', label: 'Colour pattern', options: { uniform: 'Uniform', alternate: 'Alternating', gradient: 'Gradient', rainbow: 'Rainbow' } },
			{ type: 'color', key: 'colorA', label: 'Colour' },
			{ type: 'color', key: 'colorB', label: 'Second colour' },
			{ key: 'metalness', label: 'Metalness', min: 0, max: 1, step: 0.01, digits: 2 },
			{ key: 'roughness', label: 'Roughness', min: 0, max: 1, step: 0.01, digits: 2 },
			{ key: 'clearcoat', label: 'Clear coat', min: 0, max: 1, step: 0.01, digits: 2 },
			{ key: 'transmission', label: 'Transmission (glass)', min: 0, max: 1, step: 0.01, digits: 2 },
			{ key: 'iridescence', label: 'Iridescence', min: 0, max: 1, step: 0.01, digits: 2 },
			{ key: 'glow', label: 'Glow', min: 0, max: 10, step: 0.05, digits: 2 },
		],
	},
	{
		title: 'Scene & lighting', open: false, controls: [
			{ type: 'select', key: 'environment', label: 'Environment', options: mapLabels( ENVIRONMENTS ) },
			{ key: 'exposure', label: 'Exposure', min: 0.1, max: 3, step: 0.01, digits: 2 },
			{ key: 'envIntensity', label: 'Environment light', min: 0, max: 3, step: 0.01, digits: 2 },
			{ key: 'lightIntensity', label: 'Key light', min: 0, max: 10, step: 0.05, digits: 2 },
			{ key: 'lightAzimuth', label: 'Light direction', min: 0, max: 360, step: 1, digits: 0, unit: '°' },
			{ key: 'lightElevation', label: 'Light height', min: 1, max: 90, step: 0.5, digits: 1, unit: '°' },
			{ key: 'bloom', label: 'Bloom', min: 0, max: 2, step: 0.01, digits: 2 },
			{ key: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.01, digits: 2 },
			{ type: 'toggles', items: [
				{ key: 'shadows', label: 'Shadows' },
				{ key: 'ground', label: 'Ground' },
				{ key: 'ao', label: 'Ambient occlusion' },
			] },
			{ type: 'select', key: 'toneMapping', label: 'Tone mapping', options: { aces: 'ACES filmic', agx: 'AgX', neutral: 'Neutral' } },
			{ type: 'select', key: 'quality', label: 'Render quality', options: mapLabels( QUALITY ) },
		],
	},
	{
		title: 'Motion & camera', open: false, controls: [
			{ key: 'rideSpeed', label: 'Ride speed', min: 0.2, max: 40, step: 0.1, digits: 1, unit: ' u/s' },
			{ key: 'flowSpeed', label: 'Toroid flow', min: - 20, max: 20, step: 0.1, digits: 1, unit: ' u/s', hint: 'Slides the toroids along the ring' },
			{ key: 'spinSpeed', label: 'Ring spin', min: - 60, max: 60, step: 0.5, digits: 1, unit: '°/s' },
			{ key: 'fov', label: 'Field of view', min: 20, max: 110, step: 1, digits: 0, unit: '°' },
		],
	},
];

function mapLabels( obj ) {

	return Object.fromEntries( Object.entries( obj ).map( ( [ k, v ] ) => [ k, v.label ] ) );

}

function el( tag, attrs = {}, children = [] ) {

	const node = document.createElement( tag );
	for ( const [ k, v ] of Object.entries( attrs ) ) {

		if ( k === 'class' ) node.className = v;
		else if ( k === 'text' ) node.textContent = v;
		else if ( k.startsWith( 'on' ) ) node.addEventListener( k.slice( 2 ), v );
		else node.setAttribute( k, v );

	}

	for ( const c of [].concat( children ) ) if ( c ) node.append( c );
	return node;

}

export class Panel {

	constructor( root, params, onChange ) {

		this.root = root;
		this.params = params;
		this.onChange = onChange;
		this.views = {}; // key -> { set(value) }
		this.ranges = {}; // key -> spec, for limits
		this.onAction = () => {};
		this.build();

	}

	build() {

		const header = el( 'header', { class: 'panel-header' }, [
			el( 'h1', { text: 'Fly Through Toroid' } ),
			el( 'p', { text: 'A ring made of rings. Shape it, dress it, then ride through it.' } ),
		] );

		const body = el( 'div', { class: 'panel-body' } );
		for ( const section of SECTIONS ) body.append( this.buildSection( section ) );

		const footer = el( 'footer', { class: 'panel-footer' }, [
			el( 'button', { class: 'btn', text: 'Randomize', onclick: () => this.onAction( 'randomize' ) } ),
			el( 'button', { class: 'btn', text: 'Copy link', onclick: ( e ) => this.onAction( 'copylink', e.currentTarget ) } ),
			el( 'button', { class: 'btn btn-quiet', text: 'Reset all', onclick: () => this.onAction( 'reset' ) } ),
		] );

		this.root.append( header, body, footer );

	}

	buildSection( section ) {

		const details = el( 'details', { class: 'section' } );
		details.open = section.open;
		details.append( el( 'summary', { text: section.title } ) );
		const content = el( 'div', { class: 'section-content' } );

		for ( const spec of section.controls ) {

			const type = spec.type || 'range';
			if ( type === 'range' ) content.append( this.buildRange( spec ) );
			else if ( type === 'select' ) content.append( this.buildSelect( spec ) );
			else if ( type === 'color' ) content.append( this.buildColor( spec ) );
			else if ( type === 'toggles' ) content.append( this.buildToggles( spec ) );
			else if ( type === 'swatches' ) content.append( this.buildSwatches( spec ) );
			else if ( type === 'library' ) content.append( this.buildLibrary() );
			else if ( type === 'readout' ) {

				const node = el( 'div', { class: 'readout', id: spec.id } );
				this.readout = node;
				content.append( node );

			}

		}

		details.append( content );
		return details;

	}

	buildRange( spec ) {

		const { key } = spec;
		this.ranges[ key ] = spec;

		const input = el( 'input', { type: 'range', min: spec.min, max: spec.max, step: spec.step, 'aria-label': spec.label } );
		const number = el( 'input', { type: 'text', class: 'value', inputmode: 'decimal', 'aria-label': spec.label + ' value' } );
		const unit = el( 'span', { class: 'unit', text: ( spec.unit || '' ).trim() } );

		const paint = ( v ) => {

			const p = ( v - input.min ) / ( input.max - input.min ) * 100;
			input.style.setProperty( '--p', Math.max( 0, Math.min( 100, p ) ) + '%' );

		};

		const show = ( v ) => {

			input.value = v;
			number.value = Number( v ).toFixed( spec.digits );
			paint( v );

		};

		input.addEventListener( 'input', () => {

			const v = Number( input.value );
			number.value = v.toFixed( spec.digits );
			paint( v );
			this.commit( key, v );

		} );

		// Double click resets the slider to its default.
		input.addEventListener( 'dblclick', () => {

			show( DEFAULTS[ key ] );
			this.commit( key, DEFAULTS[ key ] );

		} );

		number.addEventListener( 'change', () => {

			let v = parseFloat( number.value.replace( ',', '.' ) );
			if ( ! Number.isFinite( v ) ) v = this.params[ key ];
			v = Math.min( Number( input.max ), Math.max( Number( input.min ), v ) );
			show( v );
			this.commit( key, v );

		} );

		number.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' ) number.blur();

		} );

		this.views[ key ] = {
			set: show,
			setMax: ( max ) => {

				input.max = max;
				paint( Number( input.value ) );

			},
		};

		const head = el( 'div', { class: 'row-head' }, [
			el( 'label', { text: spec.label, title: spec.hint || '' } ),
			el( 'span', { class: 'value-wrap' }, [ number, unit ] ),
		] );

		return el( 'div', { class: 'control range' }, [ head, input ] );

	}

	buildSelect( spec ) {

		const select = el( 'select', { 'aria-label': spec.label } );
		for ( const [ value, label ] of Object.entries( spec.options ) ) select.append( el( 'option', { value, text: label } ) );
		select.addEventListener( 'change', () => this.commit( spec.key, select.value ) );
		this.views[ spec.key ] = { set: ( v ) => ( select.value = v ) };
		return el( 'div', { class: 'control select' }, [ el( 'label', { text: spec.label } ), select ] );

	}

	buildColor( spec ) {

		const input = el( 'input', { type: 'color', 'aria-label': spec.label } );
		const hex = el( 'span', { class: 'hex' } );
		input.addEventListener( 'input', () => {

			hex.textContent = input.value;
			this.commit( spec.key, input.value );

		} );

		const row = el( 'div', { class: 'control color' }, [ el( 'label', { text: spec.label } ), el( 'span', { class: 'color-wrap' }, [ hex, input ] ) ] );
		this.views[ spec.key ] = {
			set: ( v ) => {

				input.value = v;
				hex.textContent = v;

			},
			setEnabled: ( on ) => row.classList.toggle( 'disabled', ! on ),
		};
		return row;

	}

	buildToggles( spec ) {

		const wrap = el( 'div', { class: 'control toggles' } );
		for ( const item of spec.items ) {

			const input = el( 'input', { type: 'checkbox' } );
			input.addEventListener( 'change', () => this.commit( item.key, input.checked ) );
			this.views[ item.key ] = { set: ( v ) => ( input.checked = v ) };
			wrap.append( el( 'label', { class: 'toggle' }, [ input, el( 'span', { class: 'switch' } ), el( 'span', { text: item.label } ) ] ) );

		}

		return wrap;

	}

	buildSwatches( spec ) {

		const grid = el( 'div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Material preset' } );
		const buttons = {};

		for ( const [ id, preset ] of Object.entries( MATERIALS ) ) {

			const button = el( 'button', { class: 'swatch', role: 'radio', title: preset.label, onclick: () => this.commit( spec.key, id ) }, [
				el( 'span', { class: 'ball', style: `background:${ preset.swatch }` } ),
				el( 'span', { class: 'name', text: preset.label } ),
			] );
			buttons[ id ] = button;
			grid.append( button );

		}

		this.views[ spec.key ] = {
			set: ( v ) => {

				for ( const [ id, b ] of Object.entries( buttons ) ) {

					b.classList.toggle( 'active', id === v );
					b.setAttribute( 'aria-checked', id === v );

				}

			},
		};

		return grid;

	}

	buildLibrary() {

		const input = el( 'input', { type: 'text', class: 'name-input', placeholder: 'Name (optional)', maxlength: 60, 'aria-label': 'Configuration name' } );
		const save = el( 'button', { class: 'btn btn-primary', text: 'Save current' } );
		save.addEventListener( 'click', () => {

			this.onAction( 'save', input.value.trim() );
			input.value = '';

		} );
		input.addEventListener( 'keydown', ( e ) => {

			if ( e.key === 'Enter' ) save.click();

		} );

		const list = el( 'ul', { class: 'saved-list' } );
		const note = el( 'p', { class: 'saved-note' } );
		this.library = { list, note, save };

		return el( 'div', { class: 'control library' }, [ el( 'div', { class: 'save-row' }, [ input, save ] ), list, note ] );

	}

	renderLibrary( entries, available ) {

		const { list, note, save } = this.library;
		list.replaceChildren();
		save.disabled = ! available;

		if ( ! available ) note.textContent = 'This browser blocks local storage, so configurations cannot be saved here.';
		else if ( entries.length === 0 ) note.textContent = 'Nothing saved yet. Saved configurations stay in this browser only.';
		else note.textContent = 'Click a name to load it. Stored in this browser only.';

		for ( const entry of entries ) {

			const p = entry.params || {};
			const meta = [
				MATERIALS[ p.material ]?.label,
				ENVIRONMENTS[ p.environment ]?.label,
				new Date( entry.savedAt ).toLocaleDateString( undefined, { day: 'numeric', month: 'short' } ),
			].filter( Boolean ).join( ' · ' );

			const load = el( 'button', { class: 'saved-load', title: 'Load this configuration', onclick: () => this.onAction( 'load', entry.id ) }, [
				el( 'span', { class: 'saved-name', text: entry.name } ),
				el( 'span', { class: 'saved-meta', text: meta } ),
			] );

			// Two step delete without a browser dialog: the first click arms it.
			const remove = el( 'button', { class: 'saved-delete', title: 'Delete', 'aria-label': `Delete ${ entry.name }` } );
			remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
			let timer = 0;
			remove.addEventListener( 'click', () => {

				if ( remove.classList.contains( 'confirm' ) ) {

					clearTimeout( timer );
					this.onAction( 'delete', entry.id );
					return;

				}

				remove.classList.add( 'confirm' );
				remove.textContent = 'Delete?';
				timer = setTimeout( () => {

					remove.classList.remove( 'confirm' );
					remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

				}, 3000 );

			} );

			list.append( el( 'li', { class: 'saved-item', 'data-id': entry.id }, [ load, remove ] ) );

		}

	}

	flashSaved( message, id ) {

		const { list, save } = this.library;
		save.textContent = message;
		setTimeout( () => ( save.textContent = 'Save current' ), 1300 );
		const item = id && list.querySelector( `[data-id="${ CSS.escape( id ) }"]` );
		if ( item ) {

			item.classList.add( 'flash' );
			setTimeout( () => item.classList.remove( 'flash' ), 1300 );

		}

	}

	commit( key, value ) {

		this.params[ key ] = value;
		this.onChange( key, value );

	}

	set( key, value ) {

		this.params[ key ] = value;
		this.views[ key ]?.set( value );

	}

	syncAll() {

		for ( const [ key, view ] of Object.entries( this.views ) ) view.set( this.params[ key ] );

	}

	setLimit( key, max ) {

		this.views[ key ]?.setMax( max );

	}

	setEnabled( key, on ) {

		this.views[ key ]?.setEnabled?.( on );

	}

	setReadout( html, warn ) {

		this.readout.innerHTML = html;
		this.readout.classList.toggle( 'warn', warn );

	}

}
