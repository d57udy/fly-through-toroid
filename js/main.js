import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { DEFAULTS, HIDDEN_MATERIAL_DEFAULTS, MATERIALS, ENVIRONMENTS, QUALITY, sanitizeParams } from './config.js';
import { ToroidRing } from './toroid.js';
import { Environments } from './environments.js';
import { CameraRig } from './camera.js';
import { Panel } from './ui.js';
import * as storage from './storage.js';

const DEG = Math.PI / 180;

const app = document.getElementById( 'app' );
const viewport = document.getElementById( 'viewport' );
const canvas = document.getElementById( 'scene' );

// A shared link wins; otherwise reopen the settings from the last visit.
const fromHash = readHash();
const params = { ...DEFAULTS, ...( Object.keys( fromHash ).length ? fromHash : sanitizeParams( storage.loadLast() ) ) };

// ---------------------------------------------------------------- renderer

let renderer;
try {

	renderer = new THREE.WebGLRenderer( { canvas, antialias: false, powerPreference: 'high-performance' } );

} catch ( err ) {

	document.getElementById( 'fallback' ).hidden = false;
	throw err;

}

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // updated once per frame, not again by the AO pass

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( params.fov, 1, 0.02, 2000 );

// ---------------------------------------------------------------- toroid material

const material = new THREE.MeshPhysicalMaterial( { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 } );

// Tint the emissive glow with the per-instance colour as well, so the colour
// pattern also applies to glowing materials.
material.onBeforeCompile = ( shader ) => {

	shader.fragmentShader = shader.fragmentShader.replace(
		'#include <emissivemap_fragment>',
		'#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif'
	);

};

const ring = new ToroidRing( material );
scene.add( ring.group );

// ---------------------------------------------------------------- ground

// The ground is opaque (so glass refracts it) and blends into the backdrop
// colour seen in the same direction, which hides its edge.
const groundFade = {
	fadeUseEnv: { value: 0 },
	fadeTop: { value: new THREE.Color() },
	fadeHorizon: { value: new THREE.Color() },
	fadeBottom: { value: new THREE.Color() },
	fadeInner: { value: 20 },
	fadeOuter: { value: 80 },
};

const groundMaterial = new THREE.MeshStandardMaterial( { color: 0x2a2d34, roughness: 0.5 } );
groundMaterial.onBeforeCompile = ( shader ) => {

	Object.assign( shader.uniforms, groundFade );
	shader.vertexShader = shader.vertexShader
		.replace( '#include <common>', '#include <common>\nvarying vec3 vGroundWorld;' )
		.replace( '#include <fog_vertex>', '#include <fog_vertex>\nvGroundWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;' );
	shader.fragmentShader = shader.fragmentShader
		.replace( '#include <common>', /* glsl */`#include <common>
			varying vec3 vGroundWorld;
			uniform float fadeUseEnv;
			uniform vec3 fadeTop;
			uniform vec3 fadeHorizon;
			uniform vec3 fadeBottom;
			uniform float fadeInner;
			uniform float fadeOuter;` )
		.replace( '#include <dithering_fragment>', /* glsl */`#include <dithering_fragment>
			{
				vec3 dir = normalize( vGroundWorld - cameraPosition );
				vec3 backdrop = dir.y > 0.0
					? mix( fadeHorizon, fadeTop, pow( dir.y, 0.55 ) )
					: mix( fadeHorizon, fadeBottom, pow( - dir.y, 0.45 ) );
				#ifdef ENVMAP_TYPE_CUBE_UV
					if ( fadeUseEnv > 0.5 ) backdrop = textureCubeUV( envMap, dir, 0.0 ).rgb;
				#endif
				float f = smoothstep( fadeInner, fadeOuter, length( vGroundWorld.xz ) );
				gl_FragColor.rgb = mix( gl_FragColor.rgb, backdrop, f );
			}` );

};

const ground = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), groundMaterial );
ground.rotation.x = - Math.PI / 2;
ground.receiveShadow = true;
scene.add( ground );

const GROUND_LOOK = {
	studio: { color: '#1f2228', roughness: 0.45 },
	white: { color: '#c9ccd2', roughness: 0.8 },
	sunset: { color: '#5b4c41', roughness: 0.95 },
	space: { color: '#16171d', roughness: 0.35 },
};

// ---------------------------------------------------------------- light

const sun = new THREE.DirectionalLight( 0xffffff, params.lightIntensity );
sun.castShadow = true;
sun.shadow.bias = - 0.0001;
scene.add( sun, sun.target );

// ---------------------------------------------------------------- environments

const environments = new Environments( renderer, scene );
let skyDirty = false;

// ---------------------------------------------------------------- post-processing

const composerTarget = new THREE.WebGLRenderTarget( 1, 1, { type: THREE.HalfFloatType, samples: 4 } );
const composer = new EffectComposer( renderer, composerTarget );

const renderPass = new RenderPass( scene, camera );
const aoPass = new GTAOPass( scene, camera, 1, 1 );
aoPass.output = GTAOPass.OUTPUT.Default;
aoPass.blendIntensity = 1;

// Background domes should not take part in ambient occlusion.
const baseOverride = aoPass.overrideVisibility.bind( aoPass );
aoPass.overrideVisibility = () => {

	baseOverride();
	scene.traverse( ( o ) => {

		if ( o.userData.skipAO ) o.visible = false;

	} );

};

const bloomPass = new UnrealBloomPass( new THREE.Vector2( 1, 1 ), params.bloom, 0.45, 0.9 );
const outputPass = new OutputPass();
const finishPass = new ShaderPass( {
	uniforms: { tDiffuse: { value: null }, vignette: { value: params.vignette } },
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }
	`,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse;
		uniform float vignette;
		varying vec2 vUv;
		void main() {
			vec4 c = texture2D( tDiffuse, vUv );
			float r = length( vUv - 0.5 ) * 1.41421;
			c.rgb *= 1.0 - vignette * 0.85 * smoothstep( 0.25, 1.1, r );
			// Dither to avoid banding in dark gradients.
			float n = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
			c.rgb += ( n - 0.5 ) / 255.0;
			gl_FragColor = c;
		}
	`,
} );

composer.addPass( renderPass );
composer.addPass( aoPass );
composer.addPass( bloomPass );
composer.addPass( outputPass );
composer.addPass( finishPass );

// ---------------------------------------------------------------- camera rig

const rig = new CameraRig( camera, canvas, ring );

// ---------------------------------------------------------------- apply parameters

let geometryKey = '';

function quality() {

	return QUALITY[ params.quality ] || QUALITY.high;

}

function updateGeometry() {

	const q = quality();
	const R = params.ringDiameter / 2;
	const r = params.toroidDiameter / 2;
	const t = Math.min( params.tubeThickness / 2, r );

	const key = [ r, t, q.radial, q.tubular ].join( '|' );
	if ( key !== geometryKey ) {

		ring.setGeometry( r, t, q.radial, q.tubular );
		geometryKey = key;

	}

	ring.setLayout( {
		R,
		count: Math.round( params.count ),
		tilt: params.tilt,
		twist: Math.round( params.twist ),
		waveHeight: params.waveHeight,
		waveCount: Math.round( params.waveCount ),
	} );
	ring.updateInstances();
	ring.updateColors( params.colorMode, params.colorA, params.colorB );

	updateBounds();
	updateMaterial(); // glass thickness follows the tube size
	updateReadout();

}

function updateBounds() {

	const extent = ring.extent();
	const cam = sun.shadow.camera;
	cam.left = cam.bottom = - extent * 1.05;
	cam.right = cam.top = extent * 1.05;
	cam.near = extent * 0.5;
	cam.far = extent * 5;
	cam.updateProjectionMatrix();
	sun.shadow.normalBias = 3 * ( 2 * extent / sun.shadow.mapSize.x );
	updateLightDirection();

	ground.position.y = ring.lowestPoint() - ( 0.6 * ( ring.r + ring.t ) + 0.04 * ring.R );
	ground.scale.setScalar( extent * 12 );
	groundFade.fadeInner.value = extent * 1.6;
	groundFade.fadeOuter.value = extent * 5.5;

	rig.orbit.maxDistance = extent * 10;
	rig.orbit.minDistance = 0.05;

	const aoRadius = THREE.MathUtils.clamp( ( ring.r + ring.t ) * 0.6, 0.15, 8 );
	aoPass.updateGtaoMaterial( { radius: aoRadius, distanceExponent: 1, thickness: aoRadius, scale: 1, samples: quality().aoSamples } );

}

function updateReadout() {

	const hole = 2 * ( ring.r - ring.t );
	const outer = 2 * ( ring.r + ring.t );
	const gap = ring.gap();
	const fmt = ( v ) => v.toFixed( 2 );
	let html = `<span>Hole Ø <b>${ fmt( Math.max( 0, hole ) ) }</b></span><span>Outer Ø <b>${ fmt( outer ) }</b></span><span>Gap <b>${ fmt( gap ) }</b></span>`;
	const warn = gap < 0 || hole <= 0.001;
	if ( gap < 0 ) html += '<em>Neighbouring toroids overlap. Lower the count or the thickness.</em>';
	else if ( hole <= 0.001 ) html += '<em>The hole is closed. Make the tube thinner to fly through.</em>';
	panel.setReadout( html, warn );

}

function presetValues() {

	return { ...HIDDEN_MATERIAL_DEFAULTS, ...MATERIALS[ params.material ] };

}

function updateMaterial() {

	const p = presetValues();
	const tubeDiameter = 2 * ring.t;

	material.color.setScalar( p.diffuseScale );
	material.metalness = params.metalness;
	material.roughness = params.roughness;
	material.clearcoat = params.clearcoat;
	material.clearcoatRoughness = p.clearcoatRoughness;
	material.transmission = params.transmission;
	material.ior = p.ior;
	material.dispersion = params.transmission > 0 ? p.dispersion : 0;
	material.thickness = tubeDiameter;
	material.attenuationColor.set( p.attenuationColor );
	material.attenuationDistance = p.attenuationScale > 0 ? p.attenuationScale * tubeDiameter : Infinity;
	material.iridescence = params.iridescence;
	material.iridescenceIOR = p.iridescenceIOR;
	material.iridescenceThicknessRange = [ 120, 620 ];
	material.sheen = p.sheen;
	material.sheenColor.set( p.sheenColor );
	material.sheenRoughness = 0.45;
	material.emissiveIntensity = params.glow;

	// Opaque shadows from clear glass look wrong; let AO ground it instead.
	ring.mesh.castShadow = params.transmission < 0.5;

}

function applyPreset( id ) {

	const preset = MATERIALS[ id ];
	for ( const key of [ 'colorA', 'colorB', 'metalness', 'roughness', 'clearcoat', 'transmission', 'iridescence', 'glow' ] ) {

		panel.set( key, preset[ key ] );

	}

	updateMaterial();
	updateColors();

}

function updateColors() {

	ring.updateColors( params.colorMode, params.colorA, params.colorB );
	panel.setEnabled( 'colorB', params.colorMode === 'alternate' || params.colorMode === 'gradient' );

}

function lightDirection() {

	const az = params.lightAzimuth * DEG, el = params.lightElevation * DEG;
	return new THREE.Vector3( Math.cos( el ) * Math.sin( az ), Math.sin( el ), Math.cos( el ) * Math.cos( az ) );

}

function updateLightDirection() {

	const dir = lightDirection();
	sun.position.copy( dir ).multiplyScalar( ring.extent() * 2.5 );

	if ( params.environment === 'sunset' ) {

		// Low sun is warm and dimmer, high sun is close to white.
		const k = THREE.MathUtils.smoothstep( params.lightElevation, 0, 35 );
		sun.color.set( '#ff8a3d' ).lerp( new THREE.Color( '#fff3e2' ), k );

	} else if ( params.environment === 'space' ) sun.color.set( '#d4e2ff' );
	else sun.color.set( '#ffffff' );

	// The sky model (and its lighting map, when active) is refreshed once per frame at most.
	skyDirty = true;

}

function updateScene() {

	renderer.toneMappingExposure = params.exposure;
	renderer.toneMapping = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping }[ params.toneMapping ];
	scene.environmentIntensity = params.envIntensity;
	sun.intensity = params.lightIntensity;
	sun.castShadow = params.shadows;
	ground.visible = params.ground;
	aoPass.enabled = params.ao;
	bloomPass.strength = params.bloom;
	// Bloom runs before exposure is applied; keep the threshold relative to what is shown.
	bloomPass.threshold = 0.9 / params.exposure;
	bloomPass.enabled = params.bloom > 0;
	finishPass.uniforms.vignette.value = params.vignette;

}

function updateEnvironment() {

	environments.sunDir.copy( lightDirection() );
	environments.set( params.environment );
	const look = GROUND_LOOK[ params.environment ];
	groundMaterial.color.set( look.color );
	groundMaterial.roughness = look.roughness;

	const fade = environments.fadeTarget( params.environment );
	groundFade.fadeUseEnv.value = fade.useEnvMap ? 1 : 0;
	if ( fade.colors ) {

		groundFade.fadeTop.value.set( fade.colors[ 0 ] );
		groundFade.fadeHorizon.value.set( fade.colors[ 1 ] );
		groundFade.fadeBottom.value.set( fade.colors[ 2 ] );

	}
	updateLightDirection();

}

function applyEnvironmentDefaults() {

	const env = ENVIRONMENTS[ params.environment ];
	for ( const key of [ 'exposure', 'envIntensity', 'lightIntensity', 'lightAzimuth', 'lightElevation', 'ground' ] ) panel.set( key, env[ key ] );

}

function updateQuality() {

	const q = quality();
	const pr = Math.min( window.devicePixelRatio || 1, q.pixelRatio );
	renderer.setPixelRatio( pr );
	composer.setPixelRatio( pr );

	if ( sun.shadow.mapSize.x !== q.shadowMap ) {

		sun.shadow.mapSize.set( q.shadowMap, q.shadowMap );
		if ( sun.shadow.map ) {

			sun.shadow.map.dispose();
			sun.shadow.map = null;

		}

	}

	resize();
	updateGeometry();

}

function updateCamera() {

	camera.fov = params.fov;
	camera.updateProjectionMatrix();
	rig.rideSpeed = params.rideSpeed;

}

function applyAll() {

	panel.setLimit( 'tubeThickness', params.toroidDiameter );
	updateEnvironment();
	updateScene();
	updateCamera();
	updateQuality(); // also rebuilds geometry, bounds and material
	updateColors();

}

// ---------------------------------------------------------------- panel

const panel = new Panel( document.getElementById( 'panel' ), params, onParamChange );

const GEOMETRY_KEYS = new Set( [ 'ringDiameter', 'toroidDiameter', 'tubeThickness', 'count', 'tilt', 'twist', 'waveHeight', 'waveCount' ] );
const MATERIAL_KEYS = new Set( [ 'metalness', 'roughness', 'clearcoat', 'transmission', 'iridescence', 'glow' ] );
const SCENE_KEYS = new Set( [ 'exposure', 'envIntensity', 'lightIntensity', 'bloom', 'vignette', 'shadows', 'ground', 'ao', 'toneMapping' ] );

function onParamChange( key ) {

	if ( key === 'toroidDiameter' ) {

		panel.setLimit( 'tubeThickness', params.toroidDiameter );
		if ( params.tubeThickness > params.toroidDiameter ) panel.set( 'tubeThickness', params.toroidDiameter );

	}

	if ( GEOMETRY_KEYS.has( key ) ) updateGeometry();
	else if ( MATERIAL_KEYS.has( key ) ) updateMaterial();
	else if ( key === 'material' ) {

		panel.set( 'material', params.material );
		applyPreset( params.material );

	} else if ( key === 'colorMode' || key === 'colorA' || key === 'colorB' ) updateColors();
	else if ( SCENE_KEYS.has( key ) ) updateScene();
	else if ( key === 'lightAzimuth' || key === 'lightElevation' ) updateLightDirection();
	else if ( key === 'environment' ) {

		applyEnvironmentDefaults();
		updateEnvironment();
		updateScene();

	} else if ( key === 'quality' ) updateQuality();
	else if ( key === 'rideSpeed' || key === 'fov' ) updateCamera();

	scheduleHashWrite();

}

// arg: the clicked button (copylink), a name (save) or a saved entry id (load, delete).
panel.onAction = ( action, arg ) => {

	if ( action === 'reset' ) {

		Object.assign( params, DEFAULTS );
		panel.syncAll();
		applyAll();
		rig.resetView();
		scheduleHashWrite();

	} else if ( action === 'randomize' ) {

		randomize();
		scheduleHashWrite();

	} else if ( action === 'copylink' ) {

		writeHash();
		navigator.clipboard?.writeText( location.href ).then( () => {

			const text = arg.textContent;
			arg.textContent = 'Copied';
			setTimeout( () => ( arg.textContent = text ), 1200 );

		} );

	} else if ( action === 'save' ) {

		const result = storage.saveConfig( arg || autoName(), { ...params } );
		refreshLibrary();
		panel.flashSaved( result.ok ? ( result.replaced ? 'Updated' : 'Saved' ) : 'Not saved', result.ok ? result.entry.id : null );

	} else if ( action === 'load' ) {

		const entry = storage.listSaved().find( ( e ) => e.id === arg );
		if ( ! entry ) return refreshLibrary();
		Object.assign( params, DEFAULTS, sanitizeParams( entry.params ) );
		panel.syncAll();
		applyAll();
		if ( rig.mode === 'orbit' ) rig.resetView();
		scheduleHashWrite();

	} else if ( action === 'delete' ) {

		storage.deleteConfig( arg );
		refreshLibrary();

	}

};

// Default name for a save, e.g. "Copper, Dark studio" (numbered if taken).
function autoName() {

	const base = `${ MATERIALS[ params.material ].label }, ${ ENVIRONMENTS[ params.environment ].label }`;
	let name = base;
	for ( let i = 2; storage.hasSavedName( name ); i ++ ) name = `${ base } ${ i }`;
	return name;

}

function refreshLibrary() {

	panel.renderLibrary( storage.listSaved(), storage.storageAvailable() );

}

// Keep the list in sync when another tab saves or deletes.
window.addEventListener( 'storage', ( e ) => {

	if ( storage.isStorageEvent( e ) ) refreshLibrary();

} );

function randomize() {

	const rand = ( a, b ) => a + Math.random() * ( b - a );
	const pick = ( list ) => list[ Math.floor( Math.random() * list.length ) ];
	const round = ( v, step ) => Math.round( v / step ) * step;

	const ringDiameter = round( rand( 14, 44 ), 0.1 );
	const toroidDiameter = round( rand( 1.6, Math.min( 9, ringDiameter * 0.3 ) ), 0.05 );
	const tubeThickness = round( toroidDiameter * rand( 0.06, 0.32 ), 0.01 );
	const tilt = Math.random() < 0.55 ? 0 : round( rand( 12, 65 ) * pick( [ - 1, 1 ] ), 0.5 );
	const waveHeight = Math.random() < 0.6 ? 0 : round( rand( 0.5, ringDiameter * 0.12 ), 0.05 );

	const set = {
		ringDiameter, toroidDiameter, tubeThickness, tilt, waveHeight,
		twist: tilt !== 0 && Math.random() < 0.6 ? Math.floor( rand( 1, 6 ) ) : 0,
		waveCount: Math.floor( rand( 2, 7 ) ),
		colorMode: pick( [ 'uniform', 'uniform', 'alternate', 'gradient', 'rainbow' ] ),
	};

	// Choose a count that leaves a positive gap between toroids.
	const R = ringDiameter / 2, r = toroidDiameter / 2, t = tubeThickness / 2;
	const footprint = 2 * ( r * Math.abs( Math.sin( tilt * DEG ) ) + t );
	const maxCount = Math.max( 6, Math.floor( Math.PI * 2 * R / ( footprint * 1.25 ) ) );
	set.count = Math.floor( rand( Math.min( 16, maxCount ), Math.min( maxCount, 140 ) ) );

	panel.set( 'material', pick( Object.keys( MATERIALS ) ) );
	applyPreset( params.material );
	for ( const [ k, v ] of Object.entries( set ) ) panel.set( k, v );
	if ( set.colorMode !== 'uniform' && params.metalness < 1 && params.transmission === 0 ) {

		panel.set( 'colorA', randomColor() );
		panel.set( 'colorB', randomColor() );

	}

	panel.setLimit( 'tubeThickness', params.toroidDiameter );
	updateGeometry();
	updateColors();
	if ( rig.mode === 'orbit' ) rig.resetView();

}

function randomColor() {

	return '#' + new THREE.Color().setHSL( Math.random(), 0.65, 0.55, THREE.SRGBColorSpace ).getHexString( THREE.SRGBColorSpace );

}

// ---------------------------------------------------------------- shareable URL

function readHash() {

	return sanitizeParams( Object.fromEntries( new URLSearchParams( location.hash.slice( 1 ) ) ) );

}

function writeHash() {

	const search = new URLSearchParams();
	for ( const [ key, def ] of Object.entries( DEFAULTS ) ) {

		const v = params[ key ];
		if ( v === def ) continue;
		search.set( key, typeof v === 'boolean' ? ( v ? '1' : '0' ) : String( v ) );

	}

	const hash = search.toString();
	history.replaceState( null, '', hash ? '#' + hash : location.pathname + location.search );
	storage.saveLast( { ...params } );

}

let hashTimer = 0;
function scheduleHashWrite() {

	clearTimeout( hashTimer );
	hashTimer = setTimeout( writeHash, 400 );

}

// ---------------------------------------------------------------- HUD

const modeButtons = [ ...document.querySelectorAll( '#modeSeg button' ) ];
const hint = document.getElementById( 'hint' );

const HINTS = {
	orbit: () => 'Drag to rotate <i>·</i> Right drag to pan <i>·</i> Scroll to zoom <i>·</i> Press <kbd>3</kbd> to ride through',
	fly: () => `Drag to look <i>·</i> <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move <i>·</i> <kbd>Q</kbd><kbd>E</kbd> down, up <i>·</i> <kbd>Shift</kbd> boost <i>·</i> Scroll for speed (${ rig.speedFactor.toFixed( 1 ) }×)`,
	ride: () => 'Drag or arrow keys to look around <i>·</i> <kbd>C</kbd> or double click to face forward <i>·</i> <kbd>Esc</kbd> to leave',
};

rig.onModeChange = ( mode ) => {

	for ( const b of modeButtons ) b.classList.toggle( 'active', b.dataset.mode === mode );
	hint.innerHTML = HINTS[ mode ]();
	viewport.dataset.mode = mode;

};

for ( const b of modeButtons ) b.addEventListener( 'click', () => rig.setMode( b.dataset.mode ) );

document.getElementById( 'btnResetView' ).addEventListener( 'click', () => rig.resetView() );
document.getElementById( 'btnShot' ).addEventListener( 'click', screenshot );
document.getElementById( 'btnPanel' ).addEventListener( 'click', togglePanel );

window.addEventListener( 'keydown', ( e ) => {

	const t = e.target;
	if ( t && ( t.tagName === 'SELECT' || ( t.tagName === 'INPUT' && t.type === 'text' ) ) ) return;
	if ( e.metaKey || e.ctrlKey || e.altKey ) return;

	if ( e.key === '1' ) rig.setMode( 'orbit' );
	else if ( e.key === '2' ) rig.setMode( 'fly' );
	else if ( e.key === '3' ) rig.setMode( 'ride' );
	else if ( e.key === 'Escape' && rig.mode !== 'orbit' ) rig.setMode( 'orbit' );
	else if ( e.key === 'r' ) rig.resetView();
	else if ( e.key === 'h' ) togglePanel();
	else if ( e.key === 'p' ) screenshot();
	else return;
	e.preventDefault();

} );

function togglePanel() {

	app.classList.toggle( 'panel-hidden' );

}

function screenshot() {

	composer.render( 0 );
	const link = document.createElement( 'a' );
	link.href = renderer.domElement.toDataURL( 'image/png' );
	link.download = 'fly-through-toroid.png';
	link.click();

}

// ---------------------------------------------------------------- resize and loop

function resize() {

	const w = Math.max( 1, viewport.clientWidth ), h = Math.max( 1, viewport.clientHeight );
	renderer.setSize( w, h, false );
	composer.setSize( w, h );
	camera.aspect = w / h;
	camera.updateProjectionMatrix();

}

new ResizeObserver( resize ).observe( viewport );

applyAll();
panel.syncAll();
updateColors();
refreshLibrary();

const home = rig.homePose();
camera.position.copy( home.position );
camera.quaternion.copy( home.quaternion );
rig.orbit.target.copy( home.target );
rig.orbit.update();
rig.onModeChange( 'orbit' );

const clock = new THREE.Clock();

renderer.setAnimationLoop( () => {

	const dt = Math.min( clock.getDelta(), 0.1 );

	if ( params.flowSpeed !== 0 ) {

		const n = ring.count;
		ring.phase = ( ( ring.phase + params.flowSpeed * dt * n / ring.pathLength ) % n + n ) % n;
		ring.updateInstances();

	}

	if ( params.spinSpeed !== 0 ) ring.group.rotation.y += params.spinSpeed * DEG * dt;

	if ( skyDirty ) {

		skyDirty = false;
		environments.setSun( lightDirection() );

	}

	rig.update( dt );
	environments.follow( camera );

	renderer.shadowMap.needsUpdate = true;
	composer.render( dt );

} );

viewport.classList.add( 'ready' );

// Inspection handle for development: open the page with ?debug
if ( new URLSearchParams( location.search ).has( 'debug' ) ) window.toroidApp = { THREE, renderer, scene, camera, rig, ring, params, panel, composer };
