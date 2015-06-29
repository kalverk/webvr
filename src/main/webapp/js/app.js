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

//WEBVR
var cameraLeft = new THREE.PerspectiveCamera();
cameraLeft.matrixAutoUpdate = false;
var cameraRight = new THREE.PerspectiveCamera();
cameraRight.matrixAutoUpdate = false;
var eyeOffsetLeft = new THREE.Matrix4();
var eyeOffsetRight = new THREE.Matrix4();

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

    $('#toggle-render').click(function() {
        if (!inOculusMode) {
            USE_TRACKER = true;
            inOculusMode = true;
            initWebSocket();
        }else{
            //TODO tagasi oculusest ei tule, vana renderdus j��b k�lge
            inOculusMode = false;
            USE_TRACKER = false;
            currentRenderer = regularRenderer;
            connection.close();
        }
    });

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

	try {
        regularRenderer = new THREE.WebGLRenderer({preserveDrawingBuffer: true});
    }catch(e){
      alert('This application needs WebGL enabled!');
      return false;
    }

    regularRenderer.autoClearColor = false;
	regularRenderer.setSize(WIDTH, HEIGHT);

	currentRenderer = regularRenderer;

	$container.append(regularRenderer.domElement);

	THREEx.WindowResize(regularRenderer, camera);

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

function initWebSocket() {
  connection = new WebSocket(WEBSOCKET_ADDR);
  connection.binaryType = 'arraybuffer'
  console.log('WebSocket conn:', connection);

  connection.onopen = function () {
    // connection is opened and ready to use
    console.log('websocket open');
  };

  connection.onerror = function (error) {
    // an error occurred when sending/receiving data
    console.log('websocket error :-(');
  };

  connection.onmessage = function (message) {
    data = new Float32Array(message.data);
    if (message.data.byteLength == 16) {
      HMDRotation.set(data[0],data[1],data[2],data[3]);
    }
    else if (message.data.byteLength == 12) {
      HMDTranslation.set(data[0], data[1], data[2]);
    };
  };

  connection.onclose = function () {
    console.log('websocket close' + USE_TRACKER);
    if (USE_TRACKER) setTimeout(initWebSocket, 1000);
  };

  connectionHMDData = new WebSocket(WEBSOCKET_ADDR + "?");

  connectionHMDData.onmessage = function(message) {
    var HMDData = JSON.parse(message.data);
    console.log(HMDData);
    connectionHMDData.close();

    currentRenderer = new THREE.OculusRiftEffect(regularRenderer, HMDData);
    currentRenderer.setSize(WIDTH, HEIGHT );
  }
}

function initControls() {
    var movingH = false;
    var movingV = false;

  $(document).keydown(function(e) {
    switch(e.keyCode) {
        //TODO arrow click means move forward or backward add time restriction
      case 37: //left arrow
        keyboardMoveVector.y = KEYBOARD_SPEED;
        if(movingH){
            keyboardMoveVector.y = 0;
            movingH = false;
            break;
        }
        movingH = true;
        break;
      case 38: //up arrow
        //TODO is needed?
        break;
      case 39: //right arrow
        keyboardMoveVector.y = -KEYBOARD_SPEED;
        if(movingH){
            keyboardMoveVector.y = 0;
            movingH = false;
            break;
        }
        movingH = true;
        break;
      case 40: //down arrow
        //TODO is needed?
        break;
      case 18: // Alt
        //TODO use depth
        USE_DEPTH = !USE_DEPTH;
        //setSphereGeometry();
        break;
      case 70: // F
        //TODO force browser full screen
        console.log("f key press ");
        break;
      case 82: // R
        //TODO reset position
        console.log("reset sensor ");

        break;
    }
  });

  // Mouse
  // ---------------------------------------
  var viewer = $('#viewContainer'),
      mouseButtonDown = false,
      lastClientX = 0,
      lastClientY = 0;

  viewer.dblclick(function() {
    //TODO move to the next place
    console.log("move to the next place");
  });

  viewer.mousedown(function(event) {
    mouseButtonDown = true;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
  });

  viewer.mouseup(function() {
    mouseButtonDown = false;
  });

  viewer.mousemove(function(event) {
    if (mouseButtonDown) {
      //var enableX = (USE_TRACKER || USE_WEBVR) ? 0 : 1;
      var enableX = 1;
      BaseRotationEuler.set(
        angleRangeRad(BaseRotationEuler.x + (event.clientY - lastClientY) * MOUSE_SPEED * enableX),
        angleRangeRad(BaseRotationEuler.y + (event.clientX - lastClientX) * MOUSE_SPEED),
        0.0
      );
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      BaseRotation.setFromEuler(BaseRotationEuler);
    }
  });

}

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

  // Compute move vector
  moveVector.addVectors(keyboardMoveVector, gamepadMoveVector);

  // Disable X movement HMD tracking is enabled
  if (USE_TRACKER) {
    moveVector.x = 0;
  }

  // Apply movement
  BaseRotationEuler.set( angleRangeRad(BaseRotationEuler.x + moveVector.x), angleRangeRad(BaseRotationEuler.y + moveVector.y), 0.0 );
  BaseRotation.setFromEuler(BaseRotationEuler);

  // Update camera rotation
  camera.quaternion.multiplyQuaternions(BaseRotation, HMDRotation);
  camera.position.copy(HMDTranslation.clone().applyQuaternion(BaseRotation));

  // Compute heading
  headingVector.setFromQuaternion(camera.quaternion);
  currHeading = angleRangeDeg(THREE.Math.radToDeg(-headingVector.y));

  // render
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
initControls();

loop();