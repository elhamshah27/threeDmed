import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Pane } from "tweakpane";

var controls, renderer, scene, camera;
var mouseX = 0;
var mouseY = 0;

window.onload = async function() {
    scene = new THREE.Scene();

    // setup the camera
    const fov = 15;
    const ratio = window.innerWidth / window.innerHeight;
    const zNear = .5;
    const zFar = 1000;
    camera = new THREE.PerspectiveCamera( fov, ratio, zNear, zFar );
    camera.position.set(0, 0, 100);

    var camVector = new THREE.Vector3(); // create once and reuse it!
    // create renderer and setup the canvas
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor('yellow');
    document.body.appendChild( renderer.domElement );

    renderer.domElement.onmousemove = function( e ){
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
        console.log(raycaster.ray.direction)


        camera.getWorldDirection(camVector);
        console.log(camVector.angleTo(raycaster.ray.direction));
        console.log(camera);
        //var theta = Math.acos( A.dot(B) / A.length() / B.length() );

    };
  
    renderer.domElement.onmouseup = function() {
        controls.unlock();
    }
    renderer.domElement.onmousedown = function() {
        controls.lock();
    }
    // mouse camera movement
    document.addEventListener('mousemove', function (e) {
        const windowHalfX = window.innerWidth / 2;
        const windowHalfY = window.innerHeight / 2;
        mouseX = (e.clientX - windowHalfX) / 100;
        mouseY = (e.clientY - windowHalfY) / 100;
        //camera.lookAt(mouseX, mouseY, 0);
    });

  
    // setup lights
    const ambientLight = new THREE.AmbientLight();
    scene.add(ambientLight);
  
    const light = new THREE.DirectionalLight( 0xffffff, 2.0 );
    light.position.set( 10, 100, 10 );
    scene.add( light );

    const gltfLoader = new GLTFLoader();
    var url = 'models/interior_heart/scene.gltf';

    var heart;
    await gltfLoader.load(url, (gltf) => {
        heart = gltf.scene.children[0];

        const scale = 100;
        heart.scale.x = scale;
        heart.scale.y = scale;
        heart.scale.z = scale;

        heart.translateZ(-1 * scale);
        heart.translateY(7);
        //heart.userData.URL = "https://www.stackoverflow.com";
        scene.add(heart);
    });

    /*
    var url = 'models/heart2/scene.gltf';
    await gltfLoader.load(url, (gltf) => {
        heart = gltf.scene.children[0];

        heart.scale.x = 1;
        heart.scale.y = 1;

        heart.scale.z = 1;

        //heart.translateZ(-6);
        //heart.userData.URL = "https://www.stackoverflow.com";
        scene.add(heart);
    });
    */

    // interaction
    // (3)
    //controls = new OrbitControls( camera, renderer.domElement );
    /*
    controls = new FirstPersonControls(camera, renderer.domElement);
    controls.lookSpeed = 1;
    */
    /*
    controls = new FlyControls(camera, renderer.domElement);
    controls.dragToLook = true;
    controls.rollSpeed = 100;
    */
    controls = new PointerLockControls(camera, renderer.domElement);

    // call animation/rendering loop
    animate();
};

function animate() {
  
    requestAnimationFrame( animate );
  
    // and here..
    //console.log(controls.getDirection())
    controls.update();

    renderer.render( scene, camera );

};

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
})
