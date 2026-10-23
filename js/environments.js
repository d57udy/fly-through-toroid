import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';

// Each environment has two parts:
//  - a background dome that follows the camera (visible backdrop), and
//  - a prefiltered (PMREM) environment map used for lighting and reflections.
// The domes are ordinary opaque meshes so that glass materials refract them.

const SKY_SETTINGS = { turbidity: 10, rayleigh: 3, mieCoefficient: 0.005, mieDirectionalG: 0.7 };

// Backdrop gradients (top, horizon, bottom). The ground fades into the same
// gradient so its edge disappears into the backdrop.
const GRADIENTS = {
	studio: [ '#1b1e25', '#3a404c', '#0d0e12' ],
	white: [ '#f4f5f7', '#dfe2e7', '#cfd3d9' ],
	space: [ '#06070e', '#07080f', '#030308' ],
};

export class Environments {

	constructor( renderer, scene ) {

		this.scene = scene;
		this.pmrem = new THREE.PMREMGenerator( renderer );
		this.current = null;
		this.sunDir = new THREE.Vector3( 0, 1, 0 );

		const room = new RoomEnvironment();
		this.roomTarget = this.pmrem.fromScene( room, 0.04 );
		room.dispose?.();

		this.studioTarget = this.pmrem.fromScene( makeStudioLightingScene(), 0.02, 0.1, 200 );
		this.spaceTarget = this.pmrem.fromScene( makeSpaceLightingScene(), 0.02, 0.1, 200 );

		// Sky used only for lighting: same model with the sun disc removed,
		// because the directional light already provides the sun.
		this.skyLighting = new Sky();
		this.skyLighting.material.fragmentShader = this.skyLighting.material.fragmentShader
			.replace( 'L0 += ( vSunE * 19000.0 * Fex ) * sundisk;', '' );
		this.skyLightingScene = new THREE.Scene();
		this.skyLightingScene.add( this.skyLighting );
		this.skyTarget = null;

		this.domes = {
			studio: makeGradientDome( ...GRADIENTS.studio ),
			white: makeGradientDome( ...GRADIENTS.white ),
			sunset: new Sky(),
			space: makeSpaceDome(),
		};

		applySky( this.domes.sunset, this.sunDir );
		this.domes.sunset.scale.setScalar( 1000 );

		for ( const dome of Object.values( this.domes ) ) {

			dome.renderOrder = - 1000;
			dome.frustumCulled = false;
			dome.visible = false;
			dome.userData.skipAO = true;
			dome.material.depthTest = false;
			dome.material.depthWrite = false;
			scene.add( dome );

		}

	}

	set( name ) {

		this.current = name;
		for ( const [ key, dome ] of Object.entries( this.domes ) ) dome.visible = key === name;

		if ( name === 'studio' ) this.scene.environment = this.studioTarget.texture;
		else if ( name === 'white' ) this.scene.environment = this.roomTarget.texture;
		else if ( name === 'space' ) this.scene.environment = this.spaceTarget.texture;
		else if ( name === 'sunset' ) this.refreshSky();

	}

	// What the ground should fade into: a gradient, or (for the sky) the
	// environment map itself, which is the same sky without the sun disc.
	fadeTarget( name ) {

		if ( name === 'sunset' ) return { useEnvMap: true };
		return { useEnvMap: false, colors: GRADIENTS[ name ] };

	}

	setSun( dir ) {

		this.sunDir.copy( dir );
		applySky( this.domes.sunset, dir );
		if ( this.current === 'sunset' ) this.refreshSky();

	}

	refreshSky() {

		applySky( this.skyLighting, this.sunDir );
		const target = this.pmrem.fromScene( this.skyLightingScene, 0, 0.1, 100 );
		this.scene.environment = target.texture;
		if ( this.skyTarget ) this.skyTarget.dispose();
		this.skyTarget = target;

	}

	follow( camera ) {

		const dome = this.domes[ this.current ];
		if ( dome ) dome.position.copy( camera.position );

	}

}

function applySky( sky, dir ) {

	const u = sky.material.uniforms;
	u.turbidity.value = SKY_SETTINGS.turbidity;
	u.rayleigh.value = SKY_SETTINGS.rayleigh;
	u.mieCoefficient.value = SKY_SETTINGS.mieCoefficient;
	u.mieDirectionalG.value = SKY_SETTINGS.mieDirectionalG;
	u.sunPosition.value.copy( dir );

}

const DOME_VERTEX = /* glsl */`
	varying vec3 vDir;
	void main() {
		vDir = position;
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		gl_Position.z = gl_Position.w;
	}
`;

function makeGradientDome( top, horizon, bottom ) {

	const material = new THREE.ShaderMaterial( {
		side: THREE.BackSide,
		uniforms: {
			top: { value: new THREE.Color( top ) },
			horizon: { value: new THREE.Color( horizon ) },
			bottom: { value: new THREE.Color( bottom ) },
		},
		vertexShader: DOME_VERTEX,
		fragmentShader: /* glsl */`
			uniform vec3 top;
			uniform vec3 horizon;
			uniform vec3 bottom;
			varying vec3 vDir;
			void main() {
				vec3 d = normalize( vDir );
				vec3 col = d.y > 0.0
					? mix( horizon, top, pow( d.y, 0.55 ) )
					: mix( horizon, bottom, pow( - d.y, 0.45 ) );
				gl_FragColor = vec4( col, 1.0 );
			}
		`,
	} );

	return new THREE.Mesh( new THREE.SphereGeometry( 100, 48, 24 ), material );

}

// Procedural star field with a faint milky band and nebula clouds.
function makeSpaceDome() {

	const material = new THREE.ShaderMaterial( {
		side: THREE.BackSide,
		vertexShader: DOME_VERTEX,
		fragmentShader: /* glsl */`
			varying vec3 vDir;

			float hash13( vec3 p3 ) {
				p3 = fract( p3 * 0.1031 );
				p3 += dot( p3, p3.zyx + 31.32 );
				return fract( ( p3.x + p3.y ) * p3.z );
			}

			vec2 hash23( vec3 p3 ) {
				p3 = fract( p3 * vec3( 0.1031, 0.1030, 0.0973 ) );
				p3 += dot( p3, p3.yzx + 33.33 );
				return fract( ( p3.xx + p3.yz ) * p3.zy );
			}

			float noise( vec3 x ) {
				vec3 i = floor( x );
				vec3 f = fract( x );
				f = f * f * ( 3.0 - 2.0 * f );
				return mix(
					mix( mix( hash13( i ), hash13( i + vec3( 1, 0, 0 ) ), f.x ),
					     mix( hash13( i + vec3( 0, 1, 0 ) ), hash13( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
					mix( mix( hash13( i + vec3( 0, 0, 1 ) ), hash13( i + vec3( 1, 0, 1 ) ), f.x ),
					     mix( hash13( i + vec3( 0, 1, 1 ) ), hash13( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
					f.z );
			}

			float fbm( vec3 p ) {
				float v = 0.0, a = 0.5;
				for ( int i = 0; i < 6; i ++ ) {
					v += a * noise( p );
					p = p * 2.03 + vec3( 1.7, 9.2, 4.1 );
					a *= 0.5;
				}
				return v;
			}

			// Stars on a grid per cube face, so they sit exactly on the sphere.
			vec3 starLayer( vec3 d, float scale, float density, float seed ) {
				vec3 a = abs( d );
				vec2 uv;
				float face;
				if ( a.x > a.y && a.x > a.z ) { uv = d.yz / a.x; face = d.x > 0.0 ? 0.0 : 1.0; }
				else if ( a.y > a.z ) { uv = d.xz / a.y; face = d.y > 0.0 ? 2.0 : 3.0; }
				else { uv = d.xy / a.z; face = d.z > 0.0 ? 4.0 : 5.0; }

				vec2 p = uv * scale;
				vec2 id = floor( p );
				vec2 f = fract( p );
				vec3 key = vec3( id, face * 37.0 + seed );

				if ( hash13( key ) > density ) return vec3( 0.0 );

				vec2 pos = 0.2 + 0.6 * hash23( key + 11.0 );
				float pix = length( fwidth( p ) );
				float size = 0.035;
				float radius = max( size, pix * 0.9 );
				float dist = length( f - pos );
				float energy = ( size * size ) / ( radius * radius );
				float h = hash13( key + 5.0 );
				float bright = mix( 0.25, 4.0, pow( h, 7.0 ) ) * energy;
				vec3 tint = mix( vec3( 0.62, 0.74, 1.0 ), vec3( 1.0, 0.82, 0.62 ), hash13( key + 3.0 ) );
				return tint * bright * smoothstep( radius, 0.0, dist );
			}

			void main() {
				vec3 d = normalize( vDir );
				vec3 bandNormal = normalize( vec3( 0.35, 0.86, -0.37 ) );
				float band = exp( - pow( dot( d, bandNormal ) / 0.22, 2.0 ) );

				float n = fbm( d * 2.2 + vec3( 3.0 ) );
				float n2 = fbm( d * 4.5 - vec3( 7.0 ) );
				vec3 col = vec3( 0.002, 0.003, 0.009 );
				col += vec3( 0.05, 0.022, 0.09 ) * pow( n, 3.0 ) * 1.6;
				col += vec3( 0.0, 0.045, 0.07 ) * pow( n2, 4.0 ) * 1.4;
				col += vec3( 0.06, 0.05, 0.075 ) * band * ( 0.35 + 0.9 * pow( n2, 2.0 ) );

				col += starLayer( d, 70.0, 0.06, 1.0 );
				col += starLayer( d, 150.0, 0.10 + 0.25 * band, 2.0 ) * 0.7;
				col += starLayer( d, 320.0, 0.12 + 0.4 * band, 3.0 ) * 0.45;

				gl_FragColor = vec4( col, 1.0 );
			}
		`,
	} );

	return new THREE.Mesh( new THREE.SphereGeometry( 100, 64, 32 ), material );

}

function addLightCard( scene, color, size, position ) {

	const mesh = new THREE.Mesh(
		new THREE.PlaneGeometry( size[ 0 ], size[ 1 ] ),
		new THREE.MeshBasicMaterial( { color: new THREE.Color( ...color ), side: THREE.DoubleSide } )
	);
	mesh.position.set( ...position );
	mesh.lookAt( 0, 0, 0 );
	scene.add( mesh );

}

// Photo studio: dark walls with a large overhead softbox and two strip lights,
// which gives polished metal crisp highlights against dark reflections.
function makeStudioLightingScene() {

	const scene = new THREE.Scene();

	const shell = makeGradientDome( '#2b2f37', '#1a1d23', '#0b0c0f' );
	shell.material.depthTest = true;
	scene.add( shell );

	addLightCard( scene, [ 5, 5, 5 ], [ 16, 16 ], [ 0, 20, 0 ] ); // overhead softbox
	addLightCard( scene, [ 9, 9, 9.5 ], [ 3, 18 ], [ - 17, 4, 5 ] ); // left strip
	addLightCard( scene, [ 9.5, 9, 8.5 ], [ 3, 18 ], [ 16, 4, - 6 ] ); // right strip
	addLightCard( scene, [ 3.5, 3.5, 4 ], [ 20, 4 ], [ 0, 7, - 20 ] ); // back rim
	addLightCard( scene, [ 1.2, 1.2, 1.2 ], [ 14, 6 ], [ 2, 1, 20 ] ); // front fill

	return scene;

}

// Lighting rig for the space environment: a dark shell with coloured light cards,
// giving chrome and glass vivid rim reflections.
function makeSpaceLightingScene() {

	const scene = new THREE.Scene();

	const shell = makeGradientDome( '#0b1022', '#140c24', '#030408' );
	shell.material.depthTest = true;
	scene.add( shell );

	addLightCard( scene, [ 7, 3.4, 1.4 ], [ 12, 16 ], [ - 20, 5, - 6 ] ); // warm key
	addLightCard( scene, [ 1.0, 3.0, 7.0 ], [ 16, 9 ], [ 18, 3, 12 ] ); // cool fill
	addLightCard( scene, [ 2.4, 2.5, 3.0 ], [ 26, 26 ], [ 0, 24, 0 ] ); // soft top
	addLightCard( scene, [ 4.5, 0.7, 3.4 ], [ 7, 7 ], [ 6, - 6, - 20 ] ); // magenta accent

	return scene;

}
