// --- START: Added Hand Tracking Variables ---
let hands;
let handDetected = false;
let targetCameraZ = 100; // Target Z position for smooth zoom
const MIN_CAMERA_Z = 40;
const MAX_CAMERA_Z = 250;
let lastPatternChangeTime = 0;
const patternChangeCooldown = 2000; // Milliseconds cooldown for pattern change
// --- END: Added Hand Tracking Variables ---


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

// --- PATTERN FUNCTIONS (Sphere, Spiral, Grid, Helix, Torus) ---
// ... (keep existing pattern functions) ...
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
// ... (keep existing function) ...
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
// ... (keep existing palettes) ...
const colorPalettes = [
    [ new THREE.Color(0x0077ff), new THREE.Color(0x00aaff), new THREE.Color(0x44ccff), new THREE.Color(0x0055cc) ],
    [ new THREE.Color(0x8800cc), new THREE.Color(0xcc00ff), new THREE.Color(0x660099), new THREE.Color(0xaa33ff) ],
    [ new THREE.Color(0x00cc66), new THREE.Color(0x33ff99), new THREE.Color(0x99ff66), new THREE.Color(0x008844) ],
    [ new THREE.Color(0xff9900), new THREE.Color(0xffcc33), new THREE.Color(0xff6600), new THREE.Color(0xffaa55) ],
    [ new THREE.Color(0xff3399), new THREE.Color(0xff66aa), new THREE.Color(0xff0066), new THREE.Color(0xcc0055) ]
];

// --- PARTICLE SYSTEM ---
// ... (keep existing function) ...
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
// ... (keep existing function) ...
function initPostProcessing() {
    // Check if THREE objects exist before using them
    if (typeof THREE.EffectComposer === 'undefined' ||
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
    // camera.position.z = 100; // Initial position set via targetCameraZ now
    camera.position.z = targetCameraZ;


    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    // renderer.setClearColor(0x000000, 0); // Make background transparent if using CSS background

    const container = document.getElementById('container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        console.error("HTML element with id 'container' not found!");
        return; // Stop initialization if container is missing
    }

    particles = createParticleSystem();
    scene.add(particles);

    // Initialize post-processing
    initPostProcessing(); // Call after renderer is created

    // Add event listeners
    window.addEventListener('resize', onWindowResize);

    initGUI(); // Initialize dat.GUI controls
    updatePatternName(patternNames[currentPattern], true); // Show initial pattern name instantly

    // --- START: Added Hand Tracking Setup Call ---
    setupHandTracking();
    // --- END: Added Hand Tracking Setup Call ---
}


// --- WINDOW RESIZE ---
// ... (keep existing function) ...
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
}


// --- PATTERN CHANGE / TRANSITION ---
// ... (keep existing functions: forcePatternChange, completeCurrentTransition, updatePatternName, transitionToPattern) ...
function forcePatternChange() {
    if (isTransitioning) {
        completeCurrentTransition(); // Finish current transition instantly
    }
    const nextPattern = (currentPattern + 1) % patterns.length;
    transitionToPattern(nextPattern);
    updatePatternName(patternNames[nextPattern]); // Show name briefly
}

function completeCurrentTransition() {
    if (!isTransitioning || !particles || !particles.userData.toPositions || !particles.userData.toColors) {
        // Clear transition state if data is missing
        isTransitioning = false;
        transitionProgress = 0;
        delete particles?.userData?.fromPositions;
        delete particles?.userData?.toPositions;
        delete particles?.userData?.fromColors;
        delete particles?.userData?.toColors;
        return;
    }

    const positions = particles.geometry.attributes.position.array;
    const colors = particles.geometry.attributes.color.array;

    // Ensure arrays are valid before setting
    if (positions.length === particles.userData.toPositions.length &&
        colors.length === particles.userData.toColors.length) {
        positions.set(particles.userData.toPositions);
        colors.set(particles.userData.toColors);
        particles.geometry.userData.currentColors = new Float32Array(particles.userData.toColors); // Update stored colors
        particles.geometry.attributes.position.needsUpdate = true;
        particles.geometry.attributes.color.needsUpdate = true;
        currentPattern = particles.userData.targetPattern; // Update current pattern index
    } else {
      console.error("Transition data length mismatch on completion!");
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


const clock = new THREE.Clock();

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    if (!renderer || !camera || !scene) return; // Check if core components exist

    const deltaTime = clock.getDelta();
    time += deltaTime; // Update global time

    // --- Particle Update ---
    // ... (keep existing particle update logic, including transitions) ...
    if (particles && particles.geometry && particles.geometry.attributes.position) {
        const positions = particles.geometry.attributes.position.array;
        const count = params.particleCount;

        //Apply wave motion (if not transitioning)
        //Removed wave motion during transition for smoother effect
        if (!isTransitioning) {
            for (let i = 0; i < count; i++) {
                const idx = i * 3;
                const noise1 = Math.sin(time * 0.5 + i * 0.01) * params.waveIntensity;
                const noise2 = Math.cos(time * 0.3 + i * 0.02) * params.waveIntensity;
                // Apply noise only if not transitioning
                positions[idx] += noise1 * deltaTime * 5; // Scale by deltaTime for frame rate independence
                positions[idx + 1] += noise2 * deltaTime * 5;
                // Keep Z noise minimal or remove if it interferes with shape
                // positions[idx + 2] += noise3 * deltaTime * 5;
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
                // Ease-in-out cubic easing function
                const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                // Check array lengths before interpolation (safety check)
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
                    // Keep currentColors updated during transition for potential restarts
                     particles.geometry.userData.currentColors = new Float32Array(colors);

                } else {
                    console.error("Transition data length mismatch during interpolation!");
                    completeCurrentTransition(); // Attempt to recover by completing
                }
            }
        }
    } // End particle update check


    // --- Camera Movement ---
    // Base rotation still happens, but Z position (zoom) is controlled by hand / targetCameraZ
    const baseRadius = 100; // Use a base radius for X/Z orbit calculation
    // const radiusVariation = Math.sin(time * 0.1) * 15; // Remove time-based radius variation
    // const cameraRadius = baseRadius + radiusVariation; // Use baseRadius for orbit X/Z
    const angleX = time * params.cameraSpeed;
    const angleY = time * (params.cameraSpeed * 0.75); // Slower vertical oscillation

    // --- START: Modified Camera Logic ---
    // Smoothly interpolate current camera Z towards the target Z set by hand tracking
    const zoomSpeed = 0.05; // Adjust for faster/slower zoom transition
    camera.position.z += (targetCameraZ - camera.position.z) * zoomSpeed;

    // Update X position based on the *current* Z distance to maintain orbit perspective
    camera.position.x = Math.cos(angleX) * camera.position.z; // Use current Z for X calc
    // Keep Y oscillation independent of zoom for now
    camera.position.y = Math.sin(angleY) * 35 + 5;
    // Z position is now managed by interpolation towards targetCameraZ

    camera.lookAt(0, 0, 0); // Always look at the center
    // --- END: Modified Camera Logic ---


    // --- Rendering ---
    if (composer) {
        composer.render(deltaTime);
    } else {
        renderer.render(scene, camera);
    }
}

// --- DAT.GUI ---
// ... (keep existing function) ...
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
        // animFolder.open(); // Keep closed by default

        // --- Visual Parameters ---
        const visualFolder = gui.addFolder('Visual');
        visualFolder.add(params, 'particleSize', 0.1, 10, 0.1).onChange(function(value) {
            if (particles && particles.material) {
                particles.material.size = value;
            }
        }).name('Particle Size');
        // visualFolder.open(); // Keep closed by default

        // --- Post-Processing Parameters ---
        // Only add if post-processing is potentially active
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
            // ppFolder.open(); // Keep closed by default
        }


        // --- Pattern Controls ---
        gui.add(params, 'changePattern').name('Next Pattern');

        // Add GUI styling (optional)
        const guiElement = document.querySelector('.dg.ac'); // Main GUI container
        if (guiElement) {
            guiElement.style.zIndex = "1000"; // Ensure GUI is above other elements
        }

    } catch (error) {
        console.error("Error initializing dat.GUI:", error);
        if(gui) gui.destroy(); // Clean up partial GUI if error occurred
        gui = null;
    }
}


// --- START: Added Hand Tracking Functions ---

function onResults(results) {
    // Optional: Draw landmarks for debugging
    // const canvasCtx = document.querySelector('.output_canvas').getContext('2d');
    // const canvasElement = document.querySelector('.output_canvas');
    // canvasCtx.save();
    // canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // // Draw landmarks
    // if (results.multiHandLandmarks) {
    //   for (const landmarks of results.multiHandLandmarks) {
    //     drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
    //     drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 2});
    //   }
    // }
    // canvasCtx.restore();

    handDetected = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;

    if (handDetected) {
        const landmarks = results.multiHandLandmarks[0]; // Use the first detected hand

        // --- Zoom Control (Vertical Position) ---
        // Use wrist or palm base landmark Y coordinate (0 = top, 1 = bottom)
        const wristY = landmarks[0].y; // Landmark 0 is WRIST
        // Map the Y coordinate (0 to 1) to the camera Z range
        // Invert Y because lower hand means closer (smaller Z)
        targetCameraZ = MIN_CAMERA_Z + (1 - wristY) * (MAX_CAMERA_Z - MIN_CAMERA_Z);
        // Clamp the value to the defined range
        targetCameraZ = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, targetCameraZ));


        // --- Pattern Change Gesture (Index Finger Pointing Up) ---
        const now = Date.now();
        if (now > lastPatternChangeTime + patternChangeCooldown) {
            const indexTip = landmarks[8]; // INDEX_FINGER_TIP
            const indexPip = landmarks[6]; // INDEX_FINGER_PIP
            const middleTip = landmarks[12]; // MIDDLE_FINGER_TIP
            const ringTip = landmarks[16]; // RING_FINGER_TIP
            const pinkyTip = landmarks[20]; // PINKY_TIP

            // Check if index finger tip is significantly higher (lower Y value) than its own PIP joint
            // and also higher than the tips of the other non-thumb fingers.
            const isPointingUp =
                indexTip.y < indexPip.y - 0.05 && // Index tip above PIP
                indexTip.y < middleTip.y - 0.03 && // Index tip above middle tip
                indexTip.y < ringTip.y - 0.03 &&   // Index tip above ring tip
                indexTip.y < pinkyTip.y - 0.03;   // Index tip above pinky tip

            if (isPointingUp) {
                console.log("Pattern Change Gesture Detected!");
                forcePatternChange();
                lastPatternChangeTime = now; // Reset cooldown timer
            }
        }

    } else {
        // Optional: Slowly drift back to default zoom if no hand is detected
        // targetCameraZ = 100;
    }
}

function setupHandTracking() {
    const videoElement = document.querySelector('.input_video');
    // const canvasElement = document.querySelector('.output_canvas');
    // const canvasCtx = canvasElement.getContext('2d');

    // Check if MediaPipe components are loaded
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
        console.error("MediaPipe Hands or Camera library not found. Skipping hand tracking setup.");
        const instructions = document.getElementById('instructions');
        if(instructions) instructions.textContent = "Hand tracking library failed to load.";
        return;
    }

    hands = new Hands({locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
      maxNumHands: 1, // Detect only one hand for simplicity
      modelComplexity: 1, // 0, 1, or 2. Higher = more accurate but slower.
      minDetectionConfidence: 0.6, // Increased confidence
      minTrackingConfidence: 0.6
    });

    hands.onResults(onResults);

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({image: videoElement});
      },
      width: 640, // Lower resolution for better performance
      height: 360
    });

    camera.start()
      .catch(err => {
          console.error("Error starting webcam:", err);
          const instructions = document.getElementById('instructions');
          if(instructions) instructions.textContent = "Could not access webcam. Please grant permission.";
      });

    console.log("Hand tracking setup complete.");
}
// --- END: Added Hand Tracking Functions ---


function startExperience() {
    // Check for essential THREE object
    if (typeof THREE === 'undefined') {
        console.error("THREE.js core library not found!");
        alert("Error: THREE.js library failed to load. Please check your network connection or the script inclusions.");
        return;
    }
    init(); // Initialize scene, renderer, etc.
    if (renderer) { // Only start animation if renderer was successfully created
        animate(); // Start the animation loop
    } else {
         console.error("Renderer initialization failed. Animation cannot start.");
    }
}

// --- Start Execution ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startExperience);
} else {
    startExperience();
}