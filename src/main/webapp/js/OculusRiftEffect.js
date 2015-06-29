/**
 * @author troffmo5 / http://github.com/troffmo5
 *
 * Effect to render the scene in stereo 3d side by side with lens distortion.
 * It is written to be used with the Oculus Rift (http://www.oculusvr.com/) but
 * it works also with other HMD using the same technology
 */

THREE.OculusRiftEffect = function ( renderer, HMDData ) {

	this.getMeshGeometry = function(leftEye) {
		var geometry = new THREE.BufferGeometry();
		var vertices = leftEye ? HMDData.left.mesh.vertices : HMDData.right.mesh.vertices;
		var numVertices = vertices.length;
		var positionsSize = 3;
		var positions = new Float32Array(positionsSize * numVertices);
		var vignettes = new Float32Array(numVertices);
		var texCoord0s = new Float32Array(2 * numVertices);
		var texCoord1s = new Float32Array(2 * numVertices);
		var texCoord2s = new Float32Array(2 * numVertices);
		for (var i = 0; i < numVertices; i++) {
			var v = vertices[i]
			positions[i * positionsSize] = v[0]; positions[i * positionsSize + 1] = v[1]; positions[i * positionsSize + 2] = 0;
			vignettes[i] = v[8];
			texCoord0s[i * 2] = v[6]; texCoord0s[i * 2 + 1] = v[7];
			texCoord1s[i * 2] = v[4]; texCoord1s[i * 2 + 1] = v[5];
			texCoord2s[i * 2] = v[2]; texCoord2s[i * 2 + 1] = v[3];
		};
		var indexList = leftEye ? HMDData.left.mesh.indices : HMDData.right.mesh.indices;
		var numIndices = indexList.length;
		var indices = new Uint16Array(numIndices);
		for (var i = 0; i < numIndices; i++) {
			indices[i] = indexList[i];
		};

		geometry.addAttribute('index', new THREE.BufferAttribute(indices, 1));
		geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.addAttribute('vignette', new THREE.BufferAttribute(vignettes, 1));
		geometry.addAttribute('texCoord0', new THREE.BufferAttribute(texCoord0s, 2));
		geometry.addAttribute('texCoord1', new THREE.BufferAttribute(texCoord1s, 2));
		geometry.addAttribute('texCoord2', new THREE.BufferAttribute(texCoord2s, 2));
		geometry.computeBoundingSphere();
		return geometry;
	};

	// Perspective camera
	var pCamera = new THREE.PerspectiveCamera();
	pCamera.matrixAutoUpdate = false;
	pCamera.target = new THREE.Vector3();

	// Orthographic camera
	var oCamera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );

	// pre-render hooks
	this.preLeftRender = function() {};
	this.preRightRender = function() {};

	renderer.autoClear = false;
	var emptyColor = new THREE.Color("black");

	// Render target
	var RTParams = { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };
	var renderTarget = new THREE.WebGLRenderTarget( HMDData.rendereTargetSize[0], HMDData.rendereTargetSize[1], RTParams );
	var RTMaterial = {
		uniforms: {
			"texture": { type: "t"},
			"eyeToSourceUVScale": { type: "v2", value: new THREE.Vector2(0.5,0.5) },
			"eyeToSourceUVOffset": { type: "v2", value: new THREE.Vector2(0.5,0.5) },		
		},

		attributes: {
			position: {	type: 'v2', value: [0.0, 0.0] },
			vignette: {	type: 'f', value: 0.0 },
			texCoord0: { type: 'v2', value: [0.0, 0.0] },
			texCoord1: { type: 'v2', value: [0.0, 0.0] },
			texCoord2: { type: 'v2', value: [0.0, 0.0] }
		},

		vertexShader: [
			"uniform vec2 eyeToSourceUVScale;",
			"uniform vec2 eyeToSourceUVOffset;",	
			"attribute vec3 position;",
			"attribute float vignette;",
			"attribute vec2 texCoord0;",
			"attribute vec2 texCoord1;",
			"attribute vec2 texCoord2;",	
			"varying float oVignette;",
			"varying vec2 oTexCoord0;",
			"varying vec2 oTexCoord1;",
			"varying vec2 oTexCoord2;",
			"void main() {",
			" gl_Position.x = position.x;",
			" gl_Position.y = position.y;",
			" gl_Position.z = 0.5;",
			" gl_Position.w = 1.0;",
			" oTexCoord0 = texCoord0 * eyeToSourceUVScale + eyeToSourceUVOffset;",
			" oTexCoord0.y = 1.0 - oTexCoord0.y;",
			" oTexCoord1 = texCoord1 * eyeToSourceUVScale + eyeToSourceUVOffset;",
			" oTexCoord1.y = 1.0 - oTexCoord1.y;",
			" oTexCoord2 = texCoord2 * eyeToSourceUVScale + eyeToSourceUVOffset;",
			" oTexCoord2.y = 1.0 - oTexCoord2.y;",		
			" oVignette = vignette;",
			"}"
		].join("\n"),

		fragmentShader: [
			"uniform sampler2D texture;",
			"precision mediump float;",
			"varying float oVignette;",
			"varying vec2 oTexCoord0;",
			"varying vec2 oTexCoord1;",
			"varying vec2 oTexCoord2;",
			"void main()",
			"{",
			"  gl_FragColor.r = oVignette * texture2D(texture, oTexCoord0).r;",
			"  gl_FragColor.g = oVignette * texture2D(texture, oTexCoord1).g;",
			"  gl_FragColor.b = oVignette * texture2D(texture, oTexCoord2).b;",
			"  gl_FragColor.a = 1.0;",
			"}"
		].join("\n"),

		side: THREE.DoubleSide
	}

	// Material
	var meshMaterial = new THREE.RawShaderMaterial(RTMaterial);
	meshMaterial.uniforms["texture" ].value = renderTarget;

	var leftMesh = new THREE.Mesh( this.getMeshGeometry(true), meshMaterial);
	var leftUVScale = new THREE.Vector2(HMDData.left.uvScaleOffset[0], HMDData.left.uvScaleOffset[1]);
	var leftUVOffset = new THREE.Vector2(HMDData.left.uvScaleOffset[2], HMDData.left.uvScaleOffset[3]);

	var rightMesh = new THREE.Mesh( this.getMeshGeometry(false), meshMaterial);
	var rightUVScale = new THREE.Vector2(HMDData.right.uvScaleOffset[0], HMDData.right.uvScaleOffset[1]);
	var rightUVOffset = new THREE.Vector2(HMDData.right.uvScaleOffset[2], HMDData.right.uvScaleOffset[3]);

	// Final scene
	var finalScene = new THREE.Scene();
	finalScene.add( oCamera );
	finalScene.add( leftMesh );
	finalScene.add( rightMesh );

    var left = {}, right = {};
	var near = 0.1;
	var far = 10000;
	var ymin = -HMDData.left.fov[0] * near;
	var ymax = HMDData.left.fov[1] * near;	
	var xmin = -HMDData.left.fov[2] * near;
	var xmax = HMDData.left.fov[3] * near;
	left.proj = (new THREE.Matrix4()).makeFrustum(xmin, xmax, ymin, ymax, near, far);
	left.tranform = (new THREE.Matrix4()).makeTranslation(HMDData.left.viewAdjust[0], HMDData.left.viewAdjust[1], HMDData.left.viewAdjust[2]);

	ymin = -HMDData.right.fov[0] * near;
	ymax = HMDData.right.fov[1] * near;
	xmin = -HMDData.right.fov[2] * near;
	xmax = HMDData.right.fov[3] * near;
	right.proj = (new THREE.Matrix4()).makeFrustum(xmin, xmax, ymin, ymax, near, far);
	right.tranform = (new THREE.Matrix4()).makeTranslation(HMDData.right.viewAdjust[0], HMDData.right.viewAdjust[1], HMDData.right.viewAdjust[2]);

	this.setSize = function ( width, height ) {
		renderer.setSize( width, height );
	};

	this.render = function ( scene, camera ) {
		var cc = renderer.getClearColor().clone();

		// Clear
		renderer.setClearColor(emptyColor);
		renderer.clear();
		renderer.setClearColor(cc);

		// camera parameters
		if (camera.matrixAutoUpdate) camera.updateMatrix();

		// Render left
		this.preLeftRender();

		pCamera.projectionMatrix.copy(left.proj);

		pCamera.matrix.copy(camera.matrix).multiply(left.tranform);
		pCamera.matrixWorldNeedsUpdate = true;

		renderer.setViewport(HMDData.left.viewport[0], HMDData.left.viewport[1], HMDData.left.viewport[2], HMDData.left.viewport[3]);

		meshMaterial.uniforms['eyeToSourceUVScale'].value = leftUVScale;
		meshMaterial.uniforms['eyeToSourceUVOffset'].value = leftUVOffset;
		renderer.render( scene, pCamera, renderTarget, true );

		// Render right
		this.preRightRender();

		pCamera.projectionMatrix.copy(right.proj);

		pCamera.matrix.copy(camera.matrix).multiply(right.tranform);
		pCamera.matrixWorldNeedsUpdate = true;

		renderer.setViewport(HMDData.right.viewport[0], HMDData.right.viewport[1], HMDData.right.viewport[2], HMDData.right.viewport[3]);

		meshMaterial.uniforms['eyeToSourceUVScale'].value = rightUVScale;
		meshMaterial.uniforms['eyeToSourceUVOffset'].value = rightUVOffset;
		renderer.render( scene, pCamera, renderTarget, true );

		renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
		renderer.render( finalScene, oCamera );

	};

};
