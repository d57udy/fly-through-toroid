import * as THREE from 'three';
import { MAX_COUNT } from './config.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// A ring of small toroids threaded on a circular (optionally wavy) path.
// The path is the centre line of the big toroid; every small toroid has its
// hole aligned with the path tangent, so flying along the path goes through
// each one of them.
export class ToroidRing {

	constructor( material ) {

		this.group = new THREE.Group();
		this.material = material;

		this.R = 12; // ring (major) radius
		this.r = 2.2; // small toroid centre-line radius
		this.t = 0.25; // small toroid tube radius
		this.count = 48;
		this.tilt = 0;
		this.twist = 0;
		this.waveHeight = 0;
		this.waveCount = 3;

		this.phase = 0; // flow offset, in units of "toroid slots"
		this.pathLength = TAU * this.R;

		this.mesh = new THREE.InstancedMesh( new THREE.TorusGeometry( this.r, this.t, 40, 128 ), material, MAX_COUNT );
		this.mesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );
		this.mesh.frustumCulled = false;
		this.mesh.castShadow = true;
		this.mesh.receiveShadow = true;

		const white = new THREE.Color( 1, 1, 1 );
		for ( let i = 0; i < MAX_COUNT; i ++ ) this.mesh.setColorAt( i, white );

		this.group.add( this.mesh );

		this._m = new THREE.Matrix4();
		this._frame = makeFrame();
		this._d = new THREE.Vector3();
		this._x = new THREE.Vector3();
		this._y = new THREE.Vector3();
		this._z = new THREE.Vector3();

	}

	setGeometry( r, t, radialSegments, tubularSegments ) {

		this.r = r;
		this.t = t;
		const old = this.mesh.geometry;
		this.mesh.geometry = new THREE.TorusGeometry( r, t, radialSegments, tubularSegments );
		old.dispose();

	}

	setLayout( { R, count, tilt, twist, waveHeight, waveCount } ) {

		this.R = R;
		this.count = count;
		this.tilt = tilt * DEG;
		this.twist = twist;
		this.waveHeight = waveHeight;
		this.waveCount = waveCount;
		this.mesh.count = count;
		this.pathLength = this.measurePath();

	}

	// Point, tangent, radial normal and up vector of the path at angle theta.
	frameAt( theta, f = this._frame ) {

		const { R, waveHeight: A, waveCount: k } = this;
		const c = Math.cos( theta ), s = Math.sin( theta );

		f.P.set( R * c, A * Math.sin( k * theta ), R * s );
		f.T.set( - R * s, A * k * Math.cos( k * theta ), R * c ).normalize();

		// Outward radial direction, made orthogonal to the tangent.
		f.N.set( c, 0, s );
		f.N.addScaledVector( f.T, - f.N.dot( f.T ) ).normalize();
		f.U.crossVectors( f.T, f.N );

		return f;

	}

	// Length of d(path)/d(theta); used to move at a constant speed.
	speedAt( theta ) {

		const { R, waveHeight: A, waveCount: k } = this;
		const dy = A * k * Math.cos( k * theta );
		return Math.sqrt( R * R + dy * dy );

	}

	measurePath() {

		const steps = 512;
		let len = 0;
		for ( let i = 0; i < steps; i ++ ) len += this.speedAt( ( i + 0.5 ) / steps * TAU );
		return len / steps * TAU;

	}

	updateInstances() {

		const { count, tilt, twist } = this;
		const cosA = Math.cos( tilt ), sinA = Math.sin( tilt );
		const f = this._frame, d = this._d, x = this._x, y = this._y, z = this._z;

		for ( let i = 0; i < count; i ++ ) {

			const theta = ( i + this.phase ) / count * TAU;
			this.frameAt( theta, f );

			// Direction the toroid axis leans towards when tilted; twist spins it around the path.
			const phi = twist * theta;
			d.copy( f.U ).multiplyScalar( Math.cos( phi ) ).addScaledVector( f.N, Math.sin( phi ) );

			// TorusGeometry has its axis along +Z.
			z.copy( f.T ).multiplyScalar( cosA ).addScaledVector( d, sinA );
			y.copy( d ).multiplyScalar( cosA ).addScaledVector( f.T, - sinA );
			x.crossVectors( y, z );

			this._m.makeBasis( x, y, z ).setPosition( f.P );
			this.mesh.setMatrixAt( i, this._m );

		}

		this.mesh.instanceMatrix.needsUpdate = true;

	}

	// mode: uniform | alternate | gradient | rainbow
	updateColors( mode, colorA, colorB ) {

		const a = new THREE.Color( colorA ), b = new THREE.Color( colorB ), c = new THREE.Color();
		const n = this.count;
		const hsl = {};
		a.getHSL( hsl, THREE.SRGBColorSpace );

		for ( let i = 0; i < MAX_COUNT; i ++ ) {

			const u = ( i % n ) / n;
			if ( mode === 'alternate' ) c.copy( i % 2 ? b : a );
			else if ( mode === 'gradient' ) c.lerpColors( a, b, 0.5 - 0.5 * Math.cos( u * TAU ) );
			else if ( mode === 'rainbow' ) c.setHSL( ( hsl.h + u ) % 1, Math.max( hsl.s, 0.75 ), THREE.MathUtils.clamp( hsl.l, 0.35, 0.65 ), THREE.SRGBColorSpace );
			else c.copy( a );
			this.mesh.setColorAt( i, c );

		}

		this.mesh.instanceColor.needsUpdate = true;

	}

	// Spacing between neighbouring toroids measured along the path.
	gap() {

		const footprint = 2 * ( this.r * Math.abs( Math.sin( this.tilt ) ) + this.t );
		return this.pathLength / this.count - footprint;

	}

	// Radius of a sphere around the origin that contains the whole ring.
	extent() {

		return Math.hypot( this.R + this.r + this.t, this.waveHeight + this.r + this.t );

	}

	lowestPoint() {

		return - ( this.waveHeight + this.r + this.t );

	}

}

function makeFrame() {

	return { P: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), U: new THREE.Vector3() };

}
