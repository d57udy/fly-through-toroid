import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const TAU = Math.PI * 2;
const LOOK_SENSITIVITY = 0.0028;

// Three navigation modes:
//  orbit: OrbitControls around the ring
//  fly:   free flight, drag to look, WASD to move
//  ride:  automatic flight along the ring's centre line, through every toroid
export class CameraRig {

	constructor( camera, dom, ring ) {

		this.camera = camera;
		this.dom = dom;
		this.ring = ring;
		this.mode = 'orbit';
		this.rideSpeed = 4;
		this.onModeChange = () => {};

		this.orbit = new OrbitControls( camera, dom );
		this.orbit.enableDamping = true;
		this.orbit.dampingFactor = 0.07;
		this.orbit.rotateSpeed = 0.8;
		this.orbit.zoomSpeed = 0.9;
		this.orbit.screenSpacePanning = true;

		// Fly state
		this.keys = new Set();
		this.yaw = 0;
		this.pitch = 0;
		this.velocity = new THREE.Vector3();
		this.speedFactor = 1;

		// Ride state
		this.rideTheta = 0;
		// Look direction relative to the direction of travel. It stays where the
		// user puts it until they recenter (C or double click).
		this.lookYaw = 0;
		this.lookPitch = 0;
		this.recentering = false;

		this.dragging = false;
		this.tween = null;

		this._v = new THREE.Vector3();
		this._q = new THREE.Quaternion();
		this._e = new THREE.Euler( 0, 0, 0, 'YXZ' );
		this._m = new THREE.Matrix4();
		this._frame = { P: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), U: new THREE.Vector3() };

		this._bindEvents();

	}

	_bindEvents() {

		const dom = this.dom;

		dom.addEventListener( 'pointerdown', ( e ) => {

			if ( document.activeElement && document.activeElement !== document.body ) document.activeElement.blur();
			if ( this.mode === 'orbit' ) return;
			this.dragging = true;
			this.lastX = e.clientX;
			this.lastY = e.clientY;
			dom.setPointerCapture( e.pointerId );

		} );

		dom.addEventListener( 'pointermove', ( e ) => {

			if ( ! this.dragging ) return;
			const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
			this.lastX = e.clientX;
			this.lastY = e.clientY;

			if ( this.mode === 'fly' ) {

				this.yaw -= dx * LOOK_SENSITIVITY;
				this.pitch = THREE.MathUtils.clamp( this.pitch - dy * LOOK_SENSITIVITY, - 1.55, 1.55 );

			} else if ( this.mode === 'ride' ) {

				this.lookYaw = wrapAngle( this.lookYaw - dx * LOOK_SENSITIVITY );
				this.lookPitch = THREE.MathUtils.clamp( this.lookPitch - dy * LOOK_SENSITIVITY, - 1.5, 1.5 );
				this.recentering = false;

			}

		} );

		const end = ( e ) => {

			if ( ! this.dragging ) return;
			this.dragging = false;
			if ( dom.hasPointerCapture( e.pointerId ) ) dom.releasePointerCapture( e.pointerId );

		};

		dom.addEventListener( 'pointerup', end );
		dom.addEventListener( 'pointercancel', end );

		dom.addEventListener( 'dblclick', () => {

			if ( this.mode === 'ride' ) this.recenter();

		} );

		dom.addEventListener( 'wheel', ( e ) => {

			if ( this.mode !== 'fly' ) return;
			e.preventDefault();
			this.speedFactor = THREE.MathUtils.clamp( this.speedFactor * Math.exp( - e.deltaY * 0.0015 ), 0.1, 12 );
			this.onModeChange( this.mode );

		}, { passive: false } );

		window.addEventListener( 'keydown', ( e ) => {

			if ( isTyping( e.target ) ) return;
			this.keys.add( e.code );
			if ( e.code === 'KeyC' && this.mode === 'ride' ) this.recenter();

		} );

		window.addEventListener( 'keyup', ( e ) => this.keys.delete( e.code ) );
		window.addEventListener( 'blur', () => this.keys.clear() );

	}

	// Default overview position for the current ring size.
	homePose() {

		// Distance at which the ring's bounding sphere fits the narrower field of view.
		const vFov = this.camera.fov * Math.PI / 180;
		const hFov = 2 * Math.atan( Math.tan( vFov / 2 ) * this.camera.aspect );
		const d = this.ring.extent() / Math.sin( Math.min( vFov, hFov ) / 2 ) * 1.06;
		const el = 26 * Math.PI / 180, az = 38 * Math.PI / 180;
		const position = new THREE.Vector3( d * Math.cos( el ) * Math.sin( az ), d * Math.sin( el ), d * Math.cos( el ) * Math.cos( az ) );
		const m = new THREE.Matrix4().lookAt( position, new THREE.Vector3(), new THREE.Vector3( 0, 1, 0 ) );
		return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix( m ), target: new THREE.Vector3() };

	}

	setMode( mode ) {

		if ( mode === this.mode && ! this.tween ) return;
		const prev = this.mode;
		this.mode = mode;
		this.dragging = false;
		this.orbit.enabled = false;

		if ( mode === 'orbit' ) {

			if ( prev === 'ride' ) {

				const home = this.homePose();
				this._startTween( () => home, 1.6, () => this._enterOrbit( home.target ) );

			} else {

				// Orbit around a point straight ahead so the view does not jump.
				const forward = this._v.set( 0, 0, - 1 ).applyQuaternion( this.camera.quaternion );
				const dist = THREE.MathUtils.clamp( this.camera.position.length(), 4, this.ring.extent() * 3 );
				this.tween = null;
				this._enterOrbit( this.camera.position.clone().addScaledVector( forward, dist ) );

			}

		} else if ( mode === 'fly' ) {

			this.tween = null;
			this._syncFlyAngles();
			this.velocity.set( 0, 0, 0 );

		} else if ( mode === 'ride' ) {

			// Join the path at the point closest to the camera.
			const local = this.ring.group.worldToLocal( this.camera.position.clone() );
			this.rideTheta = Math.atan2( local.z, local.x );
			this.lookYaw = 0;
			this.lookPitch = 0;
			this.recentering = false;
			this._startTween( () => this._ridePose(), 1.8, null );

		}

		this.onModeChange( mode );

	}

	// Smoothly turn back to face the direction of travel.
	recenter() {

		this.recentering = true;

	}

	resetView() {

		const home = this.homePose();
		if ( this.mode !== 'orbit' ) {

			this.mode = 'orbit';
			this.onModeChange( 'orbit' );

		}

		this.orbit.enabled = false;
		this._startTween( () => home, 1.2, () => this._enterOrbit( home.target ) );

	}

	_enterOrbit( target ) {

		this.orbit.target.copy( target );
		this.orbit.enabled = true;
		this.orbit.update();

	}

	_syncFlyAngles() {

		this._e.setFromQuaternion( this.camera.quaternion, 'YXZ' );
		this.pitch = this._e.x;
		this.yaw = this._e.y;

	}

	_startTween( getTarget, duration, onDone ) {

		this.tween = {
			fromPos: this.camera.position.clone(),
			fromQuat: this.camera.quaternion.clone(),
			getTarget, duration, onDone, t: 0,
		};

	}

	// Camera pose on the ring path, in world space.
	_ridePose() {

		const f = this.ring.frameAt( this.rideTheta, this._frame );
		const g = this.ring.group;
		g.updateMatrixWorld();

		const position = f.P.clone().applyMatrix4( g.matrixWorld );

		// Camera looks down -Z: basis (right, up, back) = (-N, U, -T).
		this._m.makeBasis( f.N.clone().negate(), f.U, f.T.clone().negate() );
		const quaternion = new THREE.Quaternion().setFromRotationMatrix( this._m );
		quaternion.premultiply( g.getWorldQuaternion( this._q ) );

		const look = new THREE.Quaternion().setFromEuler( this._e.set( this.lookPitch, this.lookYaw, 0, 'YXZ' ) );
		quaternion.multiply( look );

		return { position, quaternion };

	}

	update( dt ) {

		if ( this.mode === 'ride' ) {

			this.rideTheta = ( this.rideTheta + this.rideSpeed * dt / this.ring.speedAt( this.rideTheta ) ) % TAU;

			// Arrow keys turn the view; it then stays put relative to the motion.
			const k = this.keys;
			const turn = ( k.has( 'ArrowLeft' ) ? 1 : 0 ) - ( k.has( 'ArrowRight' ) ? 1 : 0 );
			const tilt = ( k.has( 'ArrowUp' ) ? 1 : 0 ) - ( k.has( 'ArrowDown' ) ? 1 : 0 );
			if ( turn || tilt ) {

				this.lookYaw = wrapAngle( this.lookYaw + turn * 1.6 * dt );
				this.lookPitch = THREE.MathUtils.clamp( this.lookPitch + tilt * 1.2 * dt, - 1.5, 1.5 );
				this.recentering = false;

			}

			if ( this.recentering ) {

				const a = 1 - Math.exp( - dt * 5 );
				this.lookYaw -= this.lookYaw * a;
				this.lookPitch -= this.lookPitch * a;
				if ( Math.abs( this.lookYaw ) + Math.abs( this.lookPitch ) < 1e-3 ) {

					this.lookYaw = this.lookPitch = 0;
					this.recentering = false;

				}

			}

		}

		if ( this.tween ) {

			const tw = this.tween;
			tw.t = Math.min( 1, tw.t + dt / tw.duration );
			const a = easeInOut( tw.t );
			const target = tw.getTarget();
			this.camera.position.lerpVectors( tw.fromPos, target.position, a );
			this.camera.quaternion.slerpQuaternions( tw.fromQuat, target.quaternion, a );

			if ( tw.t >= 1 ) {

				this.tween = null;
				if ( tw.onDone ) tw.onDone();

			}

			return;

		}

		if ( this.mode === 'orbit' ) {

			this.orbit.update();

		} else if ( this.mode === 'fly' ) {

			this._updateFly( dt );

		} else if ( this.mode === 'ride' ) {

			const pose = this._ridePose();
			this.camera.position.copy( pose.position );
			this.camera.quaternion.copy( pose.quaternion );

		}

	}

	_updateFly( dt ) {

		const k = this.keys;
		const input = new THREE.Vector3(
			( k.has( 'KeyD' ) || k.has( 'ArrowRight' ) ? 1 : 0 ) - ( k.has( 'KeyA' ) || k.has( 'ArrowLeft' ) ? 1 : 0 ),
			( k.has( 'KeyE' ) || k.has( 'Space' ) ? 1 : 0 ) - ( k.has( 'KeyQ' ) || k.has( 'KeyC' ) ? 1 : 0 ),
			( k.has( 'KeyS' ) || k.has( 'ArrowDown' ) ? 1 : 0 ) - ( k.has( 'KeyW' ) || k.has( 'ArrowUp' ) ? 1 : 0 )
		);
		if ( input.lengthSq() > 1 ) input.normalize();

		this.camera.quaternion.setFromEuler( this._e.set( this.pitch, this.yaw, 0, 'YXZ' ) );

		const boost = k.has( 'ShiftLeft' ) || k.has( 'ShiftRight' ) ? 3 : 1;
		const speed = Math.max( 2, this.ring.R * 0.45 ) * this.speedFactor * boost;
		const wanted = input.applyQuaternion( this.camera.quaternion ).multiplyScalar( speed );

		this.velocity.lerp( wanted, 1 - Math.exp( - dt * 7 ) );
		this.camera.position.addScaledVector( this.velocity, dt );

	}

}

function wrapAngle( a ) {

	return ( ( a + Math.PI ) % TAU + TAU ) % TAU - Math.PI;

}

function easeInOut( t ) {

	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow( - 2 * t + 2, 3 ) / 2;

}

function isTyping( el ) {

	if ( ! el || ! el.tagName ) return false;
	if ( el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ) return true;
	return el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'color';

}
