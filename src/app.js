import * as THREE from 'three';
import SeedScene from './components/scenes/SeedScene';
import Shepherd from 'shepherd.js';

let maxRadius = 5;
let turns = 0;
let song = 'resources/music/AcousticRock.mp3';
let backgroundColor = 0xffffff;
let color = 0x0000ff;
let mode = 'default';
let going = true;
let volume = 0.25;

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
        this._quaternion = new THREE.Quaternion();
        // this._animations = {};
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

        this._stateMachine = new CharacterFSM();
        this._stateMachine.SetState('idle');
    }

    get Position() {
        return this._position;
    }

    get Rotation() {
        return this._quaternion;
    }

    Update(timeInSeconds) {
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

        const _Q = new THREE.Quaternion();
        const _A = new THREE.Vector3();
        const _R = this._quaternion.clone();

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
                2.75 * -Math.PI * timeInSeconds * this._acceleration.y
            );
            _R.multiply(_Q);
        }
        if (this._input._keys.down) {
            _A.set(1, 0, 0);
            _Q.setFromAxisAngle(
                _A,
                2.75 * Math.PI * timeInSeconds * this._acceleration.y
            );
            _R.multiply(_Q);
        }
        if (this._input._keys.left) {
            _A.set(0, 1, 0);
            _Q.setFromAxisAngle(
                _A,
                2.75 * Math.PI * timeInSeconds * this._acceleration.y
            );
            _R.multiply(_Q);
        }
        if (this._input._keys.right) {
            _A.set(0, 1, 0);
            _Q.setFromAxisAngle(
                _A,
                2.75 * -Math.PI * timeInSeconds * this._acceleration.y
            );
            _R.multiply(_Q);
        }

        this._quaternion.copy(_R);

        const oldPosition = new THREE.Vector3();
        oldPosition.copy(this._position);

        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this._quaternion);
        forward.normalize();

        const sideways = new THREE.Vector3(1, 0, 0);
        sideways.applyQuaternion(this._quaternion);
        sideways.normalize();

        sideways.multiplyScalar(velocity.x * timeInSeconds);
        forward.multiplyScalar(velocity.z * timeInSeconds);

        this._position.add(forward);
        this._position.add(sideways);

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
                let color = this.spectrum(i / len);

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
        }

        const state = new this._states[name](this);

        this._currentState = state;
    }

    Update(timeElapsed, input) {
        if (this._currentState) {
            this._currentState.Update(timeElapsed, input);
        }
    }
}

class CharacterFSM extends FiniteStateMachine {
    constructor() {
        super();
        // this._proxy = proxy;
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
    Update() {}
}

class WalkState extends State {
    constructor(parent) {
        super(parent);
    }

    get Name() {
        return 'walk';
    }

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

        var link = document.createElement('link');

        link.rel = 'stylesheet';

        link.type = 'text/css';

        link.href =
            'https://cdnjs.cloudflare.com/ajax/libs/shepherd.js/8.0.0/css/shepherd.css';

        // Get HTML head element to append
        // link element to it
        document.getElementsByTagName('HEAD')[0].appendChild(link);
        const style = document.createElement('style');

        style.innerHTML = `
        * {
            font-family: "Monaco", monospace;
        }
        body {    
            display: block; /* fix necessary to remove space at bottom of canvas */
            margin: 0 !important;
            padding: 0 !important;
            height: 100%
            width: 100%;
            height: 100%;
            min-height: 100%;
            position:relative;
        }
        .shepherd-element {
           background: #fff;
           border-radius: 0px;
           max-width: 450px;
           opacity: 0;
           transition: opacity .3s,visibility .3s;
           visibility: hidden;
           width: 100%;
       }
       .shepherd-title {
           font-size: 24px;
       }
       .box {
            position:fixed;
            top:0;
            left:0;
            width: 100%;
            height: 100%;
            margin: 0px;
            padding: 0px;
        }
        #begin-btn{
            font-size: 16px;
            width: 15%;
            background: rgba(0,0,0,0.75);
            color: #fff;
            border-radius: 3px;
            margin: 10px;

        }
       `;
        document.head.appendChild(style);
        let box = document.createElement('DIV');
        box.id = 'LoadingPage';
        let html =
            '<div class = "box">' +
            '<input type="file" class="btn btn-light btn-lg begin-btn" href="#" role="button" id="begin-btn"></a>' +
            '</div>' +
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
        const aspect = window.innerWidth / window.innerHeight;
        const near = 1.0;
        const far = 1000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(25, 10, 25);
        this._time = 0;

        this._scene = new SeedScene();
        var tour = loadTour(this._scene);
        tour.start();
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
            volume = this._scene.state.volume;

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
        // this._file = 'resources/music/AcousticRock.mp3';
        this._mediaElement = new Audio(song);
        this._audio.setMediaElementSource(this._mediaElement);
        this._audio.setLoop(false);
        this._analyser = new THREE.AudioAnalyser(
            this._audio,
            this._scene.state.fftsize
        );
        this._audio.setVolume(volume);
    }
    UpdateAudio(timeInSeconds, input) {
        this._audio.setVolume(volume);
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
            volume = this._scene.state.volume;

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

// https://github.com/DeegZC/VSKeys.git
function loadTour(camera) {
    labelGuiElements(camera);
    const tour = new Shepherd.Tour({
        defaultStepOptions: {
            cancelIcon: { enabled: true },
            classes: 'shadow-md bg-purple-dark',
            scrollTo: { behavior: 'smooth', block: 'center' },
        },
    });
    let buttons = [
        {
            action() {
                return tour.back();
            },
            classes: 'shepherd-button-secondary',
            text: 'Back',
        },
        {
            action() {
                return tour.next();
            },
            text: 'Next',
        },
    ];

    tour.addStep({
        title: 'How to use Synesthesia (:',
        text: 'Synesthesia is an interactive audio visualizer. Using your keyboard as a way to control the visualizer, you can create an art piece for a selected song.<br><br>\
          <strong style="text-decoration:underline">Before you begin</strong>: Ensure that the device you are using is either a laptop or desktop with a keyboard as a keyboard is needed for user input. You should also be using Chrome as your browser.<br><br>(try refreshing if this modal is covered)',
        attachTo: { element: '.box', on: 'top' },
        buttons: [
            {
                action() {
                    return this.next();
                },
                text: 'Next',
            },
        ],
        arrow: false,
    });
    tour.addStep({
        title: 'Spiral Turns',
        text: 'turns represents the amount of turns the trail makes in a given section of the trail.<br><br>0 = straight path, 8 = tightly wound spiral/more coils',
        attachTo: { element: '#turns', on: 'left' },
        buttons: buttons,
    });
    tour.addStep({
        title: 'Max Radius',
        text: 'radius is the width of trail.',
        attachTo: { element: '#radius', on: 'left' },
        buttons: buttons,
    });
    tour.addStep({
        title: 'Mode',
        text: "There are 3 different visualization modes: default, color-code, and single.<br><br>Default mode considers the different frequencies of the audio at each sample, visualizing each frequency in the domain as a line in the trail.<br><br>Color-code mode is the same as default mode, however, each frequency bin that is represented by a line corresponds to a specific color. The higher frequencies correspond to colors of visible light with higher frequencies, i.e., violet = high frequency, red = low frequency.<br><br>Single mode visualizes the audio using the average frequency of the audio at each point.",
        attachTo: { element: '#mode', on: 'left' },
        buttons: buttons,
    });
    tour.addStep({
        title: 'FFT window size',
        text: "fftsize determines the window size for how much of the audio's frequency data is sampled. A higher fftsize = more samples, which means more lines correlating to different frequencies within the entire trail.<br><br>**Note that this setting will need to be set prior to loading your audio.",
        attachTo: { element: '#fftsize', on: 'left' },
        buttons: buttons,
    });
    tour.addStep({
        title: 'Trail Color',
        text: 'Customize the color of the trail.<br><br>*Note that the color of the trail will not change in color-code mode.',
        attachTo: { element: '#color', on: 'left' },
        buttons: buttons,
    });

    tour.addStep({
        title: 'Background Color',
        text: 'Customize the backdrop of your visualizer.',
        attachTo: { element: '#backgroundcolor', on: 'left' },
        buttons: buttons,
    });

    tour.addStep({
        title: 'Audio Volume',
        text: 'Adjust the volume to whatever is comfortable for you',
        attachTo: { element: '#volume', on: 'left' },
        buttons: buttons,
    });

    tour.addStep({
        title: 'Upload Your Audio',
        text: 'After setting up your settings, choose your audio file by clicking on Choose File in the top left corner. Once your audio has loaded, the visualizer will begin.',
        attachTo: { element: '.begin-btn', on: 'right' },
        buttons: buttons,
        arrow: true,
    });
    tour.addStep({
        title: 'Controls',
        text: 'To control your visualizer, use WASD to change the direction of the trail.<br>W = up, A = left, S = down, D = right.<br>To pause your visualizer and audio, press SHIFT.<br>To resume your visualizer and audio, press SPACE.',
        attachTo: { element: '.begin-btn', on: 'right' },
        buttons: buttons,
        arrow: true,
    });
    tour.addStep({
        title: 'Finishing Up',
        text: "Once your audio ends, the visualizer will stop. You can now use WASD to move your camera around and explore the art piece you just created! Just use SHIFT and SPACE to stop and continue moving.<br><br>To create a new art piece or change audio/mode/fftsize, just refresh the page and repeat the steps. Don't forget to take any screenshots of your creation before you refresh!",
        attachTo: { element: '.begin-btn', on: 'right' },
        buttons: [
            {
                action() {
                    return this.back();
                },
                classes: 'shepherd-button-secondary',
                text: 'Back',
            },
            {
                action() {
                    return this.complete();
                },
                text: 'Upload Audio and Start!',
            },
        ],
        arrow: true,
    });

    return tour;
}
function labelGuiElements(camera) {
    let gui = Array.from(
        camera.state.gui.domElement.getElementsByTagName('li')
    );
    //console.log(gui.length);
    gui = gui.filter((val) => {
        return val.className != 'folder';
    });
    //console.log(gui.length);
    let idList = [
        'turns',
        'radius',
        'mode',
        'fftsize',
        'color',
        'backgroundcolor',
        'volume',
    ];
    for (let i = 0; i < gui.length; i++) {
        gui[i].id = idList[i];
    }
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new ThirdPersonCameraDemo();
});
