var container, scene, camera;
var inOculusMode = false;

var CAMERA_HORIZON = 25000;
var minCameraFov = 15, maxCameraFov = 75;
var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;

var effect;
var WEBSOCKET_ADDR = "ws://127.0.0.1:1981";
var USE_TRACKER = true;
var USE_WEBVR = false;

var MOUSE_SPEED = 0.005;
var KEYBOARD_SPEED = 0.002;
var FAR = 1000;
var NEAR = 0.1;

var HMDRotation = new THREE.Quaternion();
var HMDTranslation = new THREE.Vector3();

var headingVector = new THREE.Euler(0,0,0,'YZX');
var moveVector = new THREE.Vector3();
var keyboardMoveVector = new THREE.Vector3();
var gamepadMoveVector = new THREE.Vector3();
var BaseRotation = new THREE.Quaternion();
var BaseRotationEuler = new THREE.Euler(0,0,0,'YZX');

var regularRenderer;
var oculusRenderer;
var currentRenderer;

var mouseButtonDown;

//WEBVR
var cameraLeft = new THREE.PerspectiveCamera();
cameraLeft.matrixAutoUpdate = false;
var cameraRight = new THREE.PerspectiveCamera();
cameraRight.matrixAutoUpdate = false;
var eyeOffsetLeft = new THREE.Matrix4();
var eyeOffsetRight = new THREE.Matrix4();

var lastMouseX = 0;
var lastMouseY = 0;

function angleRangeDeg(angle) {
  angle %= 360;
  if (angle < 0) angle += 360;
  return angle;
}

function angleRangeRad(angle) {
  angle %= 2*Math.PI;
  if (angle < 0) angle += 2*Math.PI;
  return angle;
}

function initScene(){

    $container = $('#viewContainer');

    $('#toggle-webvr').click(function() {
        USE_WEBVR = true;
        USE_TRACKER = false;
    });

    window.addEventListener( 'resize', resize, false );

	camera = new THREE.PerspectiveCamera(maxCameraFov, WIDTH/HEIGHT, 0.1, CAMERA_HORIZON);

	scene = new THREE.Scene();
	scene.add(camera);

	camera.position.set(0,0,10);
	camera.lookAt(scene.position);

	regularRenderer = new THREE.WebGLRenderer({preserveDrawingBuffer: true});

    regularRenderer.autoClearColor = false;
	regularRenderer.setSize(WIDTH, HEIGHT);

	currentRenderer = regularRenderer;

	$container.append(regularRenderer.domElement);

	//Pictures
	var panoramaBox = new THREE.BoxGeometry(128, 128, 128, 16, 16, 16);

	var panoramArray = [];
	for (var i = 0; i < 6; i++){
	    var timestamp = new Date().getTime();
        var image = new Image();
        image.src = panoramasArray[i];
        var $image = $(image);
        $image.attr('id', 'image-' + i + timestamp);
        $image.data('timestamp', timestamp);
        $image.addClass('panorama-image');

        $image.hide();
        $('body').append($image);
        var texture = new THREE.Texture($image);
        texture.image = $('#' + $image.attr('id'))[0];
        texture.needsUpdate = true;

        panoramArray.push( new THREE.MeshBasicMaterial({
			map: texture,
			side: THREE.BackSide
		}));
	}

	var material = new THREE.MeshFaceMaterial(panoramArray);
	var panoramaMesh = new THREE.Mesh(panoramaBox, material);
	scene.add(panoramaMesh);
}

/**
* Sets up the event listeners so we
* can click and drag the cube around
*/
$('#viewContainer').on( "vmousedown", function(event) {
  mouseButtonDown = true;
  lastClientX = event.clientX;
  lastClientY = event.clientY;

  event.preventDefault();
});

$('#viewContainer').on( "vmouseup", function(event) {
  mouseButtonDown = false;
});

$('#viewContainer').on( "vmousemove", function(event) {
     if (mouseButtonDown) {
         var enableX = 1;
         BaseRotationEuler.set(
         angleRangeRad(BaseRotationEuler.x + (event.clientY - lastClientY) * MOUSE_SPEED * enableX),
         angleRangeRad(BaseRotationEuler.y + (event.clientX - lastClientX) * MOUSE_SPEED),0.0);
         lastClientX = event.clientX;
         lastClientY = event.clientY;
         BaseRotation.setFromEuler(BaseRotationEuler);
     }
     event.preventDefault();
});

document.getElementById('viewContainer').addEventListener('touchstart', function (event) {
    mouseDown = true;
    lastMouseX = event.originalEvent.changedTouches[0].clientX;
    lastMouseY = event.originalEvent.changedTouches[0].clientY;

    event.preventDefault();
});

document.getElementById('viewContainer').addEventListener('touchmove', function (event) {
    var enableX = 1;
    if(mouseDown) {
        var thisMouseX = event.originalEvent.changedTouches[0].clientX;
        var thisMouseY = event.originalEvent.changedTouches[0].clientY;
        BaseRotationEuler.set(
        angleRangeRad(BaseRotationEuler.x + (thisMouseY - lastMouseY) * MOUSE_SPEED * enableX),
        angleRangeRad(BaseRotationEuler.y + (thisMouseX - lastMouseX) * MOUSE_SPEED),0.0);
        lastMouseX = thisMouseX;
        lastMouseY = thisMouseY;
        BaseRotation.setFromEuler(BaseRotationEuler);
    }
});

function render() {
    if (USE_WEBVR) {
        cameraLeft.matrix.copy(camera.matrix).multiply(eyeOffsetLeft);
        cameraLeft.matrixWorldNeedsUpdate = true;

        currentRenderer.enableScissorTest ( true );
        currentRenderer.setScissor( 0, 0, window.innerWidth / 2, window.innerHeight );
        currentRenderer.setViewport( 0, 0, window.innerWidth / 2, window.innerHeight );
        currentRenderer.render(scene, cameraLeft);

        // Render right eye
        cameraRight.matrix.copy(camera.matrix).multiply(eyeOffsetRight);
        cameraRight.matrixWorldNeedsUpdate = true;

        currentRenderer.setScissor( window.innerWidth / 2, 0, window.innerWidth / 2, window.innerHeight );
        currentRenderer.setViewport( window.innerWidth / 2, 0, window.innerWidth / 2, window.innerHeight );
        currentRenderer.render(scene, cameraRight);
  }
  else {
    currentRenderer.render(scene, camera);
  }
}

function resize( event ) {
  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;

  currentRenderer.setSize( WIDTH, HEIGHT );
  camera.projectionMatrix.makePerspective( 60, WIDTH / HEIGHT, NEAR, FAR );
}

function loop() {
  requestAnimationFrame( loop );
  // Apply movement
    BaseRotationEuler.set( angleRangeRad(BaseRotationEuler.x + moveVector.x), angleRangeRad(BaseRotationEuler.y + moveVector.y), 0.0 );
    BaseRotation.setFromEuler(BaseRotationEuler);

    // Update camera rotation
    camera.quaternion.multiplyQuaternions(BaseRotation, HMDRotation);
    camera.position.copy(HMDTranslation.clone().applyQuaternion(BaseRotation));
  render();
}

function checkWebVR() {
  if(manager.isWebVRCompatible()) {
    $('#toggle-render').show();
  }else {
    $('#toggle-render').hide();
  }
}

$(window).keypress(function(e) {
  if (e.keyCode == 0 || e.keyCode == 32) {
    console.log('Space pressed');
    if($('#toggle-render').is(":visible")){
        $('#toggle-render').hide();
    }else{
        $('#toggle-render').show();
    }
  }
});

initScene();
loop();