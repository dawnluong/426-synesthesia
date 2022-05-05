## Using Synesthesia: Audio Visualizer

Demo: https://dawnluong.github.io/426-synesthesia/

## Enviroment
Ensure that the device you are using is either a laptop or desktop with a keyboard as a keyboard is needed for user input.
You should also be using Chrome as your browser. 

## Setting up
Initialize your settings in the top right corner.
turns: amount of turns the trail makes, 0 = straight path, 8 = tightly wound helix with small coils.
radius: maximum radius of trail, i.e., width.
mode: play around with the three different modes to see what they do!
fftsize: window size of fast Fourier transform (FFT). higher fft = more samples, more lines within the entire trail.
color: color of trail. *note that the color of the trail will not change in color-code mode.
background: background color of visualizer.

** Note that fftsize and mode need to be set prior to loading your audio. Only turns, radius, color, and background color will update after loading your audio **

## Loading Audio
After setting up your settings, choose your audio file by clicking on Choose File in the top left corner.
Once your audio has loaded, the visualizer will begin

## Controls
To control your visualizer, use WASD to change the direction of the trail.
W = up, A = left, S = down, D = right.
To pause your visualizer and audio, press SHIFT.
To resume your visualizer and audio, press SPACE.
** Additional ways to change your visualizer while the audio is playing include changing turns, radius, color, and background color will update after loading your audio **

## Finishing up
Once your audio ends, the visualizer will stop. You can now use WASD to move your camera around and explore the art piece you just created! Just use SHIFT and SPACE to stop and continue moving.
To create a new art piece or change audio/mode/fftsize, just refresh the page and repeat the steps. Don't forget to take any screenshots of your creation before you refresh!