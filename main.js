// --- START: Updated Hand Tracking Variables ---
let hands;
let handDetected = false;
let targetCameraZ = 100; // Target Z position for smooth zoom
const MIN_CAMERA_Z = 35;  // Zoom in closer
const MAX_CAMERA_Z = 220; // Zoom out farther
const MIN_PINCH_DIST = 0.02; // Min distance between thumb/index for zoom mapping
const MAX_PINCH_DIST = 0.2;  // Max distance ""
let lastPatternChangeTime = 0;
const patternChangeCooldown = 1500; // Cooldown for pattern change (milliseconds)

// Swipe Detection Variables
let lastHandX = null;           // Previous frame's hand X position (wrist)
let swipeAccumulatedDistance = 0; // Accumulated rightward distance
const swipeTriggerDistance = 0.2; // How far (normalized screen width) to swipe right
const swipeResetThreshold = -0.01; // If hand moves left this much, reset swipe

// References for drawing
let canvasCtx, canvasElement, videoElement;
// --- END: Updated Hand Tracking Variables ---


// Initialize variables
let scene, camera, renderer, particles;
let composer, bloomPass, blurPass, verticalBlurPass;
let time = 0;
let currentPattern = 0;
let transitionProgress = 0;
let isTransitioning = false;
let gui;

// Animation parameters (configurable via dat.gui)
const params = {
  particleCount: 25000,
  transitionSpeed: 0.015,
  cameraSpeed: 0.08,
  waveIntensity: 0.2,
  particleSize: 3.0,
  bloomStrength: 1.5,
  bloomRadius: 0.75,
  bloomThreshold: 0.2,
  blurAmount: 2.0,
  changePattern: function() {
    forcePatternChange();
  }
};

const patternNames = ["Cosmic Sphere", "Spiral Nebula", "Quantum Helix", "Stardust Grid", "Celestial Torus"];

// --- PATTERN FUNCTIONS ---
function createSphere(i, count) {
    const t = i / count;
    const phi = Math.acos(2 * t - 1);
    const theta = 2 * Math.PI * (i / count) * Math.sqrt(count);
    return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * 30,
        Math.sin(phi) * Math.sin(theta) * 30,
        Math.cos(phi) * 30
    );
}

function createSpiral(i, count) {
    const t = i / count;
    const numArms = 3;
    const armIndex = i % numArms;
    const angleOffset = (2 * Math.PI / numArms) * armIndex;
    const angle = Math.pow(t, 0.7) * 15 + angleOffset;
    const radius = t * 40;
    const height = Math.sin(t * Math.PI * 2) * 5;
    return new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        height
    );
}

function createGrid(i, count) {
    const sideLength = Math.ceil(Math.cbrt(count));
    const spacing = 60 / sideLength;
    const halfGrid = (sideLength - 1) * spacing / 2;
    const iz = Math.floor(i / (sideLength * sideLength));
    const iy = Math.floor((i % (sideLength * sideLength)) / sideLength);
    const ix = i % sideLength;
    // Avoid placing a particle exactly at the center if grid size is odd
    if (ix === Math.floor(sideLength/2) && iy === Math.floor(sideLength/2) && iz === Math.floor(sideLength/2) && sideLength % 2 !== 0) {
        return new THREE.Vector3(spacing * 0.1, spacing * 0.1, spacing * 0.1); // Slightly offset
    }
    return new THREE.Vector3(
        ix * spacing - halfGrid,
        iy * spacing - halfGrid,
        iz * spacing - halfGrid
    );
}

function createHelix(i, count) {
    const numHelices = 2;
    const helixIndex = i % numHelices;
    const t = Math.floor(i / numHelices) / Math.floor(count / numHelices);
    const angle = t * Math.PI * 10;
    const radius = 15;
    const height = (t - 0.5) * 60;
    const angleOffset = helixIndex * Math.PI;
    return new THREE.Vector3(
        Math.cos(angle + angleOffset) * radius,
        Math.sin(angle + angleOffset) * radius,
        height
    );
}

function createTorus(i, count) {
    const R = 30;
    const r = 10;
    // Use a deterministic approach based on 'i' for better distribution
    const u = (i / count) * 2 * Math.PI;
    const v = (i * Math.sqrt(5)) * 2 * Math.PI; // Use golden angle approximation for second angle

    return new THREE.Vector3(
        (R + r * Math.cos(v)) * Math.cos(u),
        (R + r * Math.cos(v)) * Math.sin(u),
        r * Math.sin(v)
    );
}

const patterns = [createSphere, createSpiral, createHelix, createGrid, createTorus];

// --- PARTICLE TEXTURE ---
function createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;

    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width / 2
    );

    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// --- COLOR PALETTES ---
const colorPalettes = [
    [ new THREE.Color(0x0077ff), new THREE.Color(0x00aaff), new THREE.Color(0x44ccff), new THREE.Color(0x0055cc) ],
    [ new THREE.Color(0x8800cc), new THREE.Color(0xcc00ff), new THREE.Color(0x660099), new THREE.Color(0xaa33ff) ],
    [ new THREE.Color(0x00cc66), new THREE.Color(0x33ff99), new THREE.Color(0x99ff66), new THREE.Color(0x008844) ],
    [ new THREE.Color(0xff9900), new THREE.Color(0xffcc33), new THREE.Color(0xff6600), new THREE.Color(0xffaa55) ],
    [ new THREE.Color(0xff3399), new THREE.Color(0xff66aa), new THREE.Color(0xff0066), new THREE.Color(0xcc0055) ]
];

// --- PARTICLE SYSTEM ---
function createParticleSystem() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(params.particleCount * 3);
    const colors = new Float32Array(params.particleCount * 3);
    const sizes = new Float32Array(params.particleCount);
    const particleTypes = new Float32Array(params.particleCount); // Currently unused but kept

    const initialPattern = patterns[0];
    const initialPalette = colorPalettes[0];

    for (let i = 0; i < params.particleCount; i++) {
        particleTypes[i] = Math.floor(Math.random() * 3); // Example type

        const pos = initialPattern(i, params.particleCount);
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;

        const colorIndex = Math.floor(Math.random() * initialPalette.length);
        const baseColor = initialPalette[colorIndex];
        const variation = 0.85 + Math.random() * 0.3; // Add variation

        colors[i * 3] = baseColor.r * variation;
        colors[i * 3 + 1] = baseColor.g * variation;
        colors[i * 3 + 2] = baseColor.b * variation;

        sizes[i] = 1.0 + Math.random() * 1.5; // Assign individual size variation
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1)); // Store base sizes
    geometry.setAttribute('particleType', new THREE.BufferAttribute(particleTypes, 1)); // Store types
    geometry.userData.currentColors = new Float32Array(colors); // Store initial colors for transitions

    // Use PointsMaterial for simplicity or ShaderMaterial for more control
    const material = new THREE.PointsMaterial({
        size: params.particleSize,
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true, // Make distant particles smaller
        map: createParticleTexture()
        // depthWrite: false // Often needed with AdditiveBlending if particles overlap strangely
    });

    return new THREE.Points(geometry, material);
}

// --- POST PROCESSING ---
function initPostProcessing() {
    // Check if THREE objects exist before using them
    if (typeof THREE === 'undefined' || typeof THREE.EffectComposer === 'undefined' ||
        typeof THREE.RenderPass === 'undefined' ||
        typeof THREE.UnrealBloomPass === 'undefined' ||
        typeof THREE.ShaderPass === 'undefined' ||
        typeof THREE.HorizontalBlurShader === 'undefined' ||
        typeof THREE.VerticalBlurShader === 'undefined') {
      console.error("Required THREE.js post-processing components not found. Make sure all scripts are loaded correctly.");
      composer = null; // Disable post-processing
      return;
    }

    try {
        // Create effect composer
        composer = new THREE.EffectComposer(renderer); // Use THREE.EffectComposer

        // Add render pass
        const renderPass = new THREE.RenderPass(scene, camera); // Use THREE.RenderPass
        composer.addPass(renderPass);

        // Add bloom pass
        bloomPass = new THREE.UnrealBloomPass( // Use THREE.UnrealBloomPass
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            params.bloomStrength,
            params.bloomRadius,
            params.bloomThreshold
        );
        composer.addPass(bloomPass);

        // Add horizontal blur pass
        blurPass = new THREE.ShaderPass(THREE.HorizontalBlurShader); // Use THREE.ShaderPass and THREE.HorizontalBlurShader
        blurPass.uniforms.h.value = params.blurAmount / window.innerWidth;
        composer.addPass(blurPass);

        // Add vertical blur pass
        verticalBlurPass = new THREE.ShaderPass(THREE.VerticalBlurShader); // Use THREE.ShaderPass and THREE.VerticalBlurShader
        verticalBlurPass.uniforms.v.value = params.blurAmount / window.innerHeight;
        composer.addPass(verticalBlurPass);

        // Make sure the final pass renders to screen
        verticalBlurPass.renderToScreen = true;

    } catch (error) {
        console.error("Error setting up post-processing:", error);
        // Fall back to normal rendering if post-processing fails
        composer = null;
    }
}

// --- INIT THREE.JS ---
function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1500);
    camera.position.z = targetCameraZ; // Use target Z for initial position

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const container = document.getElementById('container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        console.error("HTML element with id 'container' not found!");
        return;
    }

    particles = createParticleSystem();
    scene.add(particles);
    initPostProcessing();
    window.addEventListener('resize', onWindowResize);
    initGUI();
    updatePatternName(patternNames[currentPattern], true);

    // --- Get references for drawing ---
    videoElement = document.querySelector('.input_video');
    canvasElement = document.querySelector('.output_canvas');
    if (canvasElement) {
        canvasCtx = canvasElement.getContext('2d');
    } else {
        console.error("Output canvas element not found!");
    }
    // ---

    setupHandTracking(); // Setup hand tracking last
}

// --- WINDOW RESIZE ---
function onWindowResize() {
    if (!camera || !renderer) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Update composer size if it exists
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }

    // Update blur shader uniforms if they exist
    if (blurPass) {
        blurPass.uniforms.h.value = params.blurAmount / window.innerWidth;
    }
    if (verticalBlurPass) { // Use the stored reference
        verticalBlurPass.uniforms.v.value = params.blurAmount / window.innerHeight;
    }

    // Optional: Resize the debug canvas if layout changes significantly
    // if (canvasElement && videoElement) {
    //    // Match CSS size if fixed, or use video dimensions if dynamic
    //    canvasElement.width = canvasElement.clientWidth; // Or videoElement.videoWidth if intrinsic size is better
    //    canvasElement.height = canvasElement.clientHeight; // Or videoElement.videoHeight
    // }
}


// --- PATTERN CHANGE / TRANSITION ---
function forcePatternChange() {
    if (isTransitioning) {
        completeCurrentTransition(); // Finish current transition instantly
    }
    const nextPattern = (currentPattern + 1) % patterns.length;
    transitionToPattern(nextPattern);
    updatePatternName(patternNames[nextPattern]); // Show name briefly
}

function completeCurrentTransition() {
    if (!isTransitioning || !particles || !particles.geometry || !particles.userData.toPositions || !particles.userData.toColors) {
        // Clear transition state if data is missing or geometry invalid
        isTransitioning = false;
        transitionProgress = 0;
        if (particles && particles.userData) {
            delete particles.userData.fromPositions;
            delete particles.userData.toPositions;
            delete particles.userData.fromColors;
            delete particles.userData.toColors;
            delete particles.userData.targetPattern;
        }
        return;
    }

    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array;

    // Ensure arrays are valid before setting
    if (positions && colors &&
        particles.userData.toPositions && particles.userData.toColors &&
        positions.length === particles.userData.toPositions.length &&
        colors.length === particles.userData.toColors.length) {
            positions.set(particles.userData.toPositions);
            colors.set(particles.userData.toColors);
            particles.geometry.userData.currentColors = new Float32Array(particles.userData.toColors); // Update stored colors
            particles.geometry.attributes.position.needsUpdate = true;
            particles.geometry.attributes.color.needsUpdate = true;
            currentPattern = particles.userData.targetPattern; // Update current pattern index
    } else {
      console.error("Transition data length mismatch or invalid data on completion!");
    }

    // Clean up transition data
    delete particles.userData.fromPositions;
    delete particles.userData.toPositions;
    delete particles.userData.fromColors;
    delete particles.userData.toColors;
    delete particles.userData.targetPattern;
    isTransitioning = false;
    transitionProgress = 0;
}

function updatePatternName(name, instant = false) {
    const el = document.getElementById('patternName');
    if (!el) return;
    el.textContent = name;
    if (instant) {
        el.style.transition = 'none'; // Disable transition for instant display
        el.style.opacity = '1';
         // Set a timeout to fade out after a delay, even for instant
         setTimeout(() => {
            if(el) {
                el.style.transition = 'opacity 0.5s ease'; // Re-enable transition for fade-out
                el.style.opacity = '0';
            }
        }, 2500); // Keep visible slightly longer
    } else {
        el.style.transition = 'opacity 0.5s ease';
        el.style.opacity = '1'; // Fade in
        // Set timeout to fade out
        setTimeout(() => {
            if(el) el.style.opacity = '0';
        }, 2500); // Fade out after 2.5 seconds
    }
}

function transitionToPattern(newPattern) {
    if (!particles || !particles.geometry || !particles.geometry.attributes.position) return;

    isTransitioning = true;
    const posAttr = particles.geometry.attributes.position;
    const colAttr = particles.geometry.attributes.color;

    // Ensure current colors are stored correctly before starting
    if (!particles.geometry.userData.currentColors || particles.geometry.userData.currentColors.length !== colAttr.array.length) {
         particles.geometry.userData.currentColors = new Float32Array(colAttr.array);
    }

    const curPos = new Float32Array(posAttr.array);
    const curCol = new Float32Array(particles.geometry.userData.currentColors); // Use stored colors as 'from'

    const newPos = new Float32Array(curPos.length);
    const patternFn = patterns[newPattern];
    const count = params.particleCount;

    // Generate new positions
    for (let i = 0; i < count; i++) {
        const p = patternFn(i, count);
        newPos[i * 3] = p.x;
        newPos[i * 3 + 1] = p.y;
        newPos[i * 3 + 2] = p.z;
    }

    // Generate new colors
    const newCol = new Float32Array(curCol.length);
    const palette = colorPalettes[newPattern];
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * palette.length);
        const base = palette[idx];
        const variation = 0.85 + Math.random() * 0.3; // Keep color variation consistent
        newCol[i * 3] = base.r * variation;
        newCol[i * 3 + 1] = base.g * variation;
        newCol[i * 3 + 2] = base.b * variation;
    }

    // Store transition data
    particles.userData.fromPositions = curPos;
    particles.userData.toPositions = newPos;
    particles.userData.fromColors = curCol;
    particles.userData.toColors = newCol;
    particles.userData.targetPattern = newPattern; // Store the target pattern index
    transitionProgress = 0; // Reset progress
}


// --- Helper function to map a value from one range to another ---
function mapRange(value, inMin, inMax, outMin, outMax) {
  // Clamp value to input range
  value = Math.max(inMin, Math.min(inMax, value));
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}


const clock = new THREE.Clock();

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    if (!renderer || !camera || !scene) return;

    const deltaTime = clock.getDelta();
    time += deltaTime;

    // --- Particle Update ---
    if (particles && particles.geometry && particles.geometry.attributes.position) {
        const positions = particles.geometry.attributes.position.array;
        const count = params.particleCount;

        // Apply wave motion (if not transitioning)
        if (!isTransitioning) {
            for (let i = 0; i < count; i++) {
                const idx = i * 3;
                const noise1 = Math.sin(time * 0.5 + i * 0.01) * params.waveIntensity;
                const noise2 = Math.cos(time * 0.3 + i * 0.02) * params.waveIntensity;
                positions[idx] += noise1 * deltaTime * 5;
                positions[idx + 1] += noise2 * deltaTime * 5;
            }
            particles.geometry.attributes.position.needsUpdate = true;
        }

         // --- Transition Logic ---
         if (isTransitioning && particles.userData.fromPositions && particles.userData.toPositions && particles.userData.fromColors && particles.userData.toColors) {
            transitionProgress += params.transitionSpeed * deltaTime * 60; // Scale speed by frame time (approx)

            if (transitionProgress >= 1.0) {
                transitionProgress = 1.0;
                completeCurrentTransition(); // Finalize positions and clean up
            } else {
                const colors = particles.geometry.attributes.color.array; // Get color buffer
                const fromPos = particles.userData.fromPositions;
                const toPos = particles.userData.toPositions;
                const fromCol = particles.userData.fromColors;
                const toCol = particles.userData.toColors;
                const t = transitionProgress;
                const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                // Check array lengths before interpolation
                if (fromPos.length === positions.length && toPos.length === positions.length &&
                    fromCol.length === colors.length && toCol.length === colors.length) {

                    for (let i = 0; i < count; i++) {
                        const index = i * 3;
                        // Interpolate positions
                        positions[index] = fromPos[index] * (1 - ease) + toPos[index] * ease;
                        positions[index + 1] = fromPos[index + 1] * (1 - ease) + toPos[index + 1] * ease;
                        positions[index + 2] = fromPos[index + 2] * (1 - ease) + toPos[index + 2] * ease;
                        // Interpolate colors
                        colors[index] = fromCol[index] * (1 - ease) + toCol[index] * ease;
                        colors[index + 1] = fromCol[index + 1] * (1 - ease) + toCol[index + 1] * ease;
                        colors[index + 2] = fromCol[index + 2] * (1 - ease) + toCol[index + 2] * ease;
                    }

                    particles.geometry.attributes.position.needsUpdate = true;
                    particles.geometry.attributes.color.needsUpdate = true;
                    particles.geometry.userData.currentColors = new Float32Array(colors); // Update during transition

                } else {
                    console.error("Transition data length mismatch during interpolation!");
                    completeCurrentTransition(); // Attempt to recover by completing
                }
            }
        }
    } // End particle update check


    // --- Camera Movement ---
    const angleX = time * params.cameraSpeed;
    const angleY = time * (params.cameraSpeed * 0.75);

    // Smoothly interpolate current camera Z towards the target Z
    const zoomSpeed = 0.06; // Adjust for responsiveness
    if (camera) { // Check if camera exists
        camera.position.z += (targetCameraZ - camera.position.z) * zoomSpeed;

        // Update X/Y based on the *current* Z distance
        const effectiveRadius = Math.max(camera.position.z, 1.0); // Prevent radius going to zero/negative
        camera.position.x = Math.cos(angleX) * effectiveRadius;
        camera.position.y = Math.sin(angleY) * (effectiveRadius * 0.35) + 5; // Scale Y oscillation with zoom too

        camera.lookAt(0, 0, 0);
    }


    // --- Rendering ---
    if (composer) {
        composer.render(deltaTime);
    } else if (renderer && scene && camera) { // Check before rendering
        renderer.render(scene, camera);
    }
}

// --- DAT.GUI ---
function initGUI() {
    // Check if dat exists
    if (typeof dat === 'undefined') {
        console.warn("dat.GUI library not found. GUI controls will be unavailable.");
        return; // Exit if dat.GUI is not loaded
    }

    try {
        // Create GUI
        gui = new dat.GUI({ width: 300 });
        gui.close(); // Start with closed panel

        // --- Animation Parameters ---
        const animFolder = gui.addFolder('Animation');
        animFolder.add(params, 'cameraSpeed', 0.01, 0.5, 0.005).name('Camera Speed');
        animFolder.add(params, 'waveIntensity', 0, 1, 0.05).name('Wave Intensity');
        animFolder.add(params, 'transitionSpeed', 0.001, 0.05, 0.001).name('Transition Speed');

        // --- Visual Parameters ---
        const visualFolder = gui.addFolder('Visual');
        visualFolder.add(params, 'particleSize', 0.1, 10, 0.1).onChange(function(value) {
            if (particles && particles.material) {
                particles.material.size = value;
            }
        }).name('Particle Size');

        // --- Post-Processing Parameters ---
        if (typeof THREE.EffectComposer !== 'undefined') {
            const ppFolder = gui.addFolder('Post-Processing');
            ppFolder.add(params, 'bloomStrength', 0, 3, 0.05).onChange(function(value) {
                if (bloomPass) bloomPass.strength = value;
            }).name('Bloom Strength');

            ppFolder.add(params, 'bloomRadius', 0, 1, 0.01).onChange(function(value) {
                if (bloomPass) bloomPass.radius = value;
            }).name('Bloom Radius');

            ppFolder.add(params, 'bloomThreshold', 0, 1, 0.01).onChange(function(value) {
                if (bloomPass) bloomPass.threshold = value;
            }).name('Bloom Threshold');

            ppFolder.add(params, 'blurAmount', 0, 5, 0.1).onChange(function(value) {
                if (blurPass) blurPass.uniforms.h.value = value / window.innerWidth;
                if (verticalBlurPass) verticalBlurPass.uniforms.v.value = value / window.innerHeight;
            }).name('Blur Amount');
        }

        // --- Pattern Controls ---
        gui.add(params, 'changePattern').name('Next Pattern');

        // Add GUI styling (optional)
        const guiElement = document.querySelector('.dg.ac');
        if (guiElement) {
            guiElement.style.zIndex = "1000"; // Ensure GUI is above other elements
        }

    } catch (error) {
        console.error("Error initializing dat.GUI:", error);
        if(gui) gui.destroy(); // Clean up partial GUI if error occurred
        gui = null;
    }
}


// --- START: Updated Hand Tracking Functions ---

function onResults(results) {
    // Check if drawing context and MediaPipe utils are available
    if (!canvasCtx || !canvasElement || !videoElement || typeof drawConnectors === 'undefined' || typeof drawLandmarks === 'undefined') {
        console.warn("Canvas context or MediaPipe drawing utilities not ready.");
        return;
    }

    // --- Drawing ---
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the video frame mirrored onto the canvas if image data exists
    if (results.image) {
         canvasCtx.drawImage(
            results.image, 0, 0, canvasElement.width, canvasElement.height);
    } else {
        // If no image (e.g., during startup), clear rect might be enough
         // console.warn("No image data in MediaPipe results.");
    }


    handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

    if (handDetected) {
        const landmarks = results.multiHandLandmarks[0]; // Use the first detected hand

        // --- Draw Landmarks ---
        // Ensure landmarks exist before drawing
        if (landmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 3 });
        }
        // ---

        // --- Pinch-to-Zoom ---
        if (landmarks && landmarks[4] && landmarks[8]) { // Check required landmarks exist
            const thumbTip = landmarks[4];  // THUMB_TIP
            const indexTip = landmarks[8];  // INDEX_FINGER_TIP

            // Calculate 2D distance (normalized screen coords)
            const dx = thumbTip.x - indexTip.x;
            const dy = thumbTip.y - indexTip.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Map distance to camera Z (larger distance = larger Z = zoom out)
            targetCameraZ = mapRange(distance, MIN_PINCH_DIST, MAX_PINCH_DIST, MIN_CAMERA_Z, MAX_CAMERA_Z);
            // Clamp just in case mapRange output is slightly off due to input clamping
            targetCameraZ = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, targetCameraZ));
        }


        // --- Swipe Detection ---
        if (landmarks && landmarks[0]) { // Check wrist landmark exists
            const now = Date.now();
            const wristX = landmarks[0].x; // Use wrist X for horizontal position

            if (lastHandX !== null) {
                const deltaX = wristX - lastHandX; // Check movement since last frame

                // Accumulate rightward movement
                if (deltaX > 0) { // Moving right
                    swipeAccumulatedDistance += deltaX;
                }
                // Reset if moving left significantly
                else if (deltaX < swipeResetThreshold) {
                    swipeAccumulatedDistance = 0;
                }

                // Check if swipe trigger distance is met
                if (swipeAccumulatedDistance > swipeTriggerDistance && now > lastPatternChangeTime + patternChangeCooldown) {
                     console.log("Swipe Right Detected!");
                     forcePatternChange();
                     lastPatternChangeTime = now; // Reset cooldown timer
                     swipeAccumulatedDistance = 0; // Reset swipe distance after triggering
                     lastHandX = null; // Force reset next frame to avoid re-trigger
                }
            }
             // Update last known X position only if not just swiped
             if (swipeAccumulatedDistance < swipeTriggerDistance) {
                lastHandX = wristX;
            }
        } else {
             // Reset swipe if landmarks disappear mid-swipe
             lastHandX = null;
             swipeAccumulatedDistance = 0;
        }


    } else {
        // No hand detected
        lastHandX = null;
        swipeAccumulatedDistance = 0;
        // Optional: Smoothly return to a default zoom?
        // targetCameraZ = mapRange(MAX_PINCH_DIST * 0.8, MIN_PINCH_DIST, MAX_PINCH_DIST, MIN_CAMERA_Z, MAX_CAMERA_Z); // Drift towards zoomed-out view
    }

    canvasCtx.restore(); // Restore canvas context
}

function setupHandTracking() {
    // Video and canvas elements are assigned in init()

    if (!videoElement || !canvasElement || !canvasCtx) {
        console.error("Video or Canvas element not ready for Hand Tracking setup.");
        return;
    }

    if (typeof Hands === 'undefined' || typeof Camera === 'undefined' || typeof drawConnectors === 'undefined' || typeof drawLandmarks === 'undefined') {
        console.error("MediaPipe Hands/Camera/Drawing library not found. Skipping hand tracking setup.");
        const instructions = document.getElementById('instructions');
        if(instructions) instructions.textContent = "Hand tracking library failed to load.";
        return;
    }

    try {
        hands = new Hands({locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }});

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.6, // Adjusted confidence
          minTrackingConfidence: 0.6
        });

        hands.onResults(onResults);

        const camera = new Camera(videoElement, {
          onFrame: async () => {
            // Ensure video is playing before sending frames
            if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or more
               await hands.send({image: videoElement});
            }
          },
          width: 640, // Internal processing resolution
          height: 360
        });

        camera.start()
          .then(() => console.log("Camera started successfully."))
          .catch(err => {
              console.error("Error starting webcam:", err);
              const instructions = document.getElementById('instructions');
              if(instructions) instructions.textContent = "Could not access webcam. Please grant permission and reload.";
          });

        console.log("Hand tracking setup complete.");

    } catch (error) {
        console.error("Error setting up MediaPipe Hands:", error);
        const instructions = document.getElementById('instructions');
        if(instructions) instructions.textContent = "Error initializing hand tracking.";
    }
}
// --- END: Updated Hand Tracking Functions ---


function startExperience() {
    if (typeof THREE === 'undefined') {
        console.error("THREE.js core library not found!");
        alert("Error: THREE.js library failed to load.");
        return;
    }
    init();
    if (renderer) {
        animate();
    } else {
         console.error("Renderer initialization failed. Animation cannot start.");
    }
}

// --- Start Execution ---
// Use DOMContentLoaded to ensure HTML is parsed and elements are available
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startExperience);
} else {
    // DOMContentLoaded has already fired
    startExperience();
}