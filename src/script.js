import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Pane } from "tweakpane";

var controls, renderer, scene, camera;

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
    //renderer.setClearColor("blue")
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
        //let intersects = raycaster.intersectObject(invisible_plane);
        //console.log('Ray to Invisible Plane', intersects[0].point);
        //console.log(mrbones);
        function clickah (ref){
            const intersects = raycaster.intersectObject(ref);
            if (intersects.length > 0) {
                const obj = intersects[0].object;
                console.log(obj);
                window.open(ref.userData.URL);
            }
        }
        //clickah(mrbones);
        clickah(brain);
        clickah(stomach);
        //

  
        // update torus position

        if (e.shiftKey){
            controls.enabled = false
            // store a reference to the last placed torus in the global variable .
            torus = makeTorus()
            scene.add(torus);
            if (intersects.length > 0) {
                torus.position.set(intersects[0].point.x, intersects[0].point.y, intersects[0].point.z);
            }
        }
    };


    renderer.domElement.onmouseup = function() {
        controls.enabled = true;
    }


  
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
    /*
    light = new THREE.DirectionalLight( 0xffffff, 7.0 );
    light.position.set( -10, 100, 10 );
    scene.add( light );
    light = new THREE.DirectionalLight( 0xffffff, 7.0 );
    light.position.set( 10, 100, 10 );
    scene.add( light );
    */

    // invisible plane
    const geometry = new THREE.PlaneGeometry( 10000, 10000 );
    const material = new THREE.MeshBasicMaterial( {
        visible: false
    });

    //const invisible_plane = new THREE.Mesh( geometry, material );

    //scene.add(invisible_plane);

    // LOAD THE ARMADILLO
    /*
    var loader = new PLYLoader();
    loader.load('armadillo/armadillo.ply', function(geometry) {

      geometry.computeVertexNormals();

      var material = new THREE.MeshStandardMaterial({ color: 'white',
        metalness: 1.0,
        roughness: 0.1
      });

      window.material = material;

      var mesh = new THREE.Mesh( geometry, material );

      window.mesh = mesh;

      scene.add( mesh );

    })
    */ 

    // Loading Mr. Bones

    var mrbones;
    var url = 'models/mrbones/scene.gltf';
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(url, (gltf) => {
        mrbones = gltf.scene.children[0];
        //mrbones.userData.URL = "https://threeDmed.org";

        mrbones.scale.x = 1;
        mrbones.scale.y = 1;
        mrbones.scale.z = 1;

        mrbones.translateX(0);
        mrbones.translateY(0);
        mrbones.translateZ(0);

        scene.add(mrbones);
    });

    // Brain
    var brain;
    url = 'models/fullbrain.glb'
    gltfLoader.load(url, (gltf) => {
        brain = gltf.scene.children[0];
        brain.userData.URL = "./brain/";

        const q = rotationQuaternion(90, [0, 1, 0]);
        brain.quaternion.w = q.w
        brain.quaternion.x = q.x
        brain.quaternion.y = q.y
        brain.quaternion.z = q.z

        const scale = .007;
        brain.scale.x = 1 * scale;
        brain.scale.y = 1 * scale;
        brain.scale.z = 1 * scale;


        brain.translateX(0);
        brain.translateY(6.7);
        brain.translateZ(0);

        scene.add(brain);
    });

    // Stomach
    var stomach;
    url = 'models/organs/stomach.glb'
    gltfLoader.load(url, (gltf) => {
        stomach = gltf.scene.children[0];
        console.log(stomach);
        stomach.userData.URL = "./stomach/";
        let q = stomach.quaternion;
        console.log(q)
        const r = rotationQuaternion(180, [0, 0, 1]);
        q.multiply(r);

        stomach.quaternion.w = q.w
        stomach.quaternion.x = q.x
        stomach.quaternion.y = q.y
        stomach.quaternion.z = q.z

        const scale = 2;
        stomach.scale.x = 1 * scale;
        stomach.scale.y = 1 * scale;
        stomach.scale.z = 1 * scale;


        stomach.translateX(-0.3);
        stomach.translateY(0.5);
        stomach.translateZ(2.6);

        scene.add(stomach);
    });
    // interaction
    controls = new OrbitControls( camera, renderer.domElement );
  
    // call animation/rendering loop
    animate();
};

function animate() {
  
    requestAnimationFrame( animate );
  
    // and here..
    controls.update();
    renderer.render( scene, camera );

};

//auto resizing
window.addEventListener('resize', function () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function rotationQuaternion (angle, axis) {
    const t = (angle * Math.PI) / 180

    const x = Math.sin(t / 2) * axis[0];
    const y = Math.sin(t / 2) * axis[1];
    const z = Math.sin(t / 2) * axis[2];
    const w = Math.cos(t / 2);

    return new THREE.Quaternion(x, y, z, w);
}

