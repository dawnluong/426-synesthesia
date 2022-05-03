import * as Dat from 'dat.gui';
import { Scene, Color } from 'three';
import { Flower, Land } from 'objects';
import { BasicLights } from 'lights';

class SeedScene extends Scene {
    constructor() {
        // Call parent Scene() constructor
        super();

        // Init state
        this.state = {
            gui: new Dat.GUI(), // Create GUI for scene
            turns: 2,
            fftsize: 32,
            radius: 5,
            mode: 'default',
            color:  0x0000ff,
            background: 0xffffff,
            // updateList: [],
        };
     
        this.state.gui.add(this.state, 'turns', 0, 8);
        this.state.gui.add(this.state, 'radius', 0, 10);
        this.state.gui.add(this.state, 'mode', [
            'default',
            'color-code',
            'single',
        ]);
        this.state.gui.add(this.state, 'fftsize', [
            32, 64, 128, 256, 512, 1024, 2048
        ])
        var params2 = {};
        params2.color =0x0000ff;
        this.state.gui.addColor(this.state, 'color');
        var params = {};
        params.background =0xffffff;
        this.state.gui.addColor(this.state, 'background');
    }
}

export default SeedScene;
