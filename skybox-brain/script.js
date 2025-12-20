import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Scene setup
let scene, camera, renderer, controls;
let composer; // Post-processing for bloom effects

// Constants
const SKY_RADIUS = 500;
const NUM_CURVES = 14; // Not used, only for reference
const CURVE_POINTS = 12; // Points per curved path
const CURVE_NOISE = 40; // Randomness in paths
const TUBE_RADIUS = 2.2; // Thickness of axon tubes
const TUBE_SEGMENTS = 80; // Segments per tube

// Pulse settings
const PULSES_PER_CURVE = 3;
const PULSE_SPEED_MIN = 0.04;
const PULSE_SPEED_MAX = 0.13;
const PULSE_SIZE = 1.5;

// Burst settings
const MAX_BURSTS = 40;
const BURST_LIFETIME = 0.8; // seconds
const BURST_MIN_SCALE = 4;
const BURST_MAX_SCALE = 14;
const BURSTS_PER_SECOND = 10;

// Scene object arrays
const curves = []; // Axon path curves
const curveMeshes = []; // Axon tube meshes
const neurons = []; // Neuron data
const pulses = []; // Active pulses
const bursts = []; // Active bursts
const nucleusMeshes = []; // For hover detection
const somaMeshes = []; // For hover detection
const pulseMeshes = []; // For hover detection
const burstSprites = []; // For hover detection

// State variables
let burstAccumulator = 0;
let burstTexture = null;
let lastTime = performance.now() / 1000;

// Mouse controls
let isDragging = false;
let prevMouseX = 0;
let prevMouseY = 0;
let yaw = 0; // Horizontal rotation
let pitch = 0; // Vertical rotation

// Hover detection
let raycaster = null;
let mouse = new THREE.Vector2(); // Normalized coordinates (-1 to 1)
let hoveredNucleus = null;
let mouseEvent = null;

init();
animate();

function init() {
  scene = new THREE.Scene();

  // Create perspective camera with 60 degree field of view
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(0, 0, 0); // Start at center of skybox

  // Create WebGL renderer with antialiasing
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ReinhardToneMapping; // Better color handling
  renderer.toneMappingExposure = 1.4; // Brightness adjustment
  document.body.appendChild(renderer.domElement);

  // Post-processing setup for glow/bloom effect
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.6, // Bloom strength
    0.4, // Bloom radius
    0.0  // Bloom threshold
  );
  composer.addPass(renderPass);
  composer.addPass(bloomPass);

  // Create black skybox sphere (rendered inside-out)
  const skyGeo = new THREE.SphereGeometry(SKY_RADIUS, 64, 64);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.BackSide // Render inside of sphere
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Add ambient and directional lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.15); // Soft overall light
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.25); // Directional light source
  dir.position.set(50, 80, 40);
  scene.add(dir);

  // Setup camera controls (only zoom enabled, rotation handled manually)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; // Smooth zoom
  controls.enablePan = false; // Disable panning
  controls.enableRotate = false; // Disable rotation (we handle it manually)
  controls.dampingFactor = 0.05; // Zoom damping amount

  raycaster = new THREE.Raycaster(); // Initialize hover detection

  // Create scene elements
  createNeuronCurves(); // Create all neurons and connections
  createPulsesOnCurves(); // Create pulses on all pathways
  burstTexture = createBurstTexture(); // Create texture for synapse bursts

  // Mouse event listeners
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left mouse button
    isDragging = true;
    prevMouseX = e.clientX; // Store initial position
    prevMouseY = e.clientY;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false; // Stop dragging
  });

  window.addEventListener('mousemove', (e) => {
    // Always update mouse coordinates for hover detection
    mouseEvent = e;
    // Convert screen coordinates to normalized device coordinates (-1 to 1)
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    if (!isDragging) return; // Only rotate camera when dragging

    // Calculate mouse movement delta
    const dx = e.clientX - prevMouseX;
    const dy = e.clientY - prevMouseY;
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    const sensitivity = 0.003; // Rotation sensitivity
    yaw -= dx * sensitivity; // Rotate horizontally
    pitch -= dy * sensitivity; // Rotate vertically

    // Prevent camera from flipping upside down
    const limit = Math.PI / 2 - 0.1;
    pitch = Math.max(-limit, Math.min(limit, pitch));
  });

  window.addEventListener('resize', onWindowResize);
}

// Helper functions
function randomDirection() {
  // Generate a random normalized 3D direction vector
  const v = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  );
  return v.normalize();
}

function randomPointInSphere(radius) {
  // Generate a random point inside a sphere using spherical coordinates
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u; // Azimuth angle
  const phi = Math.acos(2 * v - 1); // Polar angle
  const r = radius * Math.cbrt(Math.random()); // Cube root for uniform distribution
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta),
    r * Math.cos(phi)
  );
}

function createBurstTexture() {
  // Create a circular gradient texture for synapse burst sprites
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Create radial gradient from white center to transparent edges
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)'); // White center
  grd.addColorStop(0.3, 'rgba(255,255,255,0.9)'); // Slightly transparent
  grd.addColorStop(1.0, 'rgba(255,255,255,0)'); // Fully transparent edges

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

// Neuron creation
function createCompleteNeuron(somaPosition) {
  const neuronGroup = new THREE.Group(); // Group to hold all neuron parts
  const somaSize = 8 + Math.random() * 4; // Random size between 8-12

  // Create soma (cell body) as a 7-sided polygonal sphere (heptagon)
  const somaGeo = new THREE.SphereGeometry(somaSize, 7, 4); // 7 width segments, 4 height segments
  const somaMat = new THREE.MeshBasicMaterial({
    color: 0x440088, // Purple color
    transparent: true,
    opacity: 0.3, // Semi-transparent so nucleus is visible
    depthWrite: false // Allow objects behind to show through
  });
  const soma = new THREE.Mesh(somaGeo, somaMat);
  neuronGroup.add(soma);
  soma.userData.isSoma = true; // Mark for hover detection
  somaMeshes.push(soma);

  // Add black outline to heptagon edges
  const edgesGeo = new THREE.EdgesGeometry(somaGeo); // Extract edges from geometry
  const edgesMat = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 2,
    transparent: true,
    opacity: 0.8
  });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  neuronGroup.add(edges);

  // Create nucleus (red sphere inside soma)
  const nucleusSize = somaSize * 0.6; // 60% of soma size
  const nucleusGeo = new THREE.SphereGeometry(nucleusSize, 16, 16);
  const nucleusMat = new THREE.MeshBasicMaterial({
    color: 0xff3333, // Bright red
    transparent: false,
    opacity: 1.0
  });
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
  nucleus.position.set(0, 0, 0); // Center of neuron group
  nucleus.renderOrder = 2; // Render after soma
  neuronGroup.add(nucleus);
  nucleus.userData.isNucleus = true; // Mark for hover detection
  nucleusMeshes.push(nucleus);

  // Extract vertices from heptagon for axon connection points
  const positions = somaGeo.attributes.position;
  const vertexPositions = [];
  const vertexMap = new Map(); // Use Map to avoid duplicate vertices

  // Collect unique vertex positions
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`; // Create unique key
    
    if (!vertexMap.has(key)) {
      vertexMap.set(key, new THREE.Vector3(x, y, z));
      vertexPositions.push(new THREE.Vector3(x, y, z));
    }
  }

  // Sort vertices by distance from center to get the most outward ones
  const center = new THREE.Vector3(0, 0, 0);
  const sortedVertices = vertexPositions
    .map(v => ({ pos: v, dist: v.distanceTo(center) }))
    .sort((a, b) => b.dist - a.dist); // Sort descending (furthest first)

  // Take the 7 most outward vertices (one per side of heptagon)
  const numVerticesToUse = Math.min(7, sortedVertices.length);
  const selectedVertices = sortedVertices.slice(0, numVerticesToUse);

  // Store neuron data for creating connections later
  const neuronData = {
    position: somaPosition,
    vertices: selectedVertices.map(v => v.pos.clone()), // Clone vertices
    group: neuronGroup,
    somaSize: somaSize
  };
  neurons.push(neuronData);

  // Position the entire neuron group in the scene
  neuronGroup.position.copy(somaPosition);
  scene.add(neuronGroup);
  return neuronGroup;
}

function createCurveFromPoint(start, direction, length = SKY_RADIUS * 0.5) {
  // Create a curved path from a starting point in a given direction
  const points = [];
  let current = start.clone();
  const segmentLength = length / CURVE_POINTS; // Length of each segment

  // Generate points along the curve with some randomness
  for (let j = 0; j < CURVE_POINTS; j++) {
    // Add random noise to make path organic-looking
    const noise = new THREE.Vector3(
      (Math.random() - 0.5) * CURVE_NOISE * 0.7,
      (Math.random() - 0.5) * CURVE_NOISE * 0.7,
      (Math.random() - 0.5) * CURVE_NOISE * 0.7
    );
    points.push(current.clone().add(noise));
    
    // Vary direction slightly for natural curve
    const dirVariation = randomDirection().multiplyScalar(0.2);
    const nextDir = direction.clone().add(dirVariation).normalize();
    current.add(nextDir.multiplyScalar(segmentLength));
  }

  // Create smooth curve through all points
  return new THREE.CatmullRomCurve3(points);
}

function createNeuronCurves() {
  // Clear previous data
  curves.length = 0;
  curveMeshes.length = 0;
  neurons.length = 0;

  // Create neurons in a 3D grid pattern for even distribution
  const numNeurons = 125;
  const gridSize = Math.ceil(Math.cbrt(numNeurons)); // Cube root for 3D grid
  const spacing = (SKY_RADIUS * 0.6) / gridSize; // Calculate spacing between neurons
  
  let neuronIndex = 0;
  // Create neurons in a 3D grid
  for (let x = 0; x < gridSize && neuronIndex < numNeurons; x++) {
    for (let y = 0; y < gridSize && neuronIndex < numNeurons; y++) {
      for (let z = 0; z < gridSize && neuronIndex < numNeurons; z++) {
        // Calculate position in grid (centered around origin)
        const somaPos = new THREE.Vector3(
          (x - gridSize / 2) * spacing,
          (y - gridSize / 2) * spacing,
          (z - gridSize / 2) * spacing
        );
        createCompleteNeuron(somaPos);
        neuronIndex++;
      }
    }
  }

  // After all neurons are created, connect them with axons
  createNeuralConnections();
}

function createNeuralConnections() {
  // Connect each vertex of each neuron to another neuron's vertex
  const connectedVertices = new Set(); // Track which vertices are already connected
  
  for (let i = 0; i < neurons.length; i++) {
    const neuron = neurons[i];
    
    // For each vertex on this neuron
    for (const vertex of neuron.vertices) {
      // Calculate world position of vertex on soma surface
      const normalizedVertex = vertex.clone().normalize();
      const worldPos = normalizedVertex.multiplyScalar(neuron.somaSize).add(neuron.position);
      const vertexKey = `${i}-${neuron.vertices.indexOf(vertex)}`; // Unique identifier
      
      // Find nearest vertex from any other neuron to connect to
      let nearestNeuron = null;
      let nearestDistance = Infinity;
      let nearestVertex = null;
      let nearestVertexIndex = -1;
      let nearestNeuronIndex = -1;
      
      // Search through all other neurons
      for (let j = 0; j < neurons.length; j++) {
        if (i === j) continue; // Skip self
        
        const otherNeuron = neurons[j];
        // Check all vertices on this other neuron
        for (let k = 0; k < otherNeuron.vertices.length; k++) {
          const otherVertex = otherNeuron.vertices[k];
          // Calculate world position of other vertex
          const normalizedOtherVertex = otherVertex.clone().normalize();
          const otherVertexWorldPos = normalizedOtherVertex.multiplyScalar(otherNeuron.somaSize).add(otherNeuron.position);
          const vertexDist = worldPos.distanceTo(otherVertexWorldPos);
          const otherVertexKey = `${j}-${k}`;
          const isOtherConnected = connectedVertices.has(otherVertexKey);
          
          // Prefer connecting unconnected vertices
          if (vertexDist < nearestDistance) {
            if (!connectedVertices.has(vertexKey) && !isOtherConnected) {
              // Both unconnected - best case
              nearestDistance = vertexDist;
              nearestNeuron = otherNeuron;
              nearestVertex = otherVertex;
              nearestVertexIndex = k;
              nearestNeuronIndex = j;
            } else if (nearestNeuron === null || (!connectedVertices.has(vertexKey) && isOtherConnected)) {
              // Current vertex unconnected - connect to anything
              nearestDistance = vertexDist;
              nearestNeuron = otherNeuron;
              nearestVertex = otherVertex;
              nearestVertexIndex = k;
              nearestNeuronIndex = j;
            }
          }
        }
      }
      
      // Create tube connection if we found a nearby neuron
      if (nearestNeuron && nearestDistance < SKY_RADIUS * 0.5) {
        // Calculate connection path
        const normalizedNearestVertex = nearestVertex.clone().normalize();
        const targetPos = normalizedNearestVertex.multiplyScalar(nearestNeuron.somaSize).add(nearestNeuron.position);
        const direction = targetPos.clone().sub(worldPos).normalize();
        const connectionLength = worldPos.distanceTo(targetPos);
        
        // Create curve and tube mesh for the connection
        const connectionCurve = createCurveFromPoint(worldPos, direction, connectionLength);
        curves.push(connectionCurve); // Store for pulses to travel along
        
        // Create tube geometry with hexagonal cross-section
        const tubeGeo = new THREE.TubeGeometry(connectionCurve, TUBE_SEGMENTS, TUBE_RADIUS * 0.5, 6, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: 0x440066,
          transparent: true,
          opacity: 0.5
        });
        
        const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
        scene.add(tubeMesh);
        curveMeshes.push(tubeMesh);
        tubeMesh.userData.isAxon = true; // Mark for hover detection
        
        // Mark both vertices as connected
        connectedVertices.add(vertexKey);
        connectedVertices.add(`${nearestNeuronIndex}-${nearestVertexIndex}`);
      }
    }
  }
}

// Pulses
function createPulsesOnCurves() {
  // Create cyan pulse spheres that travel along axon pathways
  const pulseGeo = new THREE.SphereGeometry(PULSE_SIZE, 16, 16);

  // Create pulses for each curve (axon pathway)
  for (let i = 0; i < curves.length; i++) {
    const curve = curves[i];
    // Create multiple pulses per curve
    for (let j = 0; j < PULSES_PER_CURVE; j++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00faff, // Cyan color
        transparent: true,
        opacity: 0.6
      });

      const mesh = new THREE.Mesh(pulseGeo, mat);
      const t0 = Math.random(); // Random starting position along curve (0 to 1)
      mesh.position.copy(curve.getPoint(t0)); // Position at random point on curve

      // Random speed for each pulse
      const speed = PULSE_SPEED_MIN + Math.random() * (PULSE_SPEED_MAX - PULSE_SPEED_MIN);
      const flickerPhase = Math.random() * Math.PI * 2; // Random phase for flicker animation

      scene.add(mesh);
      mesh.userData.isPulse = true; // Mark for hover detection
      pulseMeshes.push(mesh);

      // Store pulse data for animation
      pulses.push({
        mesh,
        curve,
        t: t0, // Current position along curve (0 to 1)
        speed,
        flickerPhase
      });
    }
  }
}

// Synapse bursts
function createBurst() {
  // Create a glowing sprite at a random position on a random axon
  if (!curves.length || !burstTexture) return null;

  // Pick random curve and random position along it
  const curve = curves[Math.floor(Math.random() * curves.length)];
  const t = Math.random();
  const pos = curve.getPoint(t);

  // Create sprite material with glow effect
  const mat = new THREE.SpriteMaterial({
    map: burstTexture, // Use gradient texture
    color: new THREE.Color(0x00faff), // Cyan color
    transparent: true,
    blending: THREE.AdditiveBlending, // Makes it glow
    depthWrite: false
  });

  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(pos);
  sprite.scale.setScalar(BURST_MIN_SCALE); // Start small
  scene.add(sprite);
  sprite.userData.isBurst = true; // Mark for hover detection
  burstSprites.push(sprite);

  return {
    sprite,
    life: BURST_LIFETIME // Time until it disappears
  };
}

// Animation loop
function animate() {
  requestAnimationFrame(animate); // Continue animation loop

  // Calculate time delta for frame-independent movement
  const now = performance.now() / 1000;
  const dt = now - lastTime;
  lastTime = now;

  // Update pulses - move them along their curves
  for (const p of pulses) {
    p.t += p.speed * dt; // Advance position along curve
    if (p.t > 1) p.t -= 1; // Loop back to start when reaching end

    // Update pulse position
    const pos = p.curve.getPoint(p.t);
    p.mesh.position.copy(pos);

    // Create flickering effect using sine wave
    const flicker = 0.75 + 0.25 * Math.sin(now * 8 + p.flickerPhase);
    p.mesh.scale.setScalar(flicker); // Scale up and down
    p.mesh.material.opacity = 0.3 + 0.3 * flicker; // Fade in and out
  }

  // Hover detection - check what object mouse is over
  if (raycaster && mouseEvent) {
    // Cast ray from camera through mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Check intersections with all hoverable objects
    const somaIntersects = raycaster.intersectObjects(somaMeshes, false);
    const nucleusIntersects = raycaster.intersectObjects(nucleusMeshes, false);
    const axonIntersects = raycaster.intersectObjects(curveMeshes, false);
    const pulseIntersects = raycaster.intersectObjects(pulseMeshes, false);
    const burstIntersects = raycaster.intersectObjects(burstSprites, false);
    
    const tooltip = document.getElementById('tooltip');
    
    // Show tooltip based on priority (nucleus > soma > axon > pulse > burst)
    if (nucleusIntersects.length > 0) {
      hoveredNucleus = nucleusIntersects[0].object;
      if (tooltip) {
        tooltip.innerHTML = '<strong>Nucleus</strong><br>The nucleus is the control center of the neuron. It contains the cell\'s DNA and regulates gene expression, protein synthesis, and overall cellular function. It coordinates the neuron\'s activities and maintains its genetic information.';
        tooltip.style.display = 'block';
        tooltip.style.left = mouseEvent.clientX + 10 + 'px';
        tooltip.style.top = mouseEvent.clientY + 10 + 'px';
      }
    } else if (somaIntersects.length > 0) {
      hoveredNucleus = somaIntersects[0].object;
      if (tooltip) {
        tooltip.innerHTML = '<strong>Soma (Cell Body)</strong><br>The soma, or cell body, is the main part of the neuron that contains the nucleus and most of the cell\'s organelles. It integrates incoming signals from dendrites and generates outgoing signals through the axon. The soma is responsible for maintaining the neuron\'s metabolic functions and protein synthesis.';
        tooltip.style.display = 'block';
        tooltip.style.left = mouseEvent.clientX + 10 + 'px';
        tooltip.style.top = mouseEvent.clientY + 10 + 'px';
      }
    } else if (axonIntersects.length > 0) {
      hoveredNucleus = axonIntersects[0].object;
      if (tooltip) {
        tooltip.innerHTML = '<strong>Axon</strong><br>The axon is a long, slender projection that extends from the neuron\'s soma and transmits electrical impulses (action potentials) away from the cell body to other neurons, muscles, or glands. Axons can branch extensively and form connections called synapses with other neurons, allowing for complex neural communication and information processing throughout the nervous system.';
        tooltip.style.display = 'block';
        tooltip.style.left = mouseEvent.clientX + 10 + 'px';
        tooltip.style.top = mouseEvent.clientY + 10 + 'px';
      }
    } else if (pulseIntersects.length > 0) {
      hoveredNucleus = pulseIntersects[0].object;
      if (tooltip) {
        tooltip.innerHTML = '<strong>Pulses</strong>';
        tooltip.style.display = 'block';
        tooltip.style.left = mouseEvent.clientX + 10 + 'px';
        tooltip.style.top = mouseEvent.clientY + 10 + 'px';
      }
    } else if (burstIntersects.length > 0) {
      hoveredNucleus = burstIntersects[0].object;
      if (tooltip) {
        tooltip.innerHTML = '<strong>Synapse Bursts</strong>';
        tooltip.style.display = 'block';
        tooltip.style.left = mouseEvent.clientX + 10 + 'px';
        tooltip.style.top = mouseEvent.clientY + 10 + 'px';
      }
    } else {
      hoveredNucleus = null;
      if (tooltip) {
        tooltip.style.display = 'none'; // Hide tooltip when not hovering
      }
    }
  }

  // Update bursts - animate their growth and fade
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life -= dt; // Decrease lifetime

    // Calculate life progress (0 to 1)
    const tLife = 1 - b.life / BURST_LIFETIME;
    // Interpolate scale from min to max based on life progress
    const scale = THREE.MathUtils.lerp(BURST_MIN_SCALE, BURST_MAX_SCALE, tLife);

    b.sprite.scale.setScalar(scale); // Grow over time
    b.sprite.material.opacity = 1 - tLife; // Fade out over time

    // Remove burst when it expires
    if (b.life <= 0) {
      // Remove from hover detection array
      const index = burstSprites.indexOf(b.sprite);
      if (index > -1) {
        burstSprites.splice(index, 1);
      }
      scene.remove(b.sprite);
      b.sprite.material.dispose(); // Clean up memory
      bursts.splice(i, 1);
    }
  }

  // Spawn new bursts at a steady rate
  burstAccumulator += dt * BURSTS_PER_SECOND; // Accumulate time
  while (burstAccumulator > 1 && bursts.length < MAX_BURSTS) {
    const burst = createBurst();
    if (burst) bursts.push(burst);
    burstAccumulator -= 1; // Decrease accumulator
  }

  controls.update(); // Update camera controls (zoom damping)
  camera.rotation.set(pitch, yaw, 0); // Apply manual rotation
  composer.render(); // Render with post-processing
}

function onWindowResize() {
  // Update camera and renderer when window is resized
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}