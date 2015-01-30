define(function (require) {

    var GLOBE_RADIUS = 100;
    var BALL_RADIUS = 7;
    var qtek = require('qtek');

    var ballGeo = new qtek.geometry.Sphere({
        widthSegments: 30,
        heightSegments: 30
    });
    ballGeo.generateTangents();

    var cubeGeo = new qtek.geometry.Cube();

    var labelGeo = new qtek.geometry.Sphere({
        widthSegments: 10,
        heightSegments: 10,
        thetaStart: Math.PI / 3,
        thetaLength: Math.PI / 3,

        phiStart: Math.PI / 3,
        phiLength: Math.PI / 3 
    });

    // Using cube list to simulate sphere inside space
    function createSphericCubes() {
        var segTheta = 10;
        var cubeList = [];
        var R = GLOBE_RADIUS;
        var material = new qtek.Material({
            shader: qtek.shader.library.get('buildin.physical'),
            transparent: true,
            depthMask: false
        });
        material.set('glossiness', 0.6);
        material.set('specularColor', [0.2, 0.2, 0.2]);
        material.set('color', [1, 1, 1]);
        material.set('alpha', 0.4);
        for (var k = 0; k <= segTheta; k++) {
            var theta = (k - segTheta / 2) * Math.PI / segTheta;

            var r0 = Math.cos(theta) * R;
            var perimeter = r0 * Math.PI * 2;

            var steps = perimeter / (R * 2 * Math.PI / 16);
            for (var i = 0; i <= steps; i ++) {

                if (steps == 0) {
                    var phi = 0;
                } else {
                    var phi = i / steps * Math.PI * 2;
                }

                var scale = 10;
                var x = Math.cos(phi) * Math.cos(theta) * (R + scale / 2);
                var y = Math.sin(theta) * (R + scale / 2);
                var z = Math.sin(phi) * Math.cos(theta) * (R + scale / 2);

                var cube = new qtek.Mesh({
                    geometry: cubeGeo,
                    material: material,
                    culling: false,
                    visible: false
                });

                cube.position.set(x, y, z);

                cube.rotation.rotateY(-phi);
                cube.rotation.rotateZ(theta);
                cube.scale.set(scale, scale * 2, scale * 2);

                cubeList.push(cube);
            }
        }
        // 挡板
        var cube = new qtek.Mesh({
            name: 'bar',
            geometry: cubeGeo,
            material: material,
            culling: false
        });
        cube.position.set(0, -R / 2, 0);
        cube.scale.set(R, R / 2, 3);
        cubeList.push(cube);

        return cubeList;
    }

    function createApron() {

    }

    // Create cube physics rigid bodies
    function createCubeRigidBodies(cubeList, world, material) {
        cubeList.forEach(function (cube) {
            var shape = new CANNON.Box(new CANNON.Vec3(
                cube.scale.x, cube.scale.y, cube.scale.z
            ));

            var body = new CANNON.Body({
                mass: 0,
                material: material
            });
            body.addShape(shape);
            body.position.set(
                cube.position.x, cube.position.y, cube.position.z
            );
            body.quaternion.set(
                cube.rotation.x, cube.rotation.y, cube.rotation.z, cube.rotation.w
            );

            world.addBody(body);

            cube.body = body;
        });
    }

    function createBall(candidates, physicsMaterial) {
        var name = candidates.name;

        var scale = BALL_RADIUS;
        var normalTexture = new qtek.Texture2D();
        normalTexture.load('asset/normal.jpg');

        var material = new qtek.Material({
            shader: qtek.shader.library.get('buildin.physical', ['normalMap'])
        });
        material.set('normalMap', normalTexture);
        material.set('uvRepeat', [0.7, 0.7]);
        material.set('color', candidates.color);
        var ballMesh = new qtek.Mesh({
            name: name,
            material: material,
            geometry: ballGeo
        });
        ballMesh.scale.set(scale, scale, scale);
        ballMesh.position.set(
            (Math.random() * 2 - 1) * GLOBE_RADIUS / 2,
            Math.random() * GLOBE_RADIUS / 2,
            (Math.random() * 2 - 1) * GLOBE_RADIUS / 2
        );

        var sphereShape = new CANNON.Sphere(scale);
        var body = new CANNON.Body({
            material: physicsMaterial,
            mass: 1
        });
        body.addShape(sphereShape);
        body.position.set(
            ballMesh.position.x, ballMesh.position.y, ballMesh.position.z
        );

        ballMesh.body = body;

        // LABEL
        var labelMesh = new qtek.Mesh({
            material: new qtek.Material({
                shader: qtek.shader.library.get(
                    'buildin.basic', {
                        textures: ['diffuseMap'],
                        fragmentDefines: {
                            DIFFUSEMAP_ALPHA_ALPHA: null
                        }
                    }
                ),
                transparent: true
            }),
            geometry: labelGeo,
            castShadow: false,
            receiveShadow: false
        });
        labelMesh.material.set('diffuseMap', new qtek.Texture2D({
            image: drawLabel(name),
            flipY: false
        }));

        labelMesh.scale.set(
            1.05, 1.05, 1.05
        );
        ballMesh.add(labelMesh);

        return ballMesh;
    }

    function drawLabel(name) {
        var canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        var ctx = canvas.getContext('2d');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px 微软雅黑';

        ctx.fillStyle = 'black';
        ctx.strokeStyle = 'white';
        ctx.fillText(name, 32, 32);
        ctx.strokeText(name, 32, 32);

        return canvas;
    }

    // Sync cube rigid bodies matrix
    function syncCubeRigidBodies(cubeList) {
        var position = new qtek.math.Vector3();
        var quat = new qtek.math.Quaternion();
        for (var i = 0; i < cubeList.length; i++) {
            var cube = cubeList[i];
            var body = cube.body;
            cube.worldTransform.decomposeMatrix(null, quat, position);
            body.position.set(position.x, position.y, position.z);
            body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
        }
    }

    function syncBalls(ballList) {
        for (var i = 0; i < ballList.length; i++) {
            var ball = ballList[i];
            var body = ball.body;
            ball.position.set(
                body.position.x, body.position.y, body.position.z
            );
            ball.rotation.set(
                body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w
            );
        }
    }

    function createWorld() {
        var world = new CANNON.World();
        world.quatNormalizeSkip = 0;
        world.quatNormalizeFast = false;
        var solver = new CANNON.GSSolver();

        world.defaultContactMaterial.contactEquationStiffness = 1e9;
        world.defaultContactMaterial.contactEquationRegularizationTime = 4;

        solver.iterations = 7;
        solver.tolerance = 0.1;

        solver = new CANNON.SplitSolver(solver);
        world.solver = solver;

        world.gravity.set(0, -100, 0);
        world.broadphase = new CANNON.NaiveBroadphase();

        var groundShape = new CANNON.Plane();
        var body = new CANNON.Body({
            mass: 0,
            material: new CANNON.Material('plane')
        });
        body.addShape(groundShape);
        // Rotate plane
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0),Math.PI/2);
        body.position.y = -100;
        world.addBody(body);

        return world;
    }

    function createGlobe(renderer) {
        var material = new qtek.Material({
            shader: qtek.shader.library.get(
                'buildin.physical'
            ),
            transparent: true,
            depthMask: false
        });

        var sphereGeo = new qtek.geometry.Sphere({
            widthSegments: 50,
            heightSegments: 50
        });

        material.set('alpha', 0.4);
        material.set('glossiness', 0.3);
        material.set('color', [0, 0.5, 0.3]);

        var mesh = new qtek.Mesh({
            material: material,
            geometry: sphereGeo,
            castShadow: false,
            receiveShadow: false
        });

        mesh.scale.set(GLOBE_RADIUS, GLOBE_RADIUS, GLOBE_RADIUS);

        return mesh;
    }

    function loadBase(scene) {
        var loader = new qtek.loader.GLTF();
        loader.load('asset/base.json');

        loader.success(function (res) {
            var mesh = res.scene.childAt(0);
            mesh.material.set('glossiness', 0.7);
            mesh.rotation.rotateX(-Math.PI / 2);
            mesh.position.y = -100;
            mesh.scale.set(100, 100, 15);
            scene.add(mesh);
        });
    }

    function createGround() {
        var plane = new qtek.Mesh({
            geometry: new qtek.geometry.Plane(),
            material: new qtek.Material({
                shader: qtek.shader.library.get(
                    'buildin.physical', ['diffuseMap']
                )
            })
        });
        plane.rotation.rotateX(-Math.PI / 2);
        plane.position.y = -115;
        plane.scale.set(400, 400, 1);
        plane.material.set('color', [1, 1, 1]);
        var diffuseTexture = new qtek.Texture2D({
            anisotropic: 32,
            wrapS: qtek.Texture.REPEAT,
            wrapT: qtek.Texture.REPEAT
        });
        diffuseTexture.load('asset/marble.jpg');
        plane.material.set('diffuseMap', diffuseTexture);
        plane.material.set('uvRepeat', [5, 5]);

        return plane;
    }

    function createWalls() {
        var diffuseTexture = new qtek.Texture2D({
            anisotropic: 32,
        });
        diffuseTexture.load('asset/wall.jpg');

        var largeCube = new qtek.geometry.Cube({
            inside: true
        });
        var mesh = new qtek.Mesh({
            material: new qtek.Material({
                shader: qtek.shader.library.get('buildin.lambert', ['diffuseMap'])
            }),
            geometry: largeCube,
            frontFace: qtek.Mesh.CW,
            castShadow: false
        });
        mesh.material.set('diffuseMap', diffuseTexture);

        mesh.scale.set(400, 300, 400);
        mesh.position.y = 160;

        return mesh;
    }

    function createCeil() {
        var diffuseTexture = new qtek.Texture2D();
        diffuseTexture.load('asset/ceil.jpg');

        var largeCube = new qtek.geometry.Plane();
        var mesh = new qtek.Mesh({
            material: new qtek.Material({
                shader: qtek.shader.library.get('buildin.basic', ['diffuseMap'])
            }),
            geometry: largeCube,
            castShadow: false
        });
        mesh.material.set('diffuseMap', diffuseTexture);

        mesh.rotation.rotateX(Math.PI / 2);
        mesh.scale.set(400, 400, 1);
        mesh.position.y = 450;

        return mesh;
    }

    function init(dom, candidates) {
        if (typeof(dom) === 'string') {
            dom = document.getElementById('main');
        }

        candidates = candidates.slice();
        var importanceSamplingArray = [];

        var world = createWorld();
        var ballMaterial = new CANNON.Material('ball');
        var cubeMaterial = new CANNON.Material('cube');
        var ballball = new CANNON.ContactMaterial(ballMaterial, ballMaterial, {
            friction: 0.1,
            restitution: 0.1
        });
        var ballCube = new CANNON.ContactMaterial(ballMaterial, cubeMaterial, {
            friction: 0.3,
            restitution: 0.1
        })
        world.addContactMaterial(ballball);
        world.addContactMaterial(ballCube);

        var cubeRoot = new qtek.Node();
        var cubeList = createSphericCubes();
        createCubeRigidBodies(cubeList, world, ballMaterial);

        cubeList.forEach(function (cube) {
            cubeRoot.add(cube);
        });

        var ballRoot = new qtek.Node();

        // Prepare scene
        var scene = new qtek.Scene();
        var camera = new qtek.camera.Perspective();
        var renderer = new qtek.Renderer({
            devicePixelRatio: 1
        });
        var light = new qtek.light.Directional({
            shadowResolution: 512,
            shadowBias: 0.01
        });
        var control = new qtek.plugin.OrbitControl({
            target: camera,
            domElement: renderer.canvas,
            maxDistance: 450,
            minDistance: 200
        });
        light.position.set(100, 100, 50);
        light.lookAt(qtek.math.Vector3.ZERO);
        scene.add(light);
        scene.add(new qtek.light.Ambient({
            intensity: 0.3
        }));

        loadBase(scene);

        // Create rooom
        scene.add(createGround());
        scene.add(createWalls());
        scene.add(createCeil());


        camera.position.set(260, -50, 210)
        camera.lookAt(qtek.math.Vector3.ZERO);
        // Debug
        // scene.add(cubeRoot);
        scene.add(ballRoot);

        var globeMesh = createGlobe(renderer);
        scene.add(globeMesh);

        var shadowMapPass = new qtek.prePass.ShadowMap({
            shadowCascade: 1,
            softShadow: qtek.prePass.ShadowMap.VSM
        });
        var animation = new qtek.animation.Animation();
        animation.start();
        var elapsedTime = 0;
        var ballCount = 0;

        var ballList = [];
        var rollingSpeed = 0;
        animation.on('frame', function (frameTime) {
            if (ballCount < candidates.length) {
                ball = createBall(candidates[ballCount], ballMaterial);
                ballCount ++;
                world.add(ball.body);
                ballRoot.add(ball);
                ballList.push(ball);
            }

            if (rollingSpeed > 0) {
                cubeRoot.rotation.rotateX(rollingSpeed);
                globeMesh.rotation.rotateX(rollingSpeed);

                rollingSpeed -= 1e-2;
            }

            elapsedTime += frameTime;
            control.update(frameTime);

            cubeRoot.update(true);
            syncCubeRigidBodies(cubeList);
            syncBalls(ballList);

            world.step(Math.min(frameTime / 1000, 0.03));
            
            shadowMapPass.render(renderer, scene, camera);
            renderer.render(scene, camera);

            // shadowMapPass.renderDebug(renderer);
        });

        dom.appendChild(renderer.canvas);

        function resize() {
            renderer.resize(dom.clientWidth, dom.clientHeight);
            camera.aspect = renderer.width / renderer.height;
        }

        function rolling() {
            rollingSpeed = 0.1;
        }

        var cameraOldPosition = new qtek.math.Vector3();

        function lookAtAnimation(target, time, delay) {
            // Camera look at the ball
            var quat = camera.rotation.clone();
            camera.lookAt(target, qtek.math.Vector3.UP);
            var newQuat = camera.rotation.clone();
            camera.rotation.copy(quat);
            animation.animate({p: 0})
                .when(time, {
                    p: 1
                })
                .during(function (_target, percent) {
                    qtek.math.Quaternion.slerp(
                        camera.rotation, quat, newQuat, percent
                    );
                })
                .delay(delay)
                .start('CubicOut');

        }

        resize();

        var rolledCount = 0;

        return {
            resize: resize,

            dispose: function () {
                animation.off('frame');
                renderer.disposeScene(scene);
            },

            startRolling: function () {
                // Move camera back
                lookAtAnimation(cubeRoot.position, 1000, 0);

                // Update probability, sum to 1
                var all = 0;
                candidates.forEach(function (item) {
                    all += item.weight;
                });
                candidates.forEach(function (item) {
                    item.probability = item.weight / all;
                });
                
                // Create importance sampling array
                var off = 0;
                candidates.forEach(function (candidate, idx) {
                    var probability = candidate.probability * 1000;
                    for (var j = 0; j < Math.round(probability); j++) {
                        importanceSamplingArray[off++] = idx;
                    }
                });
                animation.on('frame', rolling);
            },

            stopRolling: function (cb) {
                animation.off('frame', rolling);

                // Chose one ball;
                var idx0 = Math.round(
                    Math.random() * (importanceSamplingArray.length - 1)
                );
                var idx = importanceSamplingArray[idx0];
                var ball = ballList[idx];

                ballList.splice(idx, 1);
                candidates.splice(idx, 1);
                world.remove(ball.body);

                // Rolling out ball
                ball.position.set(20, -105, 0);
                ball.rotation.identity();

                var ballTargetX = 350 - 25 * rolledCount;

                animation.animate(ball.position)
                    .when(2000, {
                        x: ballTargetX
                    })
                    .during(function () {
                        ball.rotation.identity().rotateZ(
                            -ball.position.x / BALL_RADIUS
                        )
                    })
                    .done(function () {
                        cb && cb(ball.name);
                    })
                    .delay(1000)
                    .start('CubicOut');

                lookAtAnimation(new qtek.math.Vector3(
                    ballTargetX, ball.position.y, ball.position.z
                ), 2000, 1000);

                rolledCount ++;

                return ball.name;
            }
        }
    }

    return {
        init: init
    }
});