// Import necessary modules from the Three.js library
import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// Constants
const cameraOriginalPositionDesktop = new THREE.Vector3(6, 3, 7);
const cameraOriginalPositionMobile = new THREE.Vector3(4, 2, 5);
const model1URL_chess = '/chess-v3.gltf';
const model2URL_toilet = '/chess-v8.gltf';
const textGeometryOptions = {
    size: 1,
    depth: 0.3,
    curveSegments: 12,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.1,
    bevelOffset: 0,
    bevelSegments: 1
};
const textMaterialOptions = { color: 0xffffff, metalness: 0.2, roughness: 0.4 };
const pieceActions = {
    "pawn_black": { target: [2.6, 1.9, 3.7], dialog: "dialogPawn" },
    "pawn_white": { target: [3.12, 2.28, 3.08], dialog: "dialogPawn" },
    "knight_black": { target: [5.15, 2, 1.7], dialog: "dialogKnight" },
    "knight_white": { target: [1.17, 2.8, 5], dialog: "dialogKnight" },
    "bishop_black": { target: [5.5, 2.8, -0.4], dialog: "dialogBishop" },
    "bishop_white": { target: [-0.61, 2.96, 4.8], dialog: "dialogBishop" },
    "rook_black": { target: [4, 2.28, 1.8], dialog: "dialogRook" },
    "rook_white": { target: [2.2, 2.8, 4.1], dialog: "dialogRook" },
    "queen_black": { target: [4, 3.6, 3.15], dialog: "dialogQueen" },
    "queen_white": { target: [-0.32, 3.17, 4.36], dialog: "dialogQueen" },
    "king_black": { target: [4.8, 3.13, -1.86], dialog: "dialogKing" },
    "king_white": { target: [-1.75, 3.37, 4.96], dialog: "dialogKing" }
};

// State variables
let zooming = false;
let clickedObject;
let dialogOpen = false;
let isSpinning = true;
let chessPieces = [];
let currentModel = null;
let toggleToilet = false;
let titleAnimationFrameId;
let isMobile = window.innerWidth < 768;
let interactionEnabled = true;

// Setup basic elements
const clock = new THREE.Clock();
const container = document.getElementById('container');
const stats = new Stats();
stats.dom.style.cssText = 'position: fixed !important; bottom: 0px !important; left: 0px !important; top: auto !important; z-index: 10000;';
//document.body.appendChild(stats.dom); //FPS counter

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x663399);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 100);
camera.position.copy(isMobile ? cameraOriginalPositionMobile : cameraOriginalPositionDesktop);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.update();
controls.enablePan = false;
controls.enableDamping = true;
controls.enabled = false;
controls.enableZoom = true; // Enable zoom for pinch gestures

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('draco/gltf/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let titleMesh;
const fontLoader = new FontLoader();
fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
    createTitleMesh(font);
});

function createTitleMesh(font) {
    const text = toggleToilet ? 'CHESS-O' : 'CHESS';
    const textGeometry = new TextGeometry(text, { font, ...textGeometryOptions });
    const textMaterial = new THREE.MeshStandardMaterial(toggleToilet ? { color: 0x8B4513, metalness: 1, roughness: 0.2 } : textMaterialOptions);
    if (titleMesh) {
        scene.remove(titleMesh);
    }
    titleMesh = new THREE.Mesh(textGeometry, textMaterial);
    textGeometry.computeBoundingBox();
    textGeometry.center();
    scene.add(titleMesh);

    if (window.innerWidth < 768) {
        titleMesh.position.set(0, 3.5, 0); // Move title higher on mobile
    } else {
        titleMesh.position.set(0, 2.5, 0); // Reset title position
    }
    animateTitle();
}

function animateTitle() {
    if (titleAnimationFrameId) {
        cancelAnimationFrame(titleAnimationFrameId);
    }
    function rotateTitle() {
        if (titleMesh) {
            titleMesh.rotation.y += 0.008;
            renderer.render(scene, camera);
            titleAnimationFrameId = requestAnimationFrame(rotateTitle);
        }
    }
    rotateTitle();
}

// Event Handlers
renderer.domElement.addEventListener('mousedown', () => {
    if (!interactionEnabled || zooming) return;
    isSpinning = false;
    controls.enabled = true;
    hideTapToStart();
});

renderer.domElement.addEventListener('pointermove', (event) => {
    if (!interactionEnabled || zooming) return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

renderer.domElement.addEventListener('click', handleClick);
renderer.domElement.addEventListener('touchstart', handleClick);

function handleClick(event) {
    if (!interactionEnabled || dialogOpen || zooming) return;

    if (event.touches) {
        pointer.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
    } else {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(chessPieces, true);
    if (intersects.length > 0) {
        clickedObject = intersects[0].object;
        console.log('Clicked on:', clickedObject.name);

        if (!clickedObject.userData.originalMaterial && !clickedObject.name.includes("Board")) {
            clickedObject.userData.originalMaterial = clickedObject.material;
            clickedObject.material = new THREE.MeshStandardMaterial({
                color: 0xDA1B64,
                emissive: 0x00ff00,
                emissiveIntensity: 0.5,
            });

            handlePieceClick(clickedObject.name.toLowerCase());
        }
    }
}

window.onresize = function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    adjustForMobile();
};

const closeButtons = document.querySelectorAll('.closeDialogButton');
closeButtons.forEach(button => {
    button.addEventListener("click", () => {
        if (zooming) return;
        zooming = true;

        if (clickedObject.userData.originalMaterial) {
            clickedObject.material = clickedObject.userData.originalMaterial;
            delete clickedObject.userData.originalMaterial;
        }

        const dialogId = button.dataset.dialog;
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.style.display = 'none';
        }

        dialogOpen = false;

        gsap.to(camera.position, {
            x: isMobile ? cameraOriginalPositionMobile.x : cameraOriginalPositionDesktop.x,
            y: isMobile ? cameraOriginalPositionMobile.y : cameraOriginalPositionDesktop.y,
            z: isMobile ? cameraOriginalPositionMobile.z : cameraOriginalPositionDesktop.z,
            duration: 2,
            ease: "power2.inOut",
            onComplete: () => {
                zooming = false;
                hideTapToStart(); // Hide overlay when zooming completes
                setInteractionState(true); // Re-enable interactions after zoom back
            }
        });
    });
});

const toggle = document.getElementById('toggleSwitch');
toggle.addEventListener('change', (e) => {
    toggleToilet = e.target.checked;
    console.log('Toggle value:', toggleToilet);
    const modelURL = e.target.checked ? model2URL_toilet : model1URL_chess;
    loadModel(modelURL);
    const fontURL = toggleToilet ? 'https://threejs.org/examples/fonts/helvetiker_bold.typeface.json' : 'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json';
    fontLoader.load(fontURL, (font) => {
        createTitleMesh(font);
    });
    updateDialogueText(toggleToilet);
});

function updateDialogueText(isToiletMode) {
    const dialogues = document.querySelectorAll('.chesspiece li[data-normal][data-toilet]');
    dialogues.forEach(item => {
        const text = isToiletMode ? item.getAttribute('data-toilet') : item.getAttribute('data-normal');
        item.innerHTML = text; // Use innerHTML to ensure the text is properly set
    });
}

function handlePieceClick(pieceName) {
    for (const [key, value] of Object.entries(pieceActions)) {
        if (pieceName.includes(key.split('_')[0]) && pieceName.includes(key.split('_')[1])) {
            zoomToTarget(...value.target);
            showDialog(value.dialog);
            return;
        }
    }
    console.log("Unknown piece");
}

function showDialog(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
        dialog.style.display = 'flex';
        updateDialogueText(toggleToilet); // Ensure text is updated when dialog is shown
    }
}

function zoomToTarget(x, y, z, duration = 2) {
    dialogOpen = true;
    if (zooming) return;
    zooming = true;
    
    setInteractionState(false);

    const targetPosition = new THREE.Vector3(x, y, z);
    gsap.to(camera.position, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: duration,
        ease: "power2.out",
        onComplete: () => {
            zooming = false;
            setInteractionState(false); // Keep interactions disabled while dialog is open
        }
    });
}

const sceneGroup = new THREE.Group();
scene.add(sceneGroup);

function loadModel(url) {
    if (currentModel) {
        disposeModel(currentModel);
        sceneGroup.remove(currentModel);
        currentModel = null;
        chessPieces = [];
    }

    loader.load(url, (gltf) => {
        if (!gltf || !gltf.scene) {
            console.error('Failed to load GLTF model or scene');
            return;
        }
        console.log("Loading new model");

        currentModel = gltf.scene;
        currentModel.scale.set(18, 18, 18);
        currentModel.position.set(0, -1, 0);
        sceneGroup.add(currentModel);

        currentModel.traverse((child) => {
            if (child.isMesh) {
                chessPieces.push(child);
                child.name = child.name || `ChessPiece_${chessPieces.length}`;
            }
        });

        renderer.setAnimationLoop(animate);
    },
        (progress) => {
            console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
            console.error('Error loading model:', error);
        }
    );
}

function disposeModel(model) {
    model.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
            } else {
                object.material.dispose();
            }
        }
    });
}

function animate() {
    updateCameraPosition();
    const delta = clock.getDelta();

    if (isSpinning) {
        const speed = 0.3;
        sceneGroup.rotation.y += speed * delta;
    }

    controls.update();
    stats.update();
    renderer.render(scene, camera);
}

function updateCameraPosition() {
    const cameraPositionDiv = document.getElementById('cameraPosition');
    cameraPositionDiv.textContent = `Camera Position: X: ${camera.position.x.toFixed(2)}, Y: ${camera.position.y.toFixed(2)}, Z: ${camera.position.z.toFixed(2)}`;
}

function adjustForMobile() {
    isMobile = window.innerWidth < 768;
    if (isMobile) {
        camera.position.copy(cameraOriginalPositionMobile);
        controls.enableZoom = true;
        scene.scale.set(0.4, 0.4, 0.4); // Scale down the scene
        if (titleMesh) {
            titleMesh.position.set(0, 3.5, 0); // Move title higher on mobile
        }
        showTapToStart(); // Show overlay on mobile
    } else {
        camera.position.copy(cameraOriginalPositionDesktop);
        controls.enableZoom = false;
        scene.scale.set(1, 1, 1); // Reset the scene scale
        if (titleMesh) {
            titleMesh.position.set(0, 2.5, 0); // Reset title position
        }
        hideTapToStart(); // Hide overlay on desktop
    }
}

function showTapToStart() {
    const tapToStartOverlay = document.getElementById('tapToStartOverlay');
    if (tapToStartOverlay) {
        tapToStartOverlay.style.display = 'flex';
        tapToStartOverlay.addEventListener('click', onTapToStart, { once: true });
    }
}

function hideTapToStart() {
    const tapToStartOverlay = document.getElementById('tapToStartOverlay');
    if (tapToStartOverlay) {
        tapToStartOverlay.style.display = 'none';
    }
}

function onTapToStart(event) {
    isSpinning = false;
    hideTapToStart();
    // Manually trigger the click event on the canvas to ensure immediate interaction
    const canvasEvent = new MouseEvent('mousedown', {
        clientX: event.clientX,
        clientY: event.clientY,
        bubbles: true,
        cancelable: true
    });
    renderer.domElement.dispatchEvent(canvasEvent);
}

function setInteractionState(enabled) {
    interactionEnabled = enabled;
    controls.enabled = enabled && !isSpinning;
}

adjustForMobile();
loadModel(model1URL_chess);