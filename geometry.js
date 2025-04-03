// Updated pattern functions that place particles only on surfaces

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

const patterns = [createGrid, createSphere, createSpiral, createHelix, createTorus];