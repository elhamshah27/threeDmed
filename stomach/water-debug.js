// Debug script to test water replacement
console.log('=== WATER DEBUG SCRIPT LOADED ===');

export function testWaterReplacement(scene) {
    console.log('=== TESTING WATER REPLACEMENT ===');
    console.log('Scene:', scene);
    console.log('Scene children count:', scene.children.length);
    
    let waterPlaneCount = 0;
    scene.traverse((object) => {
        console.log('Traversing object:', object.name, 'type:', object.type, 'isMesh:', object.isMesh);
        if (object.name === 'WaterPlane') {
            waterPlaneCount++;
            console.log('FOUND WaterPlane!', object);
            console.log('  - Material:', object.material);
            console.log('  - Position:', object.position);
            console.log('  - Visible:', object.visible);
            console.log('  - Parent:', object.parent);
        }
    });
    
    console.log('Total WaterPlane objects found:', waterPlaneCount);
    return waterPlaneCount;
}


