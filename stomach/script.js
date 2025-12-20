import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

var controls, renderer, scene, camera;
var stomachWall, particles, gastricFluid, bubbleGroup, rugaeGroup;
var time = 0;
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var hoveredObject = null;
var tooltip = null;

// Game variables
var gameScore = 0;
var digestedCount = 0;
var totalParticles = 0;
var gameActive = false;
var isGameMode = false;

// Game mode variables
var enzyme = null;
var gameCamera = null;
var gameScene = null;
var gameRenderer = null;
var gameControls = null;
var keys = {};
var velocity = new THREE.Vector3();
var direction = new THREE.Vector3();
var gameParticles = [];
var gameBubbleGroup = null;
var gameGastricFluid = null;
var gameRugaeGroup = null;
var gameStomachGroup = null;
var gameLight = null;

// Animation variables
var enzymeAnimationTime = 0;
var enzymeIdleOffset = new THREE.Vector3(0, 0, 0);
var enzymeWingRotation = 0;
var enzymeIdleInitialized = false;

// Audio variables
var audioContext = null;
var movementSound = null;
var consumptionSound = null;
var backgroundSound = null;
var movementGain = null;

window.onload = async function() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0f05);

    // setup the camera - positioned inside the stomach
    const fov = 75;
    const ratio = window.innerWidth / window.innerHeight;
    const zNear = 0.1;
    const zFar = 1000;
    camera = new THREE.PerspectiveCamera( fov, ratio, zNear, zFar );
    camera.position.set(0, 0, 0); // Center of stomach (inside)
  
    // create renderer and setup the canvas with enhanced settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true
    });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setPixelRatio( Math.min(window.devicePixelRatio, 2) ); // Limit pixel ratio for performance
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild( renderer.domElement );

    // Add fog for depth
    scene.fog = new THREE.FogExp2(0x1a0f05, 0.02);

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.4);
    scene.add(ambientLight);

    // Main warm light (simulating body heat)
    const pointLight1 = new THREE.PointLight(0xffaa44, 2.5, 50, 2);
    pointLight1.position.set(5, 5, 5);
    pointLight1.castShadow = true;
    pointLight1.shadow.mapSize.width = 2048;
    pointLight1.shadow.mapSize.height = 2048;
    scene.add(pointLight1);

    // Cool accent light
    const pointLight2 = new THREE.PointLight(0x44aaff, 1.5, 50, 2);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    // Additional fill light from above
    const pointLight3 = new THREE.PointLight(0xffffff, 1.0, 40, 1.5);
    pointLight3.position.set(0, 10, 0);
    scene.add(pointLight3);

    // Rim light for better definition
    const directionalLight = new THREE.DirectionalLight(0xffdd88, 0.8);
    directionalLight.position.set(-10, 5, -10);
    scene.add(directionalLight);

    // Create stomach wall (outer shell)
    createStomachWall();

    // Create gastric fluid
    createGastricFluid();

    // Create floating particles (food particles, enzymes)
    createParticles();

    // Interaction controls - set up for inside view
    controls = new OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.1; // Can zoom in close
    controls.maxDistance = 7; // Limited to inside stomach
    controls.target.set(0, 0, 0); // Look from center
  
    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Setup tooltip
    tooltip = document.getElementById('tooltip');
    
    // Setup hover detection
    setupHoverDetection();

    // Start animation loop
    animate();
};

// Switch to game mode
window.startGame = function() {
    isGameMode = true;
    gameActive = true;
    
    // Hide stomach view, show game view
    const stomachView = document.getElementById('stomach-view');
    const gameView = document.getElementById('game-view');
    if (stomachView) stomachView.classList.add('hidden');
    if (gameView) gameView.classList.add('active');
    
    // Initialize game
    initGame();
};

// Exit game mode
window.exitGame = function() {
    isGameMode = false;
    gameActive = false;
    
    // Stop all sounds
    stopMovementSound();
    if (backgroundSound) {
        try {
            backgroundSound.stop();
        } catch (e) {}
    }
    
    // Hide game view, show stomach view
    const stomachView = document.getElementById('stomach-view');
    const gameView = document.getElementById('game-view');
    if (stomachView) stomachView.classList.remove('hidden');
    if (gameView) gameView.classList.remove('active');
    
    // Clean up game resources
    if (gameRenderer && gameRenderer.domElement && gameRenderer.domElement.parentNode) {
        gameRenderer.domElement.parentNode.removeChild(gameRenderer.domElement);
    }
    
    // Reset game variables
    gameScore = 0;
    digestedCount = 0;
    enzymeAnimationTime = 0;
    enzymeIdleInitialized = false;
    enzymeIdleOffset.set(0, 0, 0);
};

function initAudio() {
    try {
        // Initialize Web Audio API
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create movement sound (continuous low hum)
        movementGain = audioContext.createGain();
        movementGain.gain.value = 0;
        movementGain.connect(audioContext.destination);
        
        // Create oscillator for movement sound
        movementSound = audioContext.createOscillator();
        movementSound.type = 'sawtooth';
        movementSound.frequency.value = 120;
        movementSound.connect(movementGain);
        movementSound.start();
        
        // Create background ambient sound
        const ambientGain = audioContext.createGain();
        ambientGain.gain.value = 0.1;
        ambientGain.connect(audioContext.destination);
        
        backgroundSound = audioContext.createOscillator();
        backgroundSound.type = 'sine';
        backgroundSound.frequency.value = 60;
        backgroundSound.connect(ambientGain);
        backgroundSound.start();
        
    } catch (e) {
        console.warn('Audio initialization failed:', e);
    }
}

function startMovementSound() {
    if (movementGain) {
        movementGain.gain.setTargetAtTime(0.15, audioContext.currentTime, 0.1);
    }
}

function stopMovementSound() {
    if (movementGain) {
        movementGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
    }
}

function playConsumptionSound() {
    if (!audioContext) return;
    
    try {
        // Create a short "pop" sound for consumption
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        console.warn('Consumption sound failed:', e);
    }
}

function initGame() {
    // Initialize audio
    initAudio();
    
    // Create game scene
    gameScene = new THREE.Scene();
    gameScene.background = new THREE.Color(0x1a0f05);
    
    // Create game camera (third person)
    gameCamera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    
    // Create game renderer
    gameRenderer = new THREE.WebGLRenderer({ antialias: true });
    gameRenderer.setSize(window.innerWidth, window.innerHeight);
    gameRenderer.shadowMap.enabled = true;
    gameRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(gameRenderer.domElement);
    
    // Add fog
    gameScene.fog = new THREE.FogExp2(0x1a0f05, 0.02);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.4);
    gameScene.add(ambientLight);
    
    gameLight = new THREE.PointLight(0xffaa44, 2.5, 50, 2);
    gameLight.position.set(5, 5, 5);
    gameLight.castShadow = true;
    gameScene.add(gameLight);
    
    const pointLight2 = new THREE.PointLight(0x44aaff, 1.5, 50, 2);
    pointLight2.position.set(-5, -5, 5);
    gameScene.add(pointLight2);
    
    // Create stomach environment for game
    createGameEnvironment();
    
    // Create enzyme player
    createEnzyme();
    
    // Create food particles
    createGameParticles();
    
    // Setup controls
    setupGameControls();
    
    // Setup keyboard input
    setupKeyboardInput();
    
    // Initialize UI
    updateGameUI();
    
    // Start game loop
    animateGame();
}

function createGameEnvironment() {
    gameStomachGroup = new THREE.Group();
    
    // Inner lining (what you see from inside)
    const innerGeometry = new THREE.SphereGeometry(7.5, 64, 48);
    innerGeometry.scale(1, 1.3, 0.9);
    const texture = createStomachTexture(512, 512);
    const normalTexture = createNormalTexture(512, 512);
    
    const innerMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8888,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0.05,
        map: texture,
        normalMap: normalTexture,
        normalScale: new THREE.Vector2(0.8, 0.8),
        emissive: 0x441111,
        emissiveIntensity: 0.2
    });
    
    const innerWall = new THREE.Mesh(innerGeometry, innerMaterial);
    innerWall.receiveShadow = true;
    gameStomachGroup.add(innerWall);
    
    // Rugae (folds)
    gameRugaeGroup = new THREE.Group();
    for (let i = 0; i < 40; i++) {
        const height = 1.5 + Math.random() * 1.5;
        const width = 0.15 + Math.random() * 0.15;
        const rugaeGeometry = new THREE.BoxGeometry(width, height, 0.15);
        const rugaeMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6666,
            transparent: true,
            opacity: 0.85,
            roughness: 0.5
        });
        const rugae = new THREE.Mesh(rugaeGeometry, rugaeMaterial);
        rugae.castShadow = true;
        
        const angle = (i / 40) * Math.PI * 2;
        const radius = 7.3 + (Math.random() - 0.5) * 0.3;
        rugae.position.set(
            Math.cos(angle) * radius * 0.8,
            (Math.random() - 0.5) * 4,
            Math.sin(angle) * radius * 0.6
        );
        rugae.rotation.y = angle;
        gameRugaeGroup.add(rugae);
    }
    gameStomachGroup.add(gameRugaeGroup);
    
    // Gastric fluid (simplified)
    gameGastricFluid = createGameGastricFluid();
    gameStomachGroup.add(gameGastricFluid);
    
    gameScene.add(gameStomachGroup);
}

function createGameGastricFluid() {
    const fluidGroup = new THREE.Group();
    const cupRadius = 7.0;
    const cupHeight = 3.5;
    const cupBottomY = -5.5;
    const a = cupRadius;
    const c = cupRadius * 0.9;
    
    const liquidGeometry = new THREE.CylinderGeometry(
        Math.max(a, c),
        Math.max(a, c),
        cupHeight,
        64
    );
    liquidGeometry.scale(1, 1, c / a);
    
    const fluidMaterial = new THREE.MeshStandardMaterial({
        color: 0xccaa44,
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
        metalness: 0.3,
        side: THREE.DoubleSide
    });
    
    const fluidBody = new THREE.Mesh(liquidGeometry, fluidMaterial);
    fluidBody.position.y = cupBottomY + cupHeight / 2;
    fluidGroup.add(fluidBody);
    
    // Bubbles
    gameBubbleGroup = new THREE.Group();
    for (let i = 0; i < 30; i++) {
        const size = 0.08 + Math.random() * 0.15;
        const bubbleGeometry = new THREE.SphereGeometry(size, 16, 16);
        const bubbleMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 0.6 + Math.random() * 0.3,
            roughness: 0.1,
            metalness: 0.8
        });
        const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
        const waterLevelY = -5.5 + 3.5;
        bubble.position.set(
            (Math.random() - 0.5) * 12,
            waterLevelY + Math.random() * 0.5,
            (Math.random() - 0.5) * 10
        );
        gameBubbleGroup.add(bubble);
    }
    fluidGroup.add(gameBubbleGroup);
    
    return fluidGroup;
}

function createEnzyme() {
    // Create enzyme as a ship-like vehicle with UNIQUE BRIGHT CYAN COLOR
    const enzymeGroup = new THREE.Group();
    
    // Main body (elongated shape - use scaled sphere for simplicity)
    const bodyGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    bodyGeometry.scale(1, 1, 1.6); // Stretch to make it more ship-like
    const enzymeMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff, // BRIGHT CYAN - unique color
        emissive: 0x00aaff,
        emissiveIntensity: 0.8, // High emissive for glow
        roughness: 0.2,
        metalness: 0.9
    });
    
    const body = new THREE.Mesh(bodyGeometry, enzymeMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    enzymeGroup.add(body);
    
    // Add some detail - animated "wings" or appendages
    const wingGeometry = new THREE.BoxGeometry(0.18, 0.35, 0.06);
    const wingMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ddff,
        emissive: 0x0088ff,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.9
    });
    
    const wing1 = new THREE.Mesh(wingGeometry, wingMaterial);
    wing1.position.set(0.4, 0, 0);
    wing1.userData.isWing = true;
    wing1.userData.wingSide = 1;
    enzymeGroup.add(wing1);
    
    const wing2 = new THREE.Mesh(wingGeometry, wingMaterial);
    wing2.position.set(-0.4, 0, 0);
    wing2.userData.isWing = true;
    wing2.userData.wingSide = -1;
    enzymeGroup.add(wing2);
    
    // Add a glowing "nose" or front indicator
    const noseGeometry = new THREE.ConeGeometry(0.18, 0.45, 8);
    const noseMaterial = new THREE.MeshStandardMaterial({
        color: 0x88ffff,
        emissive: 0x44ffff,
        emissiveIntensity: 1.0, // Very bright
        roughness: 0.1,
        metalness: 0.95
    });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 0, -0.6); // At the front
    nose.rotation.x = Math.PI; // Point forward
    enzymeGroup.add(nose);
    
    // Add a point light to the enzyme for glow effect
    const enzymeLight = new THREE.PointLight(0x00ffff, 1.5, 10, 2);
    enzymeLight.position.set(0, 0, 0);
    enzymeGroup.add(enzymeLight);
    enzymeGroup.userData.light = enzymeLight;
    
    enzyme = enzymeGroup;
    enzyme.position.set(0, 0, 0); // Start at center
    enzyme.castShadow = true;
    enzyme.userData.speed = 0.25; // Movement speed
    enzyme.userData.turnSpeed = 0.06; // Rotation speed
    enzyme.userData.rotationY = 0; // Current rotation angle
    enzyme.userData.velocity = new THREE.Vector3(0, 0, 0); // Current velocity
    enzyme.userData.isMoving = false;
    enzyme.userData.wings = [wing1, wing2];
    
    gameScene.add(enzyme);
    
    // Position camera behind enzyme (chase camera)
    updateCameraPosition();
}

function createGameParticles() {
    gameParticles = [];
    const particleCount = 50; // Fewer particles for better performance
    
    const foodColors = [
        new THREE.Color(0x8B4513),
        new THREE.Color(0xA0522D),
        new THREE.Color(0xCD853F),
        new THREE.Color(0xD2691E),
    ];
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.2 + Math.random() * 0.3;
        const geometry = new THREE.SphereGeometry(size, 8, 8);
        const color = foodColors[Math.floor(Math.random() * foodColors.length)];
        const material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 10
        );
        particle.castShadow = true;
        particle.userData.isConsumed = false;
        particle.userData.points = Math.floor(Math.random() * 10) + 5;
        
        gameParticles.push(particle);
        gameScene.add(particle);
    }
    
    totalParticles = particleCount;
    updateGameUI();
}

function setupGameControls() {
    // Disable orbit controls - camera is controlled programmatically
    gameControls = null;
    // Camera is controlled by updateCameraPosition() for smooth chase camera
}

function setupKeyboardInput() {
    document.addEventListener('keydown', (event) => {
        if (!isGameMode) return;
        keys[event.key.toLowerCase()] = true;
    });
    
    document.addEventListener('keyup', (event) => {
        if (!isGameMode) return;
        keys[event.key.toLowerCase()] = false;
    });
}

function updateCameraPosition() {
    if (!enzyme || !gameCamera) return;
    
    // Improved third-person chase camera - smooth following
    const cameraDistance = 6;
    const cameraHeight = 3;
    const cameraLookAhead = 2; // Look slightly ahead of enzyme
    
    // Calculate camera position behind enzyme (in direction opposite to forward)
    const backward = new THREE.Vector3(0, 0, 1);
    backward.applyAxisAngle(new THREE.Vector3(0, 1, 0), enzyme.userData.rotationY);
    
    // Ideal camera position
    const idealCameraPos = enzyme.position.clone();
    idealCameraPos.add(backward.multiplyScalar(cameraDistance));
    idealCameraPos.y += cameraHeight;
    
    // Smooth camera follow (lerp for smoothness)
    gameCamera.position.lerp(idealCameraPos, 0.15);
    
    // Look ahead of enzyme (where it's going)
    const lookAheadPos = enzyme.position.clone();
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), enzyme.userData.rotationY);
    lookAheadPos.add(forward.multiplyScalar(cameraLookAhead));
    lookAheadPos.y += 0.5;
    
    // Smooth look-at
    const currentLookAt = new THREE.Vector3();
    gameCamera.getWorldDirection(currentLookAt);
    currentLookAt.multiplyScalar(10).add(gameCamera.position);
    
    const targetLookAt = lookAheadPos.clone();
    currentLookAt.lerp(targetLookAt, 0.2);
    gameCamera.lookAt(currentLookAt);
}

function updateEnzymeMovement() {
    if (!enzyme) return;
    
    // Vehicle-like controls: A/D turn, W/S accelerate forward/backward
    const turnSpeed = enzyme.userData.turnSpeed;
    const speed = enzyme.userData.speed;
    const wasMoving = enzyme.userData.isMoving;
    
    // Rotate left/right (like turning a car)
    if (keys['a']) {
        enzyme.userData.rotationY -= turnSpeed;
    }
    if (keys['d']) {
        enzyme.userData.rotationY += turnSpeed;
    }
    
    // Apply rotation to enzyme
    enzyme.rotation.y = enzyme.userData.rotationY;
    
    // Calculate forward direction based on enzyme's rotation
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), enzyme.userData.rotationY);
    
    // Accelerate forward or backward (like gas/brake)
    if (keys['w']) {
        enzyme.userData.velocity.add(forward.multiplyScalar(0.025)); // Accelerate forward
        enzyme.userData.isMoving = true;
    } else if (keys['s']) {
        enzyme.userData.velocity.add(forward.multiplyScalar(-0.015)); // Brake/reverse
        enzyme.userData.isMoving = true;
    } else {
        enzyme.userData.isMoving = false;
    }
    
    // Update movement sound based on movement state
    if (enzyme.userData.isMoving && !wasMoving) {
        startMovementSound();
    } else if (!enzyme.userData.isMoving && wasMoving) {
        stopMovementSound();
    }
    
    // Apply friction/drag
    enzyme.userData.velocity.multiplyScalar(0.94);
    
    // Limit max speed
    const maxSpeed = speed;
    if (enzyme.userData.velocity.length() > maxSpeed) {
        enzyme.userData.velocity.normalize().multiplyScalar(maxSpeed);
    }
    
    // Update position based on velocity
    enzyme.position.add(enzyme.userData.velocity);
    
    // Keep enzyme within stomach bounds
    const maxRadius = 6;
    const distance = Math.sqrt(enzyme.position.x ** 2 + enzyme.position.z ** 2);
    if (distance > maxRadius) {
        // Bounce off walls
        const normal = new THREE.Vector3(-enzyme.position.x / distance, 0, -enzyme.position.z / distance);
        enzyme.userData.velocity.reflect(normal);
        enzyme.position.x = (enzyme.position.x / distance) * maxRadius;
        enzyme.position.z = (enzyme.position.z / distance) * maxRadius;
    }
    
    // Keep Y within reasonable bounds
    if (enzyme.position.y < -3 || enzyme.position.y > 3) {
        enzyme.userData.velocity.y *= -0.5; // Bounce with dampening
        enzyme.position.y = Math.max(-3, Math.min(3, enzyme.position.y));
    }
}

function updateEnzymeAnimation() {
    if (!enzyme) return;
    
    enzymeAnimationTime += 0.016; // ~60fps
    
    // Calculate idle floating animation (oscillating offset)
    const floatAmount = 0.15;
    const floatSpeed = 1.5;
    const newIdleOffset = new THREE.Vector3(
        Math.cos(enzymeAnimationTime * floatSpeed * 0.7) * 0.1,
        Math.sin(enzymeAnimationTime * floatSpeed) * floatAmount,
        Math.sin(enzymeAnimationTime * floatSpeed * 0.5) * 0.1
    );
    
    // Remove old offset and apply new one (only if already initialized)
    if (enzymeIdleInitialized) {
        enzyme.position.sub(enzymeIdleOffset);
    } else {
        enzymeIdleInitialized = true;
    }
    enzyme.position.add(newIdleOffset);
    enzymeIdleOffset.copy(newIdleOffset);
    
    // Wing flapping animation when moving
    if (enzyme.userData.isMoving && enzyme.userData.velocity.length() > 0.01) {
        enzymeWingRotation += 0.3;
        const wingFlapAmount = Math.sin(enzymeWingRotation) * 0.3;
        
        if (enzyme.userData.wings) {
            enzyme.userData.wings.forEach((wing, index) => {
                wing.rotation.z = wingFlapAmount * (index === 0 ? 1 : -1);
            });
        }
    } else {
        // Gentle idle wing movement
        enzymeWingRotation += 0.1;
        const idleFlap = Math.sin(enzymeWingRotation) * 0.1;
        
        if (enzyme.userData.wings) {
            enzyme.userData.wings.forEach((wing, index) => {
                wing.rotation.z = idleFlap * (index === 0 ? 1 : -1);
            });
        }
    }
    
    // Pulsing glow effect
    const glowIntensity = 0.8 + Math.sin(enzymeAnimationTime * 3) * 0.2;
    if (enzyme.userData.light) {
        enzyme.userData.light.intensity = 1.5 * glowIntensity;
    }
    
    // Slight tilt when turning
    if (keys['a'] || keys['d']) {
        const tiltAmount = (keys['a'] ? 0.2 : 0) + (keys['d'] ? -0.2 : 0);
        enzyme.rotation.z = THREE.MathUtils.lerp(enzyme.rotation.z, tiltAmount, 0.1);
    } else {
        enzyme.rotation.z = THREE.MathUtils.lerp(enzyme.rotation.z, 0, 0.1);
    }
}

function checkParticleCollisions() {
    if (!enzyme) return;
    
    const enzymeRadius = 0.4; // Slightly larger collision radius for the enzyme ship
    const enzymePosition = enzyme.position;
    
    gameParticles.forEach((particle, index) => {
        if (particle.userData.isConsumed) return;
        
        const distance = enzymePosition.distanceTo(particle.position);
        const particleRadius = particle.geometry.parameters.radius || 0.25;
        const minDistance = enzymeRadius + particleRadius;
        
        if (distance < minDistance) {
            // Consume particle
            particle.userData.isConsumed = true;
            gameScore += particle.userData.points;
            digestedCount++;
            
            // Play consumption sound
            playConsumptionSound();
            
            // Enhanced consumption animation with particle effect
            const startScale = particle.scale.x;
            const startOpacity = particle.material.opacity;
            let animationFrame = 0;
            const maxFrames = 20;
            
            const consumeAnimation = () => {
                animationFrame++;
                const progress = animationFrame / maxFrames;
                
                // Scale down and fade out
                const scale = THREE.MathUtils.lerp(startScale, 0, progress);
                particle.scale.setScalar(scale);
                particle.material.opacity = THREE.MathUtils.lerp(startOpacity, 0, progress);
                
                // Add rotation for visual effect
                particle.rotation.x += 0.1;
                particle.rotation.y += 0.1;
                
                // Add slight upward movement
                particle.position.y += 0.02;
                
                if (progress < 1) {
                    requestAnimationFrame(consumeAnimation);
                } else {
                    particle.visible = false;
                }
            };
            consumeAnimation();
            
            // Brief enzyme "pulse" effect on consumption
            if (enzyme.userData.light) {
                const originalIntensity = enzyme.userData.light.intensity;
                enzyme.userData.light.intensity = originalIntensity * 2;
                setTimeout(() => {
                    if (enzyme.userData.light) {
                        enzyme.userData.light.intensity = originalIntensity;
                    }
                }, 100);
            }
            
            updateGameUI();
            
            // Check if game is complete
            if (digestedCount >= totalParticles) {
                gameActive = false;
                stopMovementSound();
                const statusElement = document.getElementById('game-status');
                if (statusElement) {
                    statusElement.textContent = `🎉 Game Complete! Final Score: ${gameScore}`;
                    statusElement.className = 'success';
                }
            }
        }
    });
}

function updateGameUI() {
    const scoreElement = document.getElementById('game-score');
    const consumedElement = document.getElementById('game-consumed');
    const totalElement = document.getElementById('game-total');
    
    if (scoreElement) scoreElement.textContent = gameScore.toString();
    if (consumedElement) consumedElement.textContent = digestedCount.toString();
    if (totalElement) totalElement.textContent = totalParticles.toString();
}

function animateGame() {
    if (!isGameMode) return;
    
    requestAnimationFrame(animateGame);
    
    if (gameActive) {
        updateEnzymeMovement();
        updateEnzymeAnimation();
        updateCameraPosition();
        checkParticleCollisions();
    } else if (enzyme) {
        // Still animate enzyme even when game is paused
        updateEnzymeAnimation();
    }
    
    if (gameRenderer && gameScene && gameCamera) {
        gameRenderer.render(gameScene, gameCamera);
    }
}

// Handle window resize for game
window.addEventListener('resize', () => {
    if (gameCamera && gameRenderer) {
        gameCamera.aspect = window.innerWidth / window.innerHeight;
        gameCamera.updateProjectionMatrix();
        gameRenderer.setSize(window.innerWidth, window.innerHeight);
    }
});

function createStomachWall() {
    // Create the outer stomach wall with enhanced graphics
    const group = new THREE.Group();
    rugaeGroup = new THREE.Group();

    // Create procedural texture for stomach lining
    const texture = createStomachTexture(512, 512);
    const normalTexture = createNormalTexture(512, 512);

    // Main stomach body (ellipsoid shape) - higher resolution
    const geometry = new THREE.SphereGeometry(8, 64, 48);
    geometry.scale(1, 1.3, 0.9);
    
    // Enhanced stomach wall material - more visible from inside
    const material = new THREE.MeshStandardMaterial({
        color: 0xffcccc,
        transparent: true,
        opacity: 0.7, // More opaque so you can see it from inside
        side: THREE.DoubleSide,
        roughness: 0.7,
        metalness: 0.1,
        map: texture,
        normalMap: normalTexture,
        normalScale: new THREE.Vector2(0.5, 0.5),
        emissive: 0x331111,
        emissiveIntensity: 0.1
    });

    stomachWall = new THREE.Mesh(geometry, material);
    stomachWall.receiveShadow = true;
    stomachWall.userData.type = 'stomachWall';
    stomachWall.userData.name = 'Stomach Wall';
    stomachWall.userData.description = 'The outer muscular wall of the stomach that contracts to mix and churn food.';
    stomachWall.visible = false; // Hide outer wall when viewing from inside
    group.add(stomachWall);

    // Add inner lining - this is what we see from inside, make it more prominent
    const innerGeometry = new THREE.SphereGeometry(7.5, 64, 48);
    innerGeometry.scale(1, 1.3, 0.9);
    const innerMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8888,
        transparent: true,
        opacity: 0.9, // More opaque for inside view
        side: THREE.DoubleSide,
        roughness: 0.6,
        metalness: 0.05,
        map: texture,
        normalMap: normalTexture,
        normalScale: new THREE.Vector2(0.8, 0.8),
        emissive: 0x441111,
        emissiveIntensity: 0.2 // Slightly brighter from inside
    });
    const innerWall = new THREE.Mesh(innerGeometry, innerMaterial);
    innerWall.receiveShadow = true;
    innerWall.userData.type = 'stomachLining';
    innerWall.userData.name = 'Stomach Lining';
    innerWall.userData.description = 'The inner mucosal lining that protects the stomach wall from acid and produces digestive enzymes.';
    group.add(innerWall);

    // Enhanced folds (rugae) - more detailed and varied
    for (let i = 0; i < 40; i++) {
        const height = 1.5 + Math.random() * 1.5;
        const width = 0.15 + Math.random() * 0.15;
        const rugaeGeometry = new THREE.BoxGeometry(width, height, 0.15);
        
        const rugaeMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6666,
            transparent: true,
            opacity: 0.85,
            roughness: 0.5,
            metalness: 0.0,
            emissive: 0x220000,
            emissiveIntensity: 0.1
        });
        const rugae = new THREE.Mesh(rugaeGeometry, rugaeMaterial);
        rugae.castShadow = true;
        rugae.receiveShadow = true;
        
        const angle = (i / 40) * Math.PI * 2;
        const radius = 7.3 + (Math.random() - 0.5) * 0.3;
        rugae.position.set(
            Math.cos(angle) * radius * 0.8,
            (Math.random() - 0.5) * 4,
            Math.sin(angle) * radius * 0.6
        );
        rugae.rotation.y = angle;
        rugae.rotation.x = (Math.random() - 0.5) * 0.3;
        rugae.userData.type = 'rugae';
        rugae.userData.name = 'Rugae';
        rugae.userData.description = 'Folds in the stomach lining that expand to accommodate food and increase surface area for digestion.';
        rugaeGroup.add(rugae);
    }
    group.add(rugaeGroup);

    scene.add(group);
}

function createStomachTexture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Base color
    ctx.fillStyle = '#ffcccc';
    ctx.fillRect(0, 0, width, height);
    
    // Add organic texture pattern
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = 5 + Math.random() * 15;
        const alpha = 0.1 + Math.random() * 0.2;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(255, ${180 + Math.random() * 40}, ${180 + Math.random() * 40}, ${alpha})`);
        gradient.addColorStop(1, 'rgba(255, 204, 204, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Add fine detail
    for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(255, ${200 + Math.random() * 55}, ${200 + Math.random() * 55}, ${0.05 + Math.random() * 0.1})`;
        ctx.beginPath();
        ctx.arc(
            Math.random() * width,
            Math.random() * height,
            Math.random() * 3,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
}

function createNormalTexture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Create a normal map pattern
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 + 0.5;
            data[i] = noise * 255;     // R
            data[i + 1] = noise * 255; // G
            data[i + 2] = 255;         // B (normal maps use blue for depth)
            data[i + 3] = 255;         // A
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
}

function createGastricFluid() {
    // Create gastric fluid like water in a cup - fills bottom, touches edges, flat top
    // Stomach inner wall: radius 7.5, scaled (1, 1.3, 0.9) - ellipsoid shape
    const fluidGroup = new THREE.Group();
    
    // Create fluid texture
    const fluidTexture = createFluidTexture(256, 256);
    
    // Cup parameters - match stomach shape but slightly smaller to fit inside
    const cupRadius = 7.0; // Slightly smaller than 7.5 inner wall
    const cupHeight = 3.5; // Height of the water level
    const cupBottomY = -5.5; // Bottom of the cup (stomach bottom)
    const waterLevelY = cupBottomY + cupHeight; // Water surface level
    
    // Create cup-shaped liquid body using a cylinder that matches ellipsoid cross-section
    // At water level, the cross-section is an ellipse
    const a = cupRadius; // X radius
    const c = cupRadius * 0.9; // Z radius (scaled)
    
    // Use cylinder for the liquid body, scaled to match ellipsoid shape
    const liquidGeometry = new THREE.CylinderGeometry(
        Math.max(a, c), // Use larger radius
        Math.max(a, c), // Same top and bottom
        cupHeight,
        64
    );
    liquidGeometry.scale(1, 1, c / a); // Scale Z to match ellipsoid
    
    // Liquid body material - transparent, liquid-like
    const fluidMaterial = new THREE.MeshStandardMaterial({
        color: 0xccaa44,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
        metalness: 0.2,
        emissive: 0x332200,
        emissiveIntensity: 0.15,
        map: fluidTexture,
        side: THREE.DoubleSide
    });

    const fluidBody = new THREE.Mesh(liquidGeometry, fluidMaterial);
    fluidBody.position.y = cupBottomY + cupHeight / 2; // Center of the liquid
    fluidBody.receiveShadow = true;
    fluidBody.castShadow = false;
    fluidBody.userData.type = 'gastricFluid';
    fluidBody.userData.name = 'Gastric Fluid';
    fluidBody.userData.description = 'A mixture of hydrochloric acid, enzymes, and mucus that breaks down food and kills bacteria.';
    fluidGroup.add(fluidBody);

    // Top surface - flat ellipse like water in a cup (with waves)
    const surfaceSegments = 80; // High detail for smooth waves
    // Calculate ellipse dimensions at water level
    const surfaceWidth = a * 2;
    const surfaceHeight = c * 2;
    
    const surfaceGeometry = new THREE.PlaneGeometry(surfaceWidth, surfaceHeight, surfaceSegments, surfaceSegments);
    
    // Store original positions (flat plane)
    const surfacePositions = surfaceGeometry.attributes.position;
    const originalPositions = new Float32Array(surfacePositions.array.length);
    for (let i = 0; i < surfacePositions.array.length; i++) {
        originalPositions[i] = surfacePositions.array[i];
    }
    
    surfaceGeometry.userData.originalPositions = originalPositions;
    surfaceGeometry.computeVertexNormals();
    
    // Liquid surface material - reflective, like water
    const waterSurfaceMaterial = new THREE.MeshStandardMaterial({
        color: 0xddbb66,
        transparent: true,
        opacity: 0.9,
        roughness: 0.05,
        metalness: 0.6,
        emissive: 0x221100,
        emissiveIntensity: 0.1,
        map: fluidTexture,
        side: THREE.DoubleSide
    });

    const waterSurface = new THREE.Mesh(surfaceGeometry, waterSurfaceMaterial);
    waterSurface.rotation.x = -Math.PI / 2; // Face upward
    waterSurface.position.y = waterLevelY; // At water level
    waterSurface.receiveShadow = true;
    waterSurface.castShadow = false;
    waterSurface.userData.type = 'gastricFluid';
    waterSurface.userData.name = 'Gastric Fluid Surface';
    waterSurface.userData.description = 'The surface of the gastric fluid, which contains digestive enzymes and acid that break down food.';
    waterSurface.userData.originalGeometry = surfaceGeometry; // Store for replacement
    waterSurface.userData.originalPosition = waterLevelY;
    fluidGroup.add(waterSurface);
    console.log('  Added to fluidGroup, fluidGroup parent:', fluidGroup.parent);

    // Store references for animation
    gastricFluid = fluidGroup;
    gastricFluid.userData.waterSurface = waterSurface;
    gastricFluid.userData.fluidBody = fluidBody;
    gastricFluid.userData.waveTime = 0;
    
    scene.add(gastricFluid);

    // Enhanced bubbles/foam with better materials - positioned inside stomach
    bubbleGroup = new THREE.Group();
    for (let i = 0; i < 60; i++) {
        const size = 0.08 + Math.random() * 0.25;
        const bubbleGeometry = new THREE.SphereGeometry(size, 16, 16);
        const bubbleMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffaa,
            transparent: true,
            opacity: 0.6 + Math.random() * 0.3,
            roughness: 0.1,
            metalness: 0.8,
            emissive: 0xffffaa,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide
        });
        const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
        // Position bubbles on top of fluid surface (at water level)
        const waterLevelY = -5.5 + 3.5; // cupBottomY + cupHeight
        bubble.position.set(
            (Math.random() - 0.5) * 12,
            waterLevelY + Math.random() * 0.5,
            (Math.random() - 0.5) * 10
        );
        bubble.userData.originalY = bubble.position.y;
        bubble.userData.speed = 0.2 + Math.random() * 0.3;
        bubble.userData.phase = Math.random() * Math.PI * 2;
        bubble.userData.type = 'bubble';
        bubble.userData.name = 'Gas Bubble';
        bubble.userData.description = 'Gas bubbles formed during digestion, containing carbon dioxide and other gases produced by chemical reactions.';
        bubbleGroup.add(bubble);
    }
    scene.add(bubbleGroup);
}

// Water physics implementation disabled - keeping original gastric fluid
function replaceWithWaterShader_DISABLED() {
    console.log('=== REPLACING WITH WATER SHADER ===');
    
    // Find the water surface
    let waterSurface = null;
    scene.traverse((object) => {
        if (object.name === 'WaterPlane' && object.isMesh) {
            waterSurface = object;
            console.log('FOUND WaterPlane!', object);
        }
    });
    
    if (!waterSurface) {
        console.error('ERROR: WaterPlane not found in scene!');
        console.log('Scene structure:');
        scene.traverse((object) => {
            console.log('  -', object.name || object.type, object.isMesh ? '(Mesh)' : '');
        });
        return;
    }
    
    console.log('WaterPlane found, replacing with Three.js Water shader...');
    
    // Get the geometry and position
    const geometry = waterSurface.geometry;
    const position = waterSurface.position.clone();
    const rotation = waterSurface.rotation.clone();
    const parent = waterSurface.parent;
    const userData = { ...waterSurface.userData };
    
    // Create water normal maps - use fallback
    console.log('Creating water normal map...');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;
    
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const i = (y * 512 + x) * 4;
            const nx = (Math.sin(x * 0.02) * 0.5 + 0.5) * 255;
            const ny = (Math.cos(y * 0.02) * 0.5 + 0.5) * 255;
            data[i] = nx;
            data[i + 1] = ny;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    const waterNormals = new THREE.CanvasTexture(canvas);
    waterNormals.wrapS = THREE.RepeatWrapping;
    waterNormals.wrapT = THREE.RepeatWrapping;
    
    // Get parameters for 3D water volume
    const cupRadius = 7.0;
    const cupHeight = 3.5;
    const cupBottomY = -5.5;
    const a = cupRadius;
    const c = cupRadius * 0.9;
    
    // Create 3D water volume geometry (cylinder that fills the stomach)
    const waterVolumeGeometry = new THREE.CylinderGeometry(
        Math.max(a, c),
        Math.max(a, c),
        cupHeight,
        64
    );
    waterVolumeGeometry.scale(1, 1, c / a); // Scale Z to match ellipsoid
    
    // Create 3D water volume with transparent material - make it more visible as 3D
    const waterVolumeMaterial = new THREE.MeshStandardMaterial({
        color: 0xccaa44,
        transparent: true,
        opacity: 0.7, // More opaque so it's clearly visible as 3D
        roughness: 0.05,
        metalness: 0.4,
        side: THREE.DoubleSide
    });
    
    const waterVolume = new THREE.Mesh(waterVolumeGeometry, waterVolumeMaterial);
    waterVolume.position.y = cupBottomY + cupHeight / 2; // Center of the water volume
    waterVolume.position.x = 0;
    waterVolume.position.z = 0;
    waterVolume.receiveShadow = true;
    waterVolume.castShadow = false;
    waterVolume.visible = true; // Ensure it's visible
    waterVolume.userData.type = 'gastricFluid';
    waterVolume.userData.name = 'Gastric Fluid Volume';
    console.log('Created 3D water volume at position:', waterVolume.position, 'visible:', waterVolume.visible);
    
    // Create the water surface (top) using Three.js Water shader
    const waterSurfaceGeometry = geometry.clone();
    const water = new Water(waterSurfaceGeometry, {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: waterNormals,
        sunDirection: new THREE.Vector3(0, 1, 0),
        sunColor: 0xffffff,
        waterColor: 0xccaa44, // Gastric fluid color
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });
    
    water.rotation.copy(rotation);
    water.position.copy(position);
    water.userData = userData;
    water.userData.isWater = true;
    
    // Remove old surface and add new water (both 3D volume and animated surface)
    if (parent) {
        parent.remove(waterSurface);
        parent.add(waterVolume); // 3D water volume (fills the stomach)
        parent.add(water); // Water surface (animated top)
        console.log('Replaced WaterPlane with 3D water volume + surface in parent:', parent);
    } else {
        scene.remove(waterSurface);
        scene.add(waterVolume); // 3D water volume
        scene.add(water); // Water surface
        console.log('Replaced WaterPlane with 3D water volume + surface in scene');
    }
    
    // REMOVE the old fluid body completely since we're replacing with water
    if (gastricFluid && gastricFluid.userData && gastricFluid.userData.fluidBody) {
        const oldFluidBody = gastricFluid.userData.fluidBody;
        if (oldFluidBody.parent) {
            oldFluidBody.parent.remove(oldFluidBody);
            console.log('Removed old fluid body from parent');
        } else {
            scene.remove(oldFluidBody);
            console.log('Removed old fluid body from scene');
        }
    }
    
    // Store both water surface and volume
    water.userData.waterVolume = waterVolume;
    
    // Update reference
    if (gastricFluid && gastricFluid.userData) {
        gastricFluid.userData.waterSurface = water;
        gastricFluid.userData.waterVolume = waterVolume; // Store volume reference too
    }
    
    waterList = [water, waterVolume]; // Include volume in water list for potential animation
    console.log('Water replacement complete!');
    console.log('  Water surface:', water);
    console.log('  Water volume (3D):', waterVolume);
    console.log('  Volume position:', waterVolume.position);
    console.log('  Volume visible:', waterVolume.visible);
}

function createFluidTexture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Base fluid color
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ccaa44');
    gradient.addColorStop(0.5, '#ddbb55');
    gradient.addColorStop(1, '#bb9944');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add organic patterns
    for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(255, ${200 + Math.random() * 55}, ${100 + Math.random() * 50}, ${0.1 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(
            Math.random() * width,
            Math.random() * height,
            Math.random() * 20,
            Math.random() * 20,
            Math.random() * Math.PI * 2,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
}

function createParticles() {
    // Create distinct food particles as 3D spheres - more visible and different from other elements
    const particleCount = 150; // Fewer but larger particles
    const particleGroup = new THREE.Group();
    const particleData = [];

    // Food-like colors - browns, tans, darker oranges (more distinct from yellow gastric fluid)
    const foodColors = [
        new THREE.Color(0x8B4513), // Saddle brown (food chunks)
        new THREE.Color(0xA0522D), // Sienna (partially digested)
        new THREE.Color(0xCD853F), // Peru (food particles)
        new THREE.Color(0xD2691E), // Chocolate (digested food)
        new THREE.Color(0xBC8F8F), // Rosy brown (mixed food)
        new THREE.Color(0x996633), // Darker brown
    ];

    for (let i = 0; i < particleCount; i++) {
        // Create individual sphere for each food particle
        const size = 0.15 + Math.random() * 0.25; // Larger, more visible
        const geometry = new THREE.SphereGeometry(size, 8, 8);
        
        // Random food color
        const color = foodColors[Math.floor(Math.random() * foodColors.length)];
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.85 + Math.random() * 0.15, // More opaque, solid-looking
            roughness: 0.7,
            metalness: 0.1,
            emissive: color,
            emissiveIntensity: 0.1
        });

        const particle = new THREE.Mesh(geometry, material);
        
        // Random positions within stomach interior
        particle.position.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 9
        );

        // Random velocities for animation
        const velocity = {
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.02
        };
        
        // Random rotation speed
        const rotationSpeed = {
            x: (Math.random() - 0.5) * 0.02,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.02
        };

        particle.userData.velocity = velocity;
        particle.userData.rotationSpeed = rotationSpeed;
        particle.userData.originalPosition = particle.position.clone();
        particle.userData.type = 'particle';
        particle.userData.name = 'Food Particles';
        particle.userData.description = 'Partially digested food particles being broken down by gastric acid and enzymes.';
        particle.userData.isDigested = false; // Game: track if particle has been digested
        particle.userData.points = Math.floor(Math.random() * 5) + 5; // 5-10 points per particle
        
        particle.castShadow = true;
        particle.receiveShadow = true;
        
        particleGroup.add(particle);
        particleData.push(particle);
    }
    
    totalParticles = particleCount;

    particles = particleGroup;
    particles.userData.particleData = particleData;
    particles.userData.type = 'particle';
    particles.userData.name = 'Food Particles & Enzymes';
    particles.userData.description = 'Floating particles representing partially digested food, digestive enzymes, and gastric acid working together to break down nutrients.';
    scene.add(particles);
}


function setupHoverDetection() {
    // Collect all interactive objects
    const interactiveObjects = [];
    
    // Add stomach walls and lining
    if (stomachWall) {
        scene.traverse((object) => {
            if (object.userData && object.userData.type) {
                interactiveObjects.push(object);
            }
        });
    }
    
    // Add gastric fluid
    if (gastricFluid) {
        gastricFluid.traverse((object) => {
            if (object.userData && object.userData.type) {
                interactiveObjects.push(object);
            }
        });
    }
    
    // Add bubbles
    if (bubbleGroup) {
        bubbleGroup.children.forEach(bubble => {
            if (bubble.userData && bubble.userData.type) {
                interactiveObjects.push(bubble);
            }
        });
    }
    
    // Add particles (individual spheres in a group)
    if (particles && particles.userData && particles.userData.particleData) {
        particles.userData.particleData.forEach(particle => {
            if (particle.userData && particle.userData.type) {
                interactiveObjects.push(particle);
            }
        });
    }
    
    // Mouse move event for hover detection
    renderer.domElement.addEventListener('mousemove', (event) => {
        // Update mouse position
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Raycast from camera through mouse position
        raycaster.setFromCamera(mouse, camera);
        
        // Check intersections with all interactive objects
        const intersects = raycaster.intersectObjects(interactiveObjects, true);
        
        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            
            // Check if object has metadata
            if (intersectedObject.userData && intersectedObject.userData.name) {
                // Show tooltip
                showTooltip(intersectedObject.userData.name, intersectedObject.userData.description, event.clientX, event.clientY);
                hoveredObject = intersectedObject;
                
                // Change cursor
                renderer.domElement.style.cursor = 'pointer';
            } else {
                hideTooltip();
                hoveredObject = null;
                renderer.domElement.style.cursor = 'default';
            }
        } else {
            hideTooltip();
            hoveredObject = null;
            renderer.domElement.style.cursor = 'default';
        }
    });
    
    // Hide tooltip when mouse leaves canvas
    renderer.domElement.addEventListener('mouseleave', () => {
        hideTooltip();
        hoveredObject = null;
        renderer.domElement.style.cursor = 'default';
    });
}

function showTooltip(name, description, x, y) {
    if (!tooltip) return;
    
    tooltip.innerHTML = `
        <h4>${name}</h4>
        <p>${description}</p>
    `;
    
    // Position tooltip near mouse, but keep it on screen
    const offset = 15;
    let left = x + offset;
    let top = y + offset;
    
    // Adjust if tooltip would go off screen
    const tooltipWidth = 300;
    const tooltipHeight = 100;
    
    if (left + tooltipWidth > window.innerWidth) {
        left = x - tooltipWidth - offset;
    }
    
    if (top + tooltipHeight > window.innerHeight) {
        top = y - tooltipHeight - offset;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.classList.add('visible');
}

function hideTooltip() {
    if (!tooltip) return;
    tooltip.classList.remove('visible');
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    time += 0.016; // Approximate 60fps delta

    // Animate food particles (3D spheres)
    if (particles && particles.userData.particleData) {
        particles.userData.particleData.forEach((particle) => {
            const velocity = particle.userData.velocity;
            const rotationSpeed = particle.userData.rotationSpeed;
            
            // Update position with velocity and some variation
            const variation = Math.sin(time * 2 + particle.id) * 0.0005;
            particle.position.x += velocity.x + variation;
            particle.position.y += velocity.y + Math.cos(time * 1.5 + particle.id) * 0.0005;
            particle.position.z += velocity.z + Math.sin(time * 0.8 + particle.id * 0.1) * 0.0005;
            
            // Rotate particles for more dynamic look
            particle.rotation.x += rotationSpeed.x;
            particle.rotation.y += rotationSpeed.y;
            particle.rotation.z += rotationSpeed.z;
            
            // Keep particles within stomach bounds
            // X: -5 to 5, Y: -4 to 4, Z: -4.5 to 4.5
            if (Math.abs(particle.position.x) > 5) {
                particle.position.x = -Math.sign(particle.position.x) * 5;
                velocity.x *= -0.8;
            }
            if (Math.abs(particle.position.y) > 4) {
                particle.position.y = -Math.sign(particle.position.y) * 4;
                velocity.y *= -0.8;
            }
            if (Math.abs(particle.position.z) > 4.5) {
                particle.position.z = -Math.sign(particle.position.z) * 4.5;
                velocity.z *= -0.8;
            }
        });
    }

    // Animate gastric fluid with realistic wave motion on flat surface (like water in cup)
    if (gastricFluid && gastricFluid.userData.waterSurface) {
        const waterSurface = gastricFluid.userData.waterSurface;
        const geometry = waterSurface.geometry;
        const positions = geometry.attributes.position;
        const originalPositions = geometry.userData.originalPositions;
        
        if (originalPositions) {
            gastricFluid.userData.waveTime += 0.015;
            const waveTime = gastricFluid.userData.waveTime;
            
            // Create realistic wave animation on flat surface (like water in a cup)
            for (let i = 0; i < positions.count; i++) {
                const i3 = i * 3;
                const x = originalPositions[i3];
                const z = originalPositions[i3 + 2];
                
                // Calculate distance from center
                const distance = Math.sqrt(x * x + z * z);
                const angle = Math.atan2(z, x);
                
                // Multiple wave patterns for realistic liquid motion
                // Radial waves from center
                const radialWave = Math.sin(distance * 0.4 - waveTime * 2) * 0.2;
                // Circular ripples
                const circularWave = Math.sin(angle * 5 + waveTime * 1.5) * 0.12;
                // Cross waves
                const crossWave1 = Math.sin((x * 0.5) + (waveTime * 2.2)) * 0.15;
                const crossWave2 = Math.cos((z * 0.5) + (waveTime * 1.8)) * 0.15;
                // Combined wave pattern
                const waveHeight = radialWave + circularWave + crossWave1 + crossWave2;
                
                // Update Y position (add wave to flat surface)
                positions.array[i3 + 1] = waveHeight;
            }
            
            positions.needsUpdate = true;
            geometry.computeVertexNormals(); // Update normals for proper lighting
        }
    }

    // Animate bubbles with floating motion
    if (bubbleGroup) {
        bubbleGroup.children.forEach((bubble, index) => {
            bubble.position.y = bubble.userData.originalY + Math.sin(time * bubble.userData.speed + bubble.userData.phase) * 0.3;
            bubble.rotation.x += 0.01;
            bubble.rotation.y += 0.015;
            // Subtle scale pulsing
            const pulse = 1 + Math.sin(time * 2 + bubble.userData.phase) * 0.1;
            bubble.scale.set(pulse, pulse, pulse);
        });
    }

    // Subtle animation for rugae (stomach folds)
    if (rugaeGroup) {
        rugaeGroup.children.forEach((rugae, index) => {
            rugae.rotation.x += Math.sin(time + index) * 0.0005;
        });
    }

    // Update controls
    controls.update();
    
    // Render
    renderer.render(scene, camera);
}

