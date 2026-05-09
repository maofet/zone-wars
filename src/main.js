import { Game } from './game.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const ui = new UI(renderer);
const audio = new Audio();
audio.setMuted(ui.settings.muted);
const input = new Input();
input.attach();

const game = new Game(renderer, ui, audio, input);
game.start();
