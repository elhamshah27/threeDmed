import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Pane } from "tweakpane";

var controls, renderer, scene, camera;
var mrbones, brain, stomach, heart;
var currentMode = 'skeleton'; // 'skeleton' or 'organs'
var sectionBoxes = []; // Store the three section boxes

window.onload = async function() {
    scene = new THREE.Scene();

    // setup the camera
    const fov = 75;
    const ratio = window.innerWidth / window.innerHeight;
    const zNear = 1;
    const zFar = 100;
    camera = new THREE.PerspectiveCamera( fov, ratio, zNear, zFar );
    camera.position.set(0, 5, 15);
  
    // create renderer and setup the canvas
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );
  
    // setup lights
    const ambientLight = new THREE.AmbientLight("white", 10);
    scene.add(ambientLight);
  
    var light = new THREE.DirectionalLight( 0xffffff, 7.0 );
    light.position.set( 10, 100, 10 );
    scene.add( light );
    light = new THREE.DirectionalLight( 0xffffff, 7.0 );
    light.position.set( -10, 100, -10 );
    scene.add( light );
    light = new THREE.DirectionalLight( 0xffffff, 7.0 );
    light.position.set( 10, 25, 10 );
    scene.add( light );

    const gltfLoader = new GLTFLoader();

    // Create three visible section boxes for organs mode
    createSectionBoxes();

    // Loading Mr. Bones (Skeleton)
    var url = 'models/mrbones/scene.gltf';
    gltfLoader.load(url, (gltf) => {
        mrbones = gltf.scene.children[0];
        mrbones.scale.x = 1;
        mrbones.scale.y = 1;
        mrbones.scale.z = 1;
        mrbones.translateX(0);
        mrbones.translateY(0);
        mrbones.translateZ(0);
        scene.add(mrbones);
        updateModeVisibility();
    });

    // Brain - Top Right
    url = 'models/fullbrain.glb';
    gltfLoader.load(url, (gltf) => {
        brain = gltf.scene.children[0];
        brain.userData.URL = "./brain/";

        // Store original skeleton mode rotation
        const q = rotationQuaternion(90, [0, 1, 0]);
        brain.userData.skeletonRotation = q;
        brain.userData.organsRotation = new THREE.Euler(0, 0, 0);

        scene.add(brain);
        updateOrganPositions();
        updateModeVisibility();
    });

    // Stomach - Bottom Center
    url = 'models/organs/stomach.glb';
    gltfLoader.load(url, (gltf) => {
        stomach = gltf.scene.children[0];
        stomach.userData.URL = "/stomach";
        
        // Store the original quaternion from the model
        stomach.userData.originalQuaternion = stomach.quaternion.clone();
        // Store the rotation to apply (matching original code)
        stomach.userData.skeletonRotation = rotationQuaternion(180, [0, 0, 1]);
        stomach.userData.organsRotation = new THREE.Euler(Math.PI / 2, Math.PI, 0);

        scene.add(stomach);
        updateOrganPositions();
        updateModeVisibility();
    });

    // Heart - Top Left
    url = 'models/heart-cross-section/scene.gltf';
    gltfLoader.load(url, (gltf) => {
        heart = gltf.scene.children[0];
        heart.userData.URL = "/heart";

        // Store rotations for both modes (same for heart)
        heart.userData.skeletonRotation = new THREE.Euler(0, 0, 0);
        heart.userData.organsRotation = new THREE.Euler(0, 0, 0);

        scene.add(heart);
        updateOrganPositions();
        updateModeVisibility();
    });

    // Click handling
    renderer.domElement.onmousedown = function( e ) {
        const pixel_coords = new THREE.Vector2( e.clientX, e.clientY );
        const vp_coords = new THREE.Vector2( 
            ( pixel_coords.x / window.innerWidth ) * 2 - 1,
            -( pixel_coords.y / window.innerHeight ) * 2 + 1
        );
        const vp_coords_near = new THREE.Vector3( vp_coords.x, vp_coords.y, 0);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(vp_coords_near, camera);

        if (currentMode === 'organs') {
            // In organs mode, check for clicks on organs and navigate
            const organs = [brain, stomach, heart].filter(org => org !== undefined);
            for (let organ of organs) {
                const intersects = raycaster.intersectObject(organ, true);
                if (intersects.length > 0 && organ.userData.URL) {
                    window.location.href = organ.userData.URL;
                    return;
                }
            }
        } else {
            // In skeleton mode, check for clicks on brain and stomach
            if (brain) {
                const intersects = raycaster.intersectObject(brain, true);
                if (intersects.length > 0 && brain.userData.URL) {
                    window.location.href = brain.userData.URL;
                    return;
                }
            }
            if (stomach) {
                const intersects = raycaster.intersectObject(stomach, true);
                if (intersects.length > 0 && stomach.userData.URL) {
                    window.location.href = stomach.userData.URL;
                    return;
                }
            }
        }
    };

    // Mode toggle buttons
    const skeletonBtn = document.getElementById('skeleton-mode-btn');
    const organsBtn = document.getElementById('organs-mode-btn');


    organsBtn.addEventListener('click', () => {
        currentMode = 'organs';
        organsBtn.classList.add('active');
        skeletonBtn.classList.remove('active');
        updateOrganPositions();
        updateModeVisibility();
        updateCameraPosition();
        updateLabelsVisibility();
    });
    
    skeletonBtn.addEventListener('click', () => {
        currentMode = 'skeleton';
        skeletonBtn.classList.add('active');
        organsBtn.classList.remove('active');
        updateOrganPositions();
        updateModeVisibility();
        updateCameraPosition();
        updateLabelsVisibility();
    });

    // interaction
    controls = new OrbitControls( camera, renderer.domElement );
  
    // Initialize labels visibility
    updateLabelsVisibility();
  
    // call animation/rendering loop
    animate();
};

function getScreenDimensions() {
    // Calculate screen dimensions to fill the entire viewport
    const cameraDistance = 20;
    const fov = 75;
    const fovRad = (fov * Math.PI) / 180;
    const screenHeight = 2 * Math.tan(fovRad / 2) * cameraDistance;
    const screenWidth = screenHeight * (window.innerWidth / window.innerHeight);
    return { width: screenWidth, height: screenHeight };
}

function updateOrganPositions() {
    if (currentMode === 'organs') {
        // Organs mode: position on flat screen
        const { width: screenWidth, height: screenHeight } = getScreenDimensions();
        const screenZ = 0;
        
        // Brain - top right
        if (brain) {
            brain.scale.set(0.028, 0.028, 0.028);
            brain.rotation.copy(brain.userData.organsRotation);
            brain.position.set(screenWidth * 0.15, screenHeight * 0.15, screenZ + 3);
        }
        
        // Heart - top left
        if (heart) {
            heart.scale.set(2.5, 2.5, 2.5);
            heart.rotation.copy(heart.userData.organsRotation);
            heart.position.set(-screenWidth * 0.25, screenHeight * 0.25, screenZ + 3);
        }
        
        // Stomach - bottom center
        if (stomach) {
            stomach.scale.set(8, 8, 8);
            stomach.rotation.copy(stomach.userData.organsRotation);
            stomach.position.set(0, -screenHeight * 0.18, screenZ + 3);
        }
    } else {
        // Skeleton mode: position organs within skeleton (using original positions)
        // Brain - positioned in head area
        if (brain) {
            brain.scale.set(0.007, 0.007, 0.007);
            if (brain.userData.skeletonRotation) {
                brain.quaternion.copy(brain.userData.skeletonRotation);
            }
            brain.position.set(0, 6.7, 0);
        }
        
        // Heart - positioned in upper chest/ribcage area
        if (heart) {
            heart.scale.set(0.5, 0.5, 0.5);
            heart.rotation.set(0, 0, 0);
            heart.position.set(0, 3.5, 1.5);
        }
        
        // Stomach - using exact original position and rotation (matching original code)
        if (stomach) {
            const scale = 2;
            stomach.scale.set(scale, scale, scale);
            
            // Apply rotation exactly like original code: get quaternion, multiply with rotation
            if (stomach.userData.originalQuaternion && stomach.userData.skeletonRotation) {
                let q = stomach.userData.originalQuaternion.clone();
                const r = stomach.userData.skeletonRotation;
                q.multiply(r);
                stomach.quaternion.w = q.w;
                stomach.quaternion.x = q.x;
                stomach.quaternion.y = q.y;
                stomach.quaternion.z = q.z;
            }
            
            // Use translateX/Y/Z to match original code behavior
            stomach.position.set(0, 0, 0);
            stomach.translateX(-0.3);
            stomach.translateY(0.5);
            stomach.translateZ(2.6);
        }
    }
}

function createSectionBoxes() {
    // Create a flat 2D screen divided into three sections
    const { width: screenWidth, height: screenHeight } = getScreenDimensions();
    const screenZ = 0; // Position at z=0 (flat screen)
    
    // Create the main background screen - full viewport
    const backgroundGeometry = new THREE.PlaneGeometry(screenWidth, screenHeight);
    const backgroundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a2e,
        side: THREE.DoubleSide
    });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    background.position.set(0, 0, screenZ);
    background.rotation.y = Math.PI; // Face the camera
    scene.add(background);
    sectionBoxes.push(background);
    
    // Create divider lines
    const dividerMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.5
    });
    
    // Vertical divider (separates top left and top right)
    const verticalDivider = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, screenHeight * 0.5),
        dividerMaterial
    );
    verticalDivider.position.set(0, screenHeight * 0.25, screenZ + 0.01);
    verticalDivider.rotation.y = Math.PI;
    scene.add(verticalDivider);
    sectionBoxes.push(verticalDivider);
    
    // Horizontal divider (separates top and bottom)
    const horizontalDivider = new THREE.Mesh(
        new THREE.PlaneGeometry(screenWidth, 0.15),
        dividerMaterial
    );
    horizontalDivider.position.set(0, 0, screenZ + 0.01);
    horizontalDivider.rotation.y = Math.PI;
    scene.add(horizontalDivider);
    sectionBoxes.push(horizontalDivider);
    
    // Create three section backgrounds with subtle colors
    const sectionHeight = screenHeight * 0.5;
    const sectionWidth = screenWidth * 0.5;
    
    // Top-left section (heart) - subtle red tint
    const heartSection = new THREE.Mesh(
        new THREE.PlaneGeometry(sectionWidth, sectionHeight),
        new THREE.MeshStandardMaterial({ 
            color: 0x2a1a1a,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        })
    );
    heartSection.position.set(-sectionWidth/2, screenHeight * 0.25, screenZ + 0.005);
    heartSection.rotation.y = Math.PI;
    scene.add(heartSection);
    sectionBoxes.push(heartSection);
    
    // Top-right section (brain) - subtle blue tint
    const brainSection = new THREE.Mesh(
        new THREE.PlaneGeometry(sectionWidth, sectionHeight),
        new THREE.MeshStandardMaterial({ 
            color: 0x1a1a2a,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        })
    );
    brainSection.position.set(sectionWidth/2, screenHeight * 0.25, screenZ + 0.005);
    brainSection.rotation.y = Math.PI;
    scene.add(brainSection);
    sectionBoxes.push(brainSection);
    
    // Bottom section (stomach) - subtle green tint
    const stomachSection = new THREE.Mesh(
        new THREE.PlaneGeometry(screenWidth, sectionHeight),
        new THREE.MeshStandardMaterial({ 
            color: 0x1a2a1a,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        })
    );
    stomachSection.position.set(0, -screenHeight * 0.25, screenZ + 0.005);
    stomachSection.rotation.y = Math.PI;
    scene.add(stomachSection);
    sectionBoxes.push(stomachSection);
}

function updateLabelsVisibility() {
    const heartLabel = document.getElementById('heart-label');
    const brainLabel = document.getElementById('brain-label');
    const stomachLabel = document.getElementById('stomach-label');
    
    if (currentMode === 'organs') {
        if (heartLabel) heartLabel.classList.add('visible');
        if (brainLabel) brainLabel.classList.add('visible');
        if (stomachLabel) stomachLabel.classList.add('visible');
    } else {
        if (heartLabel) heartLabel.classList.remove('visible');
        if (brainLabel) brainLabel.classList.remove('visible');
        if (stomachLabel) stomachLabel.classList.remove('visible');
    }
}

function updateModeVisibility() {
    // Show/hide models based on current mode
    if (mrbones) {
        mrbones.visible = (currentMode === 'skeleton');
    }
    // Organs are visible in both modes, just positioned differently
    if (brain) {
        brain.visible = true;
        brain.traverse((child) => {
            if (child.isMesh) {
                child.visible = true;
            }
        });
    }
    if (stomach) {
        stomach.visible = true;
        stomach.traverse((child) => {
            if (child.isMesh) {
                child.visible = true;
            }
        });
    }
    if (heart) {
        heart.visible = true;
        heart.traverse((child) => {
            if (child.isMesh) {
                child.visible = true;
            }
        });
    }
    
    // Show/hide section boxes (only in organs mode)
    sectionBoxes.forEach(box => {
        box.visible = (currentMode === 'organs');
    });
}

function updateCameraPosition() {
    // Adjust camera position based on mode
    if (currentMode === 'organs') {
        // Fixed camera view for organs - looking straight at the flat 2D screen
        camera.position.set(0, 0, 20);
        controls.target.set(0, 0, 0);
        // Disable orbit controls in organs mode to keep view fixed (flat 2D view)
        controls.enabled = false;
    } else {
        // Original position for skeleton
        camera.position.set(0, 5, 15);
        controls.target.set(0, 0, 0);
        controls.enabled = true;
    }
    controls.update();
}

function animate() {
    requestAnimationFrame( animate );
    controls.update();
    
    // Rotate organs in organs mode only
    if (currentMode === 'organs') {
        if (heart) {
            heart.rotation.y += 0.01;
        }
        if (brain) {
            brain.rotation.y += 0.01;
        }
        if (stomach) {
            // Rotate on X and Z axes instead of Y
            stomach.rotation.x += 0.01;
            stomach.rotation.z += 0.01;
        }
    }
    
    renderer.render( scene, camera );
}

//auto resizing
window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  // Update organ positions when window resizes in organs mode
  if (currentMode === 'organs') {
    if (heart) positionOrganForScreen(heart, 'top-left');
    if (brain) positionOrganForScreen(brain, 'top-right');
    if (stomach) positionOrganForScreen(stomach, 'bottom');
  }
});

function rotationQuaternion (angle, axis) {
    const t = (angle * Math.PI) / 180;
    const x = Math.sin(t / 2) * axis[0];
    const y = Math.sin(t / 2) * axis[1];
    const z = Math.sin(t / 2) * axis[2];
    const w = Math.cos(t / 2);
    return new THREE.Quaternion(x, y, z, w);
}
