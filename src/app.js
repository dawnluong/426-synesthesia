import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import SeedScene from './components/scenes/SeedScene';
let maxRadius = 5;
let turns = 0;
let song = 'resources/music/AcousticRock.mp3';
let backgroundColor = 0xffffff;
let color = 0x0000ff;
let mode = 'default';
class BasicCharacterControllerProxy {
    constructor(animations) {
        this._animations = animations;
    }

    get animations() {
        return this._animations;
    }
}
let going = true;
class Helix {
    constructor(params) {
        this._Init(params);
    }
    _Init(params) {
        this._params = params;
        this._prevPositions = [];
        this._material = new THREE.LineBasicMaterial({
            color: this._params.color,
        });
        this._geometry = new THREE.BufferGeometry().setFromPoints(
            this._prevPositions
        );
        this._line = new THREE.Line(this._geometry, this._material);
    }
    calcHelixPoint(P, R, time, rad, normal) {
        let newT = time;
        let theta = newT * turns;
        let newNormal = new THREE.Vector3();
        newNormal.copy(normal);
        let newR = new THREE.Vector3();
        newR.copy(R);
        newR.applyAxisAngle(newNormal, theta);
        let newP = new THREE.Vector3();
        newP.copy(P);
        return newP.add(newR.multiplyScalar(rad));
    }
    push(A) {
        this._prevPositions.push(A);
    }
    update(newcolor) {
        this._line.geometry = new THREE.BufferGeometry().setFromPoints(
            this._prevPositions
        );
        if (mode == 'color-code') {
            this._line.material = new THREE.LineBasicMaterial({
                color: newcolor,
            });
        } else {
            this._line.material = new THREE.LineBasicMaterial({ color: color });
        }
    }
}

class BasicCharacterController {
    constructor(params) {
        this._Init(params);
    }

    _Init(params) {
        this._params = params;
        this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
        this._acceleration = new THREE.Vector3(0.5, 0.125, 25.0);
        this._velocity = new THREE.Vector3(0, 0, 0);
        this._position = new THREE.Vector3();
        this._animations = {};
        this._input = new BasicCharacterControllerInput();
        this._musicData = [];
        this._prevPositions = [];
        this._material = new THREE.LineBasicMaterial({ color: color });
        this._geometry = new THREE.BufferGeometry().setFromPoints(
            this._prevPositions
        );

        this._helices = [];
        const line2params = {
            color: color,
        };
        if (mode == 'single') {
            let helix = new Helix(line2params);
            this._helices.push(helix);
            this._params.scene.add(this._helices[0]._line);
        }
        for (let i = 0; i < this._params.scene.state.fftsize / 2; i++) {
            let helix = new Helix(line2params);
            this._helices.push(helix);
            this._params.scene.add(this._helices[i]._line);
        }

        this._stateMachine = new CharacterFSM(
            new BasicCharacterControllerProxy(this._animations)
        );

        this._LoadModels();
    }

    _LoadModels() {
        const loader = new FBXLoader();
        loader.setPath('./resources/zombie/');
        // loader.load('mremireh_o_desbiens.fbx', (fbx) => {
        loader.load('mremireh_o_desbiens.fbx', (fbx) => {
            fbx.scale.setScalar(0.01);
            fbx.traverse((c) => {
                c.castShadow = true;
            });

            this._target = fbx;
            this._params.scene.add(this._target);

            this._mixer = new THREE.AnimationMixer(this._target);

            this._manager = new THREE.LoadingManager();
            this._manager.onLoad = () => {
                this._stateMachine.SetState('idle');
            };

            const _OnLoad = (animName, anim) => {
                const clip = anim.animations[0];
                const action = this._mixer.clipAction(clip);

                this._animations[animName] = {
                    clip: clip,
                    action: action,
                };
            };

            const loader = new FBXLoader(this._manager);
            loader.setPath('./resources/zombie/');
            loader.load('walk.fbx', (a) => {
                _OnLoad('walk', a);
            });
            loader.load('idle.fbx', (a) => {
                _OnLoad('idle', a);
            });
        });
    }

    get Position() {
        return this._position;
    }

    get Rotation() {
        if (!this._target) {
            return new THREE.Quaternion();
        }
        return this._target.quaternion;
    }

    Update(timeInSeconds) {
        // console.log(this._params._musicData)

        if (!this._stateMachine._currentState) {
            return;
        }

        this._stateMachine.Update(timeInSeconds, this._input);

        const velocity = this._velocity;
        const frameDecceleration = new THREE.Vector3(
            velocity.x * this._decceleration.x,
            velocity.y * this._decceleration.y,
            velocity.z * this._decceleration.z
        );
        frameDecceleration.multiplyScalar(timeInSeconds);
        frameDecceleration.z =
            Math.sign(frameDecceleration.z) *
            Math.min(Math.abs(frameDecceleration.z), Math.abs(velocity.z));

        velocity.add(frameDecceleration);

        const controlObject = this._target;
        const _Q = new THREE.Quaternion();
        const _A = new THREE.Vector3();
        const _R = controlObject.quaternion.clone();

        const acc = this._acceleration.clone();
        if (this._input._keys.shift) {
            velocity.z = 0;
        }

        if (this._input._keys.space) {
            velocity.z += acc.z * timeInSeconds * 0.5;
        }
        if (this._input._keys.up) {
            _A.set(1, 0, 0);
            _Q.setFromAxisAngle(
                _A,
                3.0 * -Math.PI * timeInSeconds * this._acceleration.y
            );
            _R.multiply(_Q);
        }
        if (this._input._keys.down) {
            _A.set(1, 0, 0);
            _Q.setFromAxisAngle(
                _A,
                3.0 * Math.PI * timeInSeconds * this._acceleration.y
            );
            _R.multiply(_Q);
        }
        if (this._input._keys.left) {
            _A.set(0, 1, 0);
            _Q.setFromAxisAngle(
                _A,
                3.0 * Math.PI * timeInSeconds * this._acceleration.y
            );
            _R.multiply(_Q);
        }
        if (this._input._keys.right) {
            _A.set(0, 1, 0);
            _Q.setFromAxisAngle(
                _A,
                3.0 * -Math.PI * timeInSeconds * this._acceleration.y
            );
            _R.multiply(_Q);
        }

        controlObject.quaternion.copy(_R);

        const oldPosition = new THREE.Vector3();
        oldPosition.copy(controlObject.position);

        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(controlObject.quaternion);
        forward.normalize();

        const sideways = new THREE.Vector3(1, 0, 0);
        sideways.applyQuaternion(controlObject.quaternion);
        sideways.normalize();

        sideways.multiplyScalar(velocity.x * timeInSeconds);
        forward.multiplyScalar(velocity.z * timeInSeconds);

        controlObject.position.add(forward);
        controlObject.position.add(sideways);

        this._position.copy(controlObject.position);

        if (this._input._keys.space && going) {
            let P = new THREE.Vector3();
            P.copy(this._position);
            let normal = new THREE.Vector3();
            this._params.camera.getWorldDirection(normal);
            normal.normalize();
            let V = new THREE.Vector3(1, (-normal.z - normal.x) / normal.y, 1);
            V.normalize();

            let R = new THREE.Vector3();
            R.copy(V);
            this._params.time += timeInSeconds;
            let len = this._musicData.length;
            for (let i = 0; i < len; i++) {
                let color = this.spectrum(i / (len));

                let rad = (this._musicData[i] * maxRadius) / 255;
                if (rad <= 0) {
                    rad = 0.01;
                }

                let A = this._helices[i].calcHelixPoint(
                    P,
                    R,
                    this._params.time,
                    rad,
                    normal
                );

                if (this._prevPositions.length == 0) {
                    this._helices[i].push(A);
                } else if (
                    !this._prevPositions[this._prevPositions.length - 1].equals(
                        this._position
                    )
                ) {
                    this._helices[i].push(A);
                }
                this._helices[i].update(color);
            }

            if (this._prevPositions.length == 0) {
                let pos = new THREE.Vector3();
                pos.copy(this._position);
                this._prevPositions.push(pos);
            } else if (
                !this._prevPositions[this._prevPositions.length - 1].equals(
                    this._position
                )
            ) {
                let pos = new THREE.Vector3();
                pos.copy(this._position);
                this._prevPositions.push(pos);
            }

            // this._line.geometry = new THREE.BufferGeometry().setFromPoints(
            //     this._prevPositions
            // );
        }

        if (this._mixer) {
            this._mixer.update(timeInSeconds);
        }
    }
    // https://stackoverflow.com/questions/10731147/evenly-distributed-color-range-depending-on-a-count
    spectrum(w) {
        if (w > 1) w = 1;
        if (w < 0) w = 0;

        w = w * (780 - 380) + 380;
        let R, B, G;
        if (w >= 380 && w < 440) {
            R = -(w - 440) / (440 - 350);
            G = 0.0;
            B = 1.0;
        } else if (w >= 440 && w < 490) {
            R = 0.0;
            G = (w - 440) / (490 - 440);
            B = 1.0;
        } else if (w >= 490 && w < 510) {
            R = 0.0;
            G = 1.0;
            B = (510 - w) / (510 - 490);
        } else if (w >= 510 && w < 580) {
            R = (w - 510) / (580 - 510);
            G = 1.0;
            B = 0.0;
        } else if (w >= 580 && w < 645) {
            R = 1.0;
            G = -(w - 645) / (645 - 580);
            B = 0.0;
        } else if (w >= 645 && w <= 780) {
            R = 1.0;
            G = 0.0;
            B = 0.0;
        } else {
            R = 0.0;
            G = 0.0;
            B = 0.0;
        }
        return new THREE.Color(R, G, B);
    }
}

class BasicCharacterControllerInput {
    constructor() {
        this._Init();
    }

    _Init() {
        this._keys = {
            up: false,
            backward: false,
            left: false,
            right: false,
            space: false,
            shift: false,
        };
        document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
        document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
    }

    _onKeyDown(event) {
        switch (event.keyCode) {
            case 87: // w
                this._keys.up = true;
                break;
            case 65: // a
                this._keys.left = true;
                break;
            case 83: // s
                this._keys.down = true;
                break;
            case 68: // d
                this._keys.right = true;
                break;
            case 32: // SPACE
                this._keys.space = true;
                break;
            case 16: // SHIFT
                this._keys.shift = true;
                break;
        }
    }

    _onKeyUp(event) {
        switch (event.keyCode) {
            case 87: // w
                this._keys.up = false;
                break;
            case 65: // a
                this._keys.left = false;
                break;
            case 83: // s
                this._keys.down = false;
                break;
            case 68: // d
                this._keys.right = false;
                break;
        }
    }
}

class FiniteStateMachine {
    constructor() {
        this._states = {};
        this._currentState = null;
    }

    _AddState(name, type) {
        this._states[name] = type;
    }

    SetState(name) {
        const prevState = this._currentState;

        if (prevState) {
            if (prevState.Name == name) {
                return;
            }
            prevState.Exit();
        }

        const state = new this._states[name](this);

        this._currentState = state;
        state.Enter(prevState);
    }

    Update(timeElapsed, input) {
        if (this._currentState) {
            this._currentState.Update(timeElapsed, input);
        }
    }
}

class CharacterFSM extends FiniteStateMachine {
    constructor(proxy) {
        super();
        this._proxy = proxy;
        this._Init();
    }

    _Init() {
        this._AddState('idle', IdleState);
        this._AddState('walk', WalkState);
    }
}

class State {
    constructor(parent) {
        this._parent = parent;
    }

    Enter() {}
    Exit() {}
    Update() {}
}

class WalkState extends State {
    constructor(parent) {
        super(parent);
    }

    get Name() {
        return 'walk';
    }

    Enter(prevState) {
        const curAction = this._parent._proxy._animations['walk'].action;
        if (prevState) {
            const prevAction =
                this._parent._proxy._animations[prevState.Name].action;

            curAction.enabled = true;

            {
                curAction.time = 0.0;
                curAction.setEffectiveTimeScale(1.0);
                curAction.setEffectiveWeight(1.0);
            }

            curAction.play();
        } else {
            curAction.play();
        }
    }

    Exit() {}

    Update(timeElapsed, input) {
        if (input._keys.shift) {
            input._keys.space = false;
            this._parent.SetState('idle');
            return;
        }
        this._parent.SetState('walk');
    }
}

class IdleState extends State {
    constructor(parent) {
        super(parent);
    }

    get Name() {
        return 'idle';
    }

    Enter(prevState) {
        const idleAction = this._parent._proxy._animations['idle'].action;
        if (prevState) {
            const prevAction =
                this._parent._proxy._animations[prevState.Name].action;
            idleAction.time = 0.0;
            idleAction.enabled = true;
            idleAction.play();
        } else {
            idleAction.play();
        }
    }

    Exit() {}

    Update(_, input) {
        if (input._keys.space) {
            input._keys.shift = false;
            this._parent.SetState('walk');
            return;
        }
        this._parent.SetState('idle');
    }
}

class ThirdPersonCamera {
    constructor(params) {
        this._params = params;
        this._camera = params.camera;

        this._currentPosition = new THREE.Vector3();
        this._currentLookat = new THREE.Vector3();
    }

    _CalculateIdealOffset() {
        const idealOffset = new THREE.Vector3(-10, 10, -10);
        idealOffset.applyQuaternion(this._params.target.Rotation);
        idealOffset.add(this._params.target.Position);
        return idealOffset;
    }

    _CalculateIdealLookat() {
        const idealLookat = new THREE.Vector3(0, 0, 0);
        idealLookat.applyQuaternion(this._params.target.Rotation);
        idealLookat.add(this._params.target.Position);
        return idealLookat;
    }

    Update(timeElapsed) {
        const idealOffset = this._CalculateIdealOffset();
        const idealLookat = this._CalculateIdealLookat();

        const t = 1.0 - Math.pow(0.001, timeElapsed);

        this._currentPosition.lerp(idealOffset, t);
        this._currentLookat.lerp(idealLookat, t);

        this._camera.position.copy(this._currentPosition);
        this._camera.lookAt(this._currentLookat);
    }
}

class ThirdPersonCameraDemo {
    constructor() {
        this._Initialize();
    }

    _Initialize() {
        this._threejs = new THREE.WebGLRenderer({
            antialias: true,
        });
        this._threejs.outputEncoding = THREE.sRGBEncoding;
        this._threejs.shadowMap.enabled = true;
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
        this._threejs.setPixelRatio(window.devicePixelRatio);
        this._threejs.setSize(window.innerWidth, window.innerHeight);

        document.body.appendChild(this._threejs.domElement);

        let box = document.createElement('DIV');
        box.id = 'LoadingPage';
        let html =
            '<style type="text/css">' +
            '{ font-family: Comfortaa, Helvetica, san-serif; }' +
            '.keys { display: inline:block; font-size: 20px;}' +
            'input { max-height: 30px;}' +
            'hr { color: white;}' +
            '.box {z-index: 10; position:absolute; top:0; width: 20%}' +
            '</style>' +
            '<br>' +
            '<input type="file" class="btn btn-light btn-lg begin-btn box" href="#" role="button" id="begin-btn"></a>' +
            '</div>';

        box.innerHTML = html;
        document.body.appendChild(box);
        window.addEventListener(
            'resize',
            () => {
                this._OnWindowResize();
            },
            false
        );

        const fov = 60;
        const aspect = 1920 / 1080;
        const near = 1.0;
        const far = 1000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(25, 10, 25);
        this._time = 0;

        this._scene = new SeedScene();
        let light = new THREE.DirectionalLight(0xffffff, 1.0);
        light.position.set(-100, 100, 100);
        light.target.position.set(0, 0, 0);
        light.castShadow = true;
        light.shadow.bias = -0.001;
        light.shadow.mapSize.width = 4096;
        light.shadow.mapSize.height = 4096;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 500.0;
        light.shadow.camera.near = 0.5;
        light.shadow.camera.far = 500.0;
        light.shadow.camera.left = 50;
        light.shadow.camera.right = -50;
        light.shadow.camera.top = 50;
        light.shadow.camera.bottom = -50;
        this._scene.add(light);

        light = new THREE.AmbientLight(0xffffff, 0.25);
        this._scene.add(light);
        this._mixers = [];
        this._previousRAF = null;

        let clickHandler = function (e) {
            this._LoadAnimatedModel();

            maxRadius = this._scene.state.radius;
            turns = this._scene.state.turns;
            color = this._scene.state.color;
            backgroundColor = this._scene.state.background;
            mode = this._scene.state.mode;

            var files = e.target.files;
            song = URL.createObjectURL(files[0]);
            let loadingPage = document.getElementById('LoadingPage');
            document.body.removeChild(loadingPage);
            this._LoadAudio();

            this._mediaElement.play();
            this._controls._input._keys.space = true;
            this._RAF();
        };
        document
            .getElementById('begin-btn')
            .addEventListener('change', clickHandler.bind(this), false);
        this._scene.background = new THREE.Color(0xffffff);

        this._threejs.render(this._scene, this._camera);
    }
    _LoadAudio() {
        this._listener = new THREE.AudioListener();
        this._camera.add(this._listener);

        this._audio = new THREE.Audio(this._listener);
        // this._audio.setLoop(false)
        // this._file = 'resources/music/AcousticRock.mp3';
        this._mediaElement = new Audio(song);
        this._audio.setMediaElementSource(this._mediaElement);
        this._audio.setLoop(false);
        this._analyser = new THREE.AudioAnalyser(
            this._audio,
            this._scene.state.fftsize
        );
    }
    UpdateAudio(timeInSeconds, input) {
        this._mediaElement.addEventListener('ended', (event) => {
            going = false;

            input._keys.space = false;
            input._keys.shift = true;
            this._mediaElement.pause();
        });
        if (input._keys.space && !this._audio.isPlaying) {
            this._mediaElement.play();
            if (mode == 'single') {
                this._musicData = [];
                this._musicData.push(this._analyser.getAverageFrequency());
            } else {
                this._musicData = this._analyser.getFrequencyData();
            }
            this._controls._musicData = this._musicData;
        } else if (input._keys.shift) {
            this._mediaElement.pause();
        }
    }

    _LoadAnimatedModel() {
        const params = {
            camera: this._camera,
            scene: this._scene,
            time: this._time,
        };

        this._controls = new BasicCharacterController(params);

        this._thirdPersonCamera = new ThirdPersonCamera({
            camera: this._camera,
            target: this._controls,
        });
    }

    _OnWindowResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    _RAF() {
        requestAnimationFrame((t) => {
            if (this._previousRAF === null) {
                this._previousRAF = t;
            }
            maxRadius = this._scene.state.radius;
            turns = this._scene.state.turns;
            color = this._scene.state.color;
            backgroundColor = this._scene.state.background;

            this._scene.background = new THREE.Color(backgroundColor);
            this._RAF();

            this._threejs.render(this._scene, this._camera);
            this._Step(t - this._previousRAF);
            this._previousRAF = t;
            // }
        });
    }

    _Step(timeElapsed) {
        const timeElapsedS = timeElapsed * 0.001;
        if (this._mixers) {
            this._mixers.map((m) => m.update(timeElapsedS));
        }

        if (this._controls) {
            this._controls.Update(timeElapsedS);
            if (going) {
                if (this._audio) {
                    this.UpdateAudio(timeElapsedS, this._controls._input);
                }
            }
        }
        this._thirdPersonCamera.Update(timeElapsedS);
    }
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new ThirdPersonCameraDemo();
});
