import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

var controls, renderer, scene, camera, heart;

window.onload = async function() {
    scene = new THREE.Scene();

    // setup the camera
    const fov = 15;
    const ratio = window.innerWidth / window.innerHeight;
    const zNear = .5;
    const zFar = 1000;
    camera = new THREE.PerspectiveCamera( fov, ratio, zNear, zFar );
    camera.position.set(0, 20, 200);

    var camVector = new THREE.Vector3(); // create once and reuse it!
    // create renderer and setup the canvas
    const canvas = document.getElementById('threejs');
    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: canvas
    });
    renderer.setClearColor( 0x000000, 0);
    renderer.setSize( window.innerWidth, window.innerHeight );

    // webcam as background image --> chatGPT
    async function startWebcamBackground() {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const video = document.getElementById("video-bg");
          video.srcObject = stream;
      } catch (err) {
          console.error('Error accessing webcam:', err);
          //window.close();
      }
    };

    //startWebcamBackground();

    var webcam = confirm('Would you like to see your heart beating?')
    if (webcam) {
        renderer.setClearColor( 0xffffff, 0);
        //turn off background and add webcam bg
        document.getElementsByTagName('html')[0].style.backgroundImage = 'none'
        document.getElementsByTagName('html')[0].style.backgroundSize = 'none'
        startWebcamBackground();
    };


    renderer.domElement.onmousedown = function( e ){
        //console.log(scene);
        //console.log('Yay! We clicked!');

        const pixel_coords = new THREE.Vector2( e.clientX, e.clientY );

        //console.log('Pixel coords', pixel_coords);

        const vp_coords = new THREE.Vector2(
                    ( pixel_coords.x / window.innerWidth ) * 2 - 1,  //X
                    -( pixel_coords.y / window.innerHeight ) * 2 + 1) // Y

        console.log('Viewport coords', vp_coords);

        const vp_coords_near = new THREE.Vector3( vp_coords.x, vp_coords.y, 0);

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(vp_coords_near, camera);
        console.log(raycaster)
    };


    // setup lights
    const ambientLight = new THREE.AmbientLight();
    scene.add(ambientLight);

    const light = new THREE.DirectionalLight( 0xffffff, 2.0 );
    light.position.set( 10, 100, 10 );
    scene.add( light );

    const gltfLoader = new GLTFLoader();
    var url = 'models/heart/scene.gltf';
    await gltfLoader.load(url, (gltf) => {
        heart = gltf.scene.children[0];

        const scale = 1;
        heart.scale.x *= scale;
        heart.scale.y *= scale;
        heart.scale.z *= scale;

        heart.translateZ(1);
        scene.add(heart);
    });
    animate();
};

const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
const detectorConfig = {
  runtime: 'mediapipe',
  solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection',
};
const detector = await faceDetection.createDetector(model, detectorConfig);

async function getHeartPosition(){
    const image = captureFrame('video-bg');
    const faces = await detector.estimateFaces(image);
    if (faces.length > 0) {
        //console.log('face detected')
        const box = faces[0].box
        const centerX = box.xMin + (box.width / 2)
        const centerY = box.yMin + (box.height / 2)
        const scalar = box.height / 2;
        return [centerX, centerY, scalar]
    } else {
        //console.log('no faces :(')
        return null;
    }
}

// Capture a single frame
function captureFrame(id) {
    const video = document.getElementById(id);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Or get as data URL
    const dataURL = canvas.toDataURL('image/png');

    // Or get as blob
    canvas.toBlob((blob) => {
        // Do something with blob
    }, 'image/jpeg', 0.95);

    return imageData;
}
async function animate() {
    requestAnimationFrame( animate );
    const heart_pos = await getHeartPosition()
    if (heart_pos) {
        console.log(heart_pos);
        console.log(heart)
        heart.position.x = heart_pos[0] / 10 - 25
        heart.position.y = - heart_pos[1] / 10 + 20

        heart.scale.x = heart_pos[2] / 50
        heart.scale.y = heart_pos[2] / 50
        heart.scale.z = heart_pos[2] / 50
    }

    renderer.render(scene, camera);

};

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
})
