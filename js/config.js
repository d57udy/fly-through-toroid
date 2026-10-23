// Default parameters, material presets and environment presets.

export const DEFAULTS = {
	// Toroid geometry
	ringDiameter: 24,
	toroidDiameter: 4.4,
	tubeThickness: 0.5,
	count: 48,

	// Arrangement along the ring
	tilt: 0,
	twist: 0,
	waveHeight: 0,
	waveCount: 3,

	// Material
	material: 'chrome',
	colorMode: 'uniform',
	colorA: '#ffffff',
	colorB: '#9fb4d6',
	metalness: 1,
	roughness: 0.05,
	clearcoat: 0,
	transmission: 0,
	iridescence: 0,
	glow: 0,

	// Scene and lighting
	environment: 'studio',
	exposure: 1,
	envIntensity: 1,
	lightIntensity: 2.2,
	lightAzimuth: 35,
	lightElevation: 50,
	bloom: 0.25,
	vignette: 0.35,
	shadows: true,
	ground: true,
	ao: true,
	toneMapping: 'aces',
	quality: 'high',

	// Motion and camera
	rideSpeed: 4,
	flowSpeed: 0,
	spinSpeed: 0,
	fov: 50,
};

// Values a preset may set that have no slider of their own.
export const HIDDEN_MATERIAL_DEFAULTS = {
	diffuseScale: 1,
	clearcoatRoughness: 0.05,
	ior: 1.5,
	dispersion: 0,
	attenuationColor: '#ffffff',
	attenuationScale: 0, // 0 = no absorption, otherwise attenuation distance in tube diameters
	iridescenceIOR: 1.5,
	sheen: 0,
	sheenColor: '#ffffff',
};

export const MATERIALS = {
	chrome: {
		label: 'Chrome',
		swatch: 'radial-gradient(circle at 32% 28%, #fff 0 8%, #c9d3df 22%, #4a5360 52%, #e8edf3 70%, #1c2129 100%)',
		colorA: '#ffffff', colorB: '#9fb4d6',
		metalness: 1, roughness: 0.05, clearcoat: 0, transmission: 0, iridescence: 0, glow: 0,
	},
	gold: {
		label: 'Gold',
		swatch: 'radial-gradient(circle at 32% 28%, #fff6d8 0 8%, #f2c55c 25%, #8a5a12 60%, #ffd77a 78%, #3d2606 100%)',
		colorA: '#ffc35c', colorB: '#ffe3a8',
		metalness: 1, roughness: 0.16, clearcoat: 0, transmission: 0, iridescence: 0, glow: 0,
	},
	copper: {
		label: 'Copper',
		swatch: 'radial-gradient(circle at 32% 28%, #ffe4d6 0 8%, #e8916a 25%, #7a3216 60%, #f4ab86 78%, #2e1206 100%)',
		colorA: '#f0956e', colorB: '#ffc6ad',
		metalness: 1, roughness: 0.22, clearcoat: 0, transmission: 0, iridescence: 0, glow: 0,
	},
	titanium: {
		label: 'Brushed titanium',
		swatch: 'radial-gradient(circle at 32% 28%, #f2f3f5 0 10%, #aeb3ba 35%, #5d636b 70%, #2c3036 100%)',
		colorA: '#c3c7ce', colorB: '#8f97a3',
		metalness: 1, roughness: 0.38, clearcoat: 0, transmission: 0, iridescence: 0, glow: 0,
	},
	glass: {
		label: 'Clear glass',
		swatch: 'radial-gradient(circle at 32% 28%, #ffffff 0 8%, rgba(220,235,255,.55) 30%, rgba(120,150,190,.35) 62%, rgba(255,255,255,.8) 80%, rgba(60,80,110,.6) 100%)',
		colorA: '#ffffff', colorB: '#d7ecff',
		metalness: 0, roughness: 0, clearcoat: 0, transmission: 1, iridescence: 0, glow: 0,
		ior: 1.5, dispersion: 4,
	},
	frosted: {
		label: 'Frosted glass',
		swatch: 'radial-gradient(circle at 35% 30%, #fbfdff 0 12%, #d6e2ee 40%, #a9b8c8 75%, #8293a6 100%)',
		colorA: '#eef5ff', colorB: '#ffe9f3',
		metalness: 0, roughness: 0.35, clearcoat: 0, transmission: 1, iridescence: 0, glow: 0,
		ior: 1.45,
	},
	emerald: {
		label: 'Emerald',
		swatch: 'radial-gradient(circle at 32% 28%, #eafff4 0 7%, #3fd08e 28%, #0b5a37 62%, #57e0a0 80%, #032015 100%)',
		colorA: '#ffffff', colorB: '#ffffff',
		metalness: 0, roughness: 0.02, clearcoat: 0, transmission: 1, iridescence: 0, glow: 0,
		ior: 1.58, dispersion: 2, attenuationColor: '#14b36b', attenuationScale: 1.2,
	},
	ruby: {
		label: 'Ruby',
		swatch: 'radial-gradient(circle at 32% 28%, #ffe6ea 0 7%, #e8304f 28%, #6a0718 62%, #ff5c78 80%, #250208 100%)',
		colorA: '#ffffff', colorB: '#ffffff',
		metalness: 0, roughness: 0.02, clearcoat: 0, transmission: 1, iridescence: 0, glow: 0,
		ior: 1.76, dispersion: 2, attenuationColor: '#d1102e', attenuationScale: 1.0,
	},
	ceramic: {
		label: 'Ceramic',
		swatch: 'radial-gradient(circle at 32% 28%, #ffffff 0 10%, #f1ede6 35%, #c4bdb2 75%, #8f877c 100%)',
		colorA: '#f3efe8', colorB: '#1d2026',
		metalness: 0, roughness: 0.28, clearcoat: 0.8, transmission: 0, iridescence: 0, glow: 0,
	},
	carpaint: {
		label: 'Car paint',
		swatch: 'radial-gradient(circle at 32% 28%, #ffd5d5 0 7%, #d4141f 28%, #5e050a 70%, #2a0204 100%)',
		colorA: '#c0111f', colorB: '#14161b',
		metalness: 0.55, roughness: 0.38, clearcoat: 1, transmission: 0, iridescence: 0, glow: 0,
		clearcoatRoughness: 0.03,
	},
	clay: {
		label: 'Matte clay',
		swatch: 'radial-gradient(circle at 35% 30%, #efe5da 0 10%, #d7c8b7 40%, #a59482 80%, #7c6c5c 100%)',
		colorA: '#d9cbbb', colorB: '#b9c6cf',
		metalness: 0, roughness: 0.92, clearcoat: 0, transmission: 0, iridescence: 0, glow: 0,
	},
	velvet: {
		label: 'Velvet',
		swatch: 'radial-gradient(circle at 35% 30%, #c46bd6 0 10%, #6d1f86 45%, #33093f 80%, #1b0322 100%)',
		colorA: '#5a1673', colorB: '#173b73',
		metalness: 0, roughness: 0.8, clearcoat: 0, transmission: 0, iridescence: 0, glow: 0,
		sheen: 1, sheenColor: '#ff9cf5',
	},
	obsidian: {
		label: 'Obsidian',
		swatch: 'radial-gradient(circle at 32% 28%, #e8e8f0 0 5%, #3a3a46 18%, #0b0b10 55%, #2b2b36 80%, #000 100%)',
		colorA: '#0d0d12', colorB: '#3a3346',
		metalness: 0, roughness: 0.04, clearcoat: 1, transmission: 0, iridescence: 0, glow: 0,
	},
	iridescent: {
		label: 'Iridescent',
		swatch: 'conic-gradient(from 210deg at 45% 45%, #7af5ff, #a37bff, #ff7ad9, #ffd27a, #7affb2, #7af5ff)',
		colorA: '#e6e6ee', colorB: '#c9b8ff',
		metalness: 1, roughness: 0.14, clearcoat: 0, transmission: 0, iridescence: 1, glow: 0,
		iridescenceIOR: 1.8,
	},
	neon: {
		label: 'Neon',
		swatch: 'radial-gradient(circle at 50% 50%, #eaffff 0 12%, #00e5ff 32%, rgba(0,229,255,.35) 58%, #06121a 80%)',
		colorA: '#00e1ff', colorB: '#ff3db8',
		metalness: 0, roughness: 0.4, clearcoat: 0.3, transmission: 0, iridescence: 0, glow: 1.2,
		diffuseScale: 0.12,
	},
};

export const ENVIRONMENTS = {
	studio: {
		label: 'Dark studio',
		exposure: 1, envIntensity: 1, lightIntensity: 2.2, lightAzimuth: 35, lightElevation: 50, ground: true,
	},
	white: {
		label: 'White studio',
		exposure: 0.75, envIntensity: 0.85, lightIntensity: 1.6, lightAzimuth: 35, lightElevation: 60, ground: true,
	},
	sunset: {
		label: 'Sunset sky',
		exposure: 0.6, envIntensity: 1, lightIntensity: 3.5, lightAzimuth: 215, lightElevation: 7, ground: true,
	},
	space: {
		label: 'Deep space',
		exposure: 1.05, envIntensity: 1.2, lightIntensity: 1.8, lightAzimuth: 300, lightElevation: 28, ground: false,
	},
};

export const QUALITY = {
	ultra: { label: 'Ultra', pixelRatio: 2, shadowMap: 4096, radial: 64, tubular: 200, aoSamples: 16 },
	high: { label: 'High', pixelRatio: 1.5, shadowMap: 4096, radial: 40, tubular: 128, aoSamples: 16 },
	fast: { label: 'Fast', pixelRatio: 1, shadowMap: 2048, radial: 24, tubular: 72, aoSamples: 8 },
};

export const MAX_COUNT = 240;
