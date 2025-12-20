import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
//import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
//import { Pane } from "tweakpane";

var controls, renderer, scene, camera, clock;
var mouseX = 0;
var mouseY = 0;

window.onload = async function() {
    scene = new THREE.Scene();

    // setup the camera
    const fov = 25;
    const ratio = window.innerWidth / window.innerHeight;
    const zNear = 1;
    const zFar = 1000;
    camera = new THREE.PerspectiveCamera( fov, ratio, zNear, zFar );
    camera.position.set(0, 0, 35);

    // create renderer and setup the canvas
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    renderer.domElement.onmousedown = function( e ){
        //console.log(scene);
        //console.log('Yay! We clicked!');

        const pixel_coords = new THREE.Vector2( e.clientX, e.clientY );

        //console.log('Pixel coords', pixel_coords);

        const vp_coords = new THREE.Vector2(
                    ( pixel_coords.x / window.innerWidth ) * 2 - 1,  //X
                    -( pixel_coords.y / window.innerHeight ) * 2 + 1) // Y

        //console.log('Viewport coords', vp_coords);

        const vp_coords_near = new THREE.Vector3( vp_coords.x, vp_coords.y, 0);


        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(vp_coords_near, camera);

        function clickah (ref){
            const intersects = raycaster.intersectObject(ref);
            if (intersects.length > 0) {
                const obj = intersects[0].object;
                //console.log(obj);
                window.open(ref.userData.URL);
            }
        }
        clickah(heart);
    };


    // setup lights
    const ambientLight = new THREE.AmbientLight();
    scene.add(ambientLight);

    const light = new THREE.DirectionalLight( 0xffffff, 2.0 );
    light.position.set( 10, 100, 10 );
    scene.add( light );

    const gltfLoader = new GLTFLoader();
    var url = 'models/heart/scene.gltf';

    var heart;
    await gltfLoader.load(url, (gltf) => {
        heart = gltf.scene.children[0];

        const scale = 1;
        heart.scale.x = scale;
        heart.scale.y = scale;
        heart.scale.z = scale;

        heart.translateZ(1 * scale);
        heart.userData.URL = "pulse";
        scene.add(heart);
    });
    controls = new OrbitControls( camera, renderer.domElement );

    // call animation/rendering loop
    animate();
};

function animate() {

    requestAnimationFrame( animate );

    //console.log(controls.getDirection())
    controls.update();

    renderer.render( scene, camera );


};

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
})
