import * as THREE from 'three';

// Water shader based on Three.js water example
export async function ReplacePlanesWithWater(scene) {
    const waterList = [];
    
    // Try to load water normal map texture
    const textureLoader = new THREE.TextureLoader();
    let waterNormals;
    
    try {
        // Try to load from stomach directory first, then fallback
        waterNormals = await new Promise((resolve, reject) => {
            textureLoader.load(
                './stomach/waternormals.jpg',
                resolve,
                undefined,
                (error) => {
                    console.log('Failed to load waternormals.jpg, using fallback:', error);
                    // Fallback: create a simple procedural normal map
                    const canvas = document.createElement('canvas');
                    canvas.width = 512;
                    canvas.height = 512;
                    const ctx = canvas.getContext('2d');
                    
                    // Create a simple wave pattern normal map
                    const imageData = ctx.createImageData(512, 512);
                    const data = imageData.data;
                    
                    for (let y = 0; y < 512; y++) {
                        for (let x = 0; x < 512; x++) {
                            const i = (y * 512 + x) * 4;
                            const nx = (Math.sin(x * 0.02) * 0.5 + 0.5) * 255;
                            const ny = (Math.cos(y * 0.02) * 0.5 + 0.5) * 255;
                            data[i] = nx;     // R
                            data[i + 1] = ny; // G
                            data[i + 2] = 255; // B
                            data[i + 3] = 255; // A
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                    resolve(new THREE.CanvasTexture(canvas));
                }
            );
        });
    } catch (e) {
        // Create fallback texture
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
        waterNormals = new THREE.CanvasTexture(canvas);
    }
    
    waterNormals.wrapS = THREE.RepeatWrapping;
    waterNormals.wrapT = THREE.RepeatWrapping;
    
    // Find all objects named "WaterPlane" in the scene
    console.log('Searching for WaterPlane objects in scene...');
    let foundCount = 0;
    scene.traverse((object) => {
        if (object.name === 'WaterPlane' && object.isMesh) {
            foundCount++;
            console.log('Found WaterPlane #' + foundCount + ', replacing material');
            
            // Get the userData to preserve it
            const userData = object.userData || {};
            
            // Create water shader material
            const waterMaterial = createWaterMaterial(waterNormals);
            
            // Replace the material directly (simpler approach)
            object.material = waterMaterial;
            object.userData = userData;
            object.userData.isWater = true;
            object.userData.waterTime = 0;
            
            // Store original positions for wave animation
            const geometry = object.geometry;
            if (geometry && geometry.attributes.position && !geometry.userData.originalPositions) {
                const positions = geometry.attributes.position;
                const origPos = new Float32Array(positions.array.length);
                for (let i = 0; i < positions.array.length; i++) {
                    origPos[i] = positions.array[i];
                }
                geometry.userData.originalPositions = origPos;
            }
            
            waterList.push(object);
        }
    });
    
    console.log('ReplacePlanesWithWater found', foundCount, 'WaterPlane objects, created', waterList.length, 'water meshes');
    return waterList;
}

function createWaterMaterial(normalMap) {
    // Create a water-like material with realistic properties - more reflective and liquid-like
    // Make it VERY visually distinct so we can see if replacement worked
    const material = new THREE.MeshStandardMaterial({
        color: 0x88ccff, // Changed to blue-ish to make it OBVIOUSLY different
        transparent: true,
        opacity: 0.8,
        roughness: 0.0, // Perfectly smooth/reflective surface (like real water)
        metalness: 1.0, // Maximum metalness for water-like reflection
        normalMap: normalMap,
        normalScale: new THREE.Vector2(2.0, 2.0), // Very strong normal map effect for visible waves
        side: THREE.DoubleSide
    });
    
    console.log('Created water material with normalMap:', material.normalMap !== null, 'color:', material.color.getHexString());
    return material;
}

export function animateWater(waterMesh) {
    if (!waterMesh.userData.isWater) return;
    
    // Animate the normal map offset for wave effect
    waterMesh.userData.waterTime += 0.01;
    
    if (waterMesh.material.normalMap) {
        waterMesh.material.normalMap.offset.x += 0.001;
        waterMesh.material.normalMap.offset.y += 0.001;
    }
    
    // Animate geometry vertices for realistic wave motion
    if (waterMesh.geometry && waterMesh.geometry.attributes.position) {
        const positions = waterMesh.geometry.attributes.position;
        const originalPositions = waterMesh.geometry.userData.originalPositions;
        
        if (!originalPositions) {
            // Store original positions on first call
            const origPos = new Float32Array(positions.array.length);
            for (let i = 0; i < positions.array.length; i++) {
                origPos[i] = positions.array[i];
            }
            waterMesh.geometry.userData.originalPositions = origPos;
        } else {
            const time = waterMesh.userData.waterTime;
            
            for (let i = 0; i < positions.count; i++) {
                const i3 = i * 3;
                const x = originalPositions[i3];
                const z = originalPositions[i3 + 2];
                
                // Calculate distance from center
                const distance = Math.sqrt(x * x + z * z);
                const angle = Math.atan2(z, x);
                
                // Multiple wave patterns for realistic liquid motion
                const radialWave = Math.sin(distance * 0.4 - time * 2) * 0.2;
                const circularWave = Math.sin(angle * 5 + time * 1.5) * 0.12;
                const crossWave1 = Math.sin((x * 0.5) + (time * 2.2)) * 0.15;
                const crossWave2 = Math.cos((z * 0.5) + (time * 1.8)) * 0.15;
                
                const waveHeight = radialWave + circularWave + crossWave1 + crossWave2;
                
                // Update Y position (wave height)
                positions.array[i3 + 1] = waveHeight;
            }
            
            positions.needsUpdate = true;
            waterMesh.geometry.computeVertexNormals();
        }
    }
}

