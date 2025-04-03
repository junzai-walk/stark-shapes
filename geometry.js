// --- PATTERN FUNCTIONS ---
function createGrid(i, count) {
    const sideLength = Math.ceil(Math.cbrt(count));
    const spacing = 60 / sideLength;
    const halfGrid = (sideLength - 1) * spacing / 2;
    
    // Determine which side of the cube this particle should be on
    const totalSides = 6; // A cube has 6 sides
    const pointsPerSide = Math.floor(count / totalSides);
    const side = Math.floor(i / pointsPerSide);
    const indexOnSide = i % pointsPerSide;
    
    // Calculate a grid position on a 2D plane
    const sideLength2D = Math.ceil(Math.sqrt(pointsPerSide));
    const ix = indexOnSide % sideLength2D;
    const iy = Math.floor(indexOnSide / sideLength2D);
    
    // Map to relative coordinates (0 to 1)
    const rx = ix / (sideLength2D - 1 || 1);
    const ry = iy / (sideLength2D - 1 || 1);
    
    // Convert to actual coordinates with proper spacing (-halfGrid to +halfGrid)
    const x = rx * spacing * (sideLength - 1) - halfGrid;
    const y = ry * spacing * (sideLength - 1) - halfGrid;
    
    // Place on the appropriate face of the cube
    switch(side % totalSides) {
        case 0: return new THREE.Vector3(x, y, halfGrid); // Front face
        case 1: return new THREE.Vector3(x, y, -halfGrid); // Back face
        case 2: return new THREE.Vector3(x, halfGrid, y); // Top face
        case 3: return new THREE.Vector3(x, -halfGrid, y); // Bottom face
        case 4: return new THREE.Vector3(halfGrid, x, y); // Right face
        case 5: return new THREE.Vector3(-halfGrid, x, y); // Left face
        default: return new THREE.Vector3(0, 0, 0);
    }
}

function createSphere(i, count) {
    // Sphere distribution using spherical coordinates for surface only
    const t = i / count;
    const phi = Math.acos(2 * t - 1); // Full range from 0 to PI
    const theta = 2 * Math.PI * (i / count) * Math.sqrt(count); // Golden ratio distribution
    
    // Fixed radius for surface-only distribution
    const radius = 30;
    
    return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.sin(phi) * Math.sin(theta) * radius,
        Math.cos(phi) * radius
    );
}

function createSpiral(i, count) {
    const t = i / count;
    const numArms = 3;
    const armIndex = i % numArms;
    const angleOffset = (2 * Math.PI / numArms) * armIndex;
    const angle = Math.pow(t, 0.7) * 15 + angleOffset;
    const radius = t * 40;
    
    // This is a 2D shape with particles on a thin plane by design 
    const height = 0; // Set to zero or a very small noise value for thickness
    
    return new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        height
    );
}

function createHelix(i, count) {
    const numHelices = 2;
    const helixIndex = i % numHelices;
    const t = Math.floor(i / numHelices) / Math.floor(count / numHelices);
    const angle = t * Math.PI * 10;
    
    // Fixed radius for surface-only distribution
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
    // Torus parameters
    const R = 30; // Major radius (distance from center of tube to center of torus)
    const r = 10; // Minor radius (radius of the tube)
    
    // Use a uniform distribution on the torus surface
    // by using uniform sampling in the 2 angle parameters
    const u = (i / count) * 2 * Math.PI; // Angle around the center of the torus
    const v = (i * Math.sqrt(5)) * 2 * Math.PI; // Angle around the tube
    
    // Parametric equation of a torus
    return new THREE.Vector3(
        (R + r * Math.cos(v)) * Math.cos(u),
        (R + r * Math.cos(v)) * Math.sin(u),
        r * Math.sin(v)
    );
}

function createVortex(i, count) {
    // Vortex parameters
    const height = 60;        // Total height of the vortex
    const maxRadius = 35;     // Maximum radius at the top
    const minRadius = 5;      // Minimum radius at the bottom
    const numRotations = 3;   // Number of full rotations from top to bottom
    
    // Calculate normalized height position (0 = bottom, 1 = top)
    const t = i / count;
    
    // Add some randomness to distribute particles more naturally
    const randomOffset = 0.05 * Math.random();
    const heightPosition = t + randomOffset;
    
    // Calculate radius that decreases from top to bottom
    const radius = minRadius + (maxRadius - minRadius) * heightPosition;
    
    // Calculate angle with more rotations at the bottom
    const angle = numRotations * Math.PI * 2 * (1 - heightPosition) + (i * 0.1);
    
    // Calculate the vertical position (from bottom to top)
    const y = (heightPosition - 0.5) * height;
    
    return new THREE.Vector3(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
    );
}

function createGalaxy(i, count) {
    // Galaxy parameters
    const numArms = 4;            // Number of spiral arms
    const armWidth = 0.15;        // Width of each arm (0-1)
    const maxRadius = 40;         // Maximum radius of the galaxy
    const thickness = 5;          // Vertical thickness
    const twistFactor = 2.5;      // How much the arms twist
    
    // Determine which arm this particle belongs to
    const armIndex = i % numArms;
    const indexInArm = Math.floor(i / numArms) / Math.floor(count / numArms);
    
    // Calculate radial distance from center
    const radialDistance = indexInArm * maxRadius;
    
    // Add some randomness for arm width
    const randomOffset = (Math.random() * 2 - 1) * armWidth;
    
    // Calculate angle with twist that increases with distance
    const armOffset = (2 * Math.PI / numArms) * armIndex;
    const twistAmount = twistFactor * indexInArm;
    const angle = armOffset + twistAmount + randomOffset;
    
    // Add height variation that decreases with distance from center
    const verticalPosition = (Math.random() * 2 - 1) * thickness * (1 - indexInArm * 0.8);
    
    return new THREE.Vector3(
        Math.cos(angle) * radialDistance,
        verticalPosition,
        Math.sin(angle) * radialDistance
    );
}

function createWave(i, count) {
    // Wave/ocean parameters
    const width = 60;       // Total width of the wave field
    const depth = 60;       // Total depth of the wave field
    const waveHeight = 10;  // Maximum height of waves
    const waveDensity = 0.1; // Controls wave frequency
    
    // Create a grid of points (similar to your grid function but for a 2D plane)
    const gridSize = Math.ceil(Math.sqrt(count));
    const spacingX = width / gridSize;
    const spacingZ = depth / gridSize;
    
    // Calculate 2D grid position
    const ix = i % gridSize;
    const iz = Math.floor(i / gridSize);
    
    // Convert to actual coordinates with proper spacing
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const x = ix * spacingX - halfWidth;
    const z = iz * spacingZ - halfDepth;
    
    // Create wave pattern using multiple sine waves for a more natural look
    // We use the x and z coordinates to create a position-based wave pattern
    const y = Math.sin(x * waveDensity) * Math.cos(z * waveDensity) * waveHeight +
              Math.sin(x * waveDensity * 2.5) * Math.cos(z * waveDensity * 2.1) * (waveHeight * 0.3);
    
    return new THREE.Vector3(x, y, z);
}

function createMobius(i, count) {
    // Möbius strip parameters
    const radius = 25;       // Major radius of the strip
    const width = 10;        // Width of the strip
    
    // Distribute points evenly along the length of the Möbius strip
    // and across its width
    const lengthSteps = Math.sqrt(count);
    const widthSteps = count / lengthSteps;
    
    // Calculate position along length and width of strip
    const lengthIndex = i % lengthSteps;
    const widthIndex = Math.floor(i / lengthSteps) % widthSteps;
    
    // Normalize to 0-1 range
    const u = lengthIndex / lengthSteps;        // Position around the strip (0 to 1)
    const v = (widthIndex / widthSteps) - 0.5;  // Position across width (-0.5 to 0.5)
    
    // Parametric equations for Möbius strip
    const theta = u * Math.PI * 2;  // Full loop around
    
    // Calculate the Möbius strip coordinates
    // This creates a half-twist in the strip
    const x = (radius + width * v * Math.cos(theta / 2)) * Math.cos(theta);
    const y = (radius + width * v * Math.cos(theta / 2)) * Math.sin(theta);
    const z = width * v * Math.sin(theta / 2);
    
    return new THREE.Vector3(x, y, z);
}

function createSupernova(i, count) {
    // Supernova parameters
    const maxRadius = 40;        // Maximum explosion radius
    const coreSize = 0.2;        // Size of the dense core (0-1)
    const outerDensity = 0.7;    // Density of particles in outer shell
    
    // Use golden ratio distribution for even spherical coverage
    const phi = Math.acos(1 - 2 * (i / count));
    const theta = Math.PI * 2 * i * (1 + Math.sqrt(5));
    
    // Calculate radial distance with more particles near center and at outer shell
    let normalizedRadius;
    const random = Math.random();
    
    if (i < count * coreSize) {
        // Dense core - distribute within inner radius
        normalizedRadius = Math.pow(random, 0.5) * 0.3;
    } else {
        // Explosion wave - distribute with more particles at the outer shell
        normalizedRadius = 0.3 + Math.pow(random, outerDensity) * 0.7;
    }
    
    // Scale to max radius
    const radius = normalizedRadius * maxRadius;
    
    // Convert spherical to Cartesian coordinates
    return new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.sin(phi) * Math.sin(theta) * radius,
        Math.cos(phi) * radius
    );
}