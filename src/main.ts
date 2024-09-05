// chip8 implementation
const stopButton = document.getElementById("btn");

import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./constants";
import { fontArray } from "./font";
import { variableRegister } from "./register";

class Chip8 {
  private memory = new Uint8Array(4096);
  private display = new Array(SCREEN_HEIGHT)
    .fill(0)
    .map(() => new Array(SCREEN_WIDTH).fill(0));
  private pc = 0x200;
  private indexRegister = 0x0; // I used to point to memory location
  private stack = new Array<number>();
  private delayTimer = 0;
  private soundTimer = 0;
  private register = variableRegister;
  private font = fontArray;
  private canvas;
  private ctx;
  private execInterval: number | undefined;
  private timerInterval: number | undefined;

  constructor() {
    this.canvas = document.getElementById("display") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.ctx.canvas.width = SCREEN_WIDTH * 10;
    this.ctx.canvas.height = SCREEN_HEIGHT * 10;
    this.loadFont();
  }

  private loadRom(file: ArrayBuffer) {
    const view = new DataView(file);
    for (let i = 0; i < view.byteLength; i++) {
      this.memory[0x200 + i] = view.getUint8(i);
    }
  }

  private loadFont() {
    // Load font into memory starting from 0x50 (80) to 0x9F (159)
    for (let i = 0; i < this.font.length; i++) {
      this.memory[0x50 + i] = this.font[i];
    }
  }

  private draw(x: number, y: number, value: number) {
    const color = value ? "white" : "black";
    const scale = 10;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * scale + 5, y * scale + 5, scale, scale);
  }

  public render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < SCREEN_HEIGHT; y++) {
      for (let x = 0; x < SCREEN_WIDTH; x++) {
        this.draw(x, y, this.display[y][x]);
      }
    }
  }

  private drawKeypad() {
    const keys = [
      "1",
      "2",
      "3",
      "4",
      "Q",
      "W",
      "E",
      "R",
      "A",
      "S",
      "D",
      "F",
      "Z",
      "X",
      "C",
      "V",
    ];

    const keypad = document.getElementById("keypad")!;
    keys.forEach((key) => {
      const button = document.createElement("button");
      button.textContent = key;
      button.addEventListener("click", () => {
        console.log(key);
      });
      keypad.appendChild(button);
    });
  }

  private startTimers() {
    this.timerInterval = setInterval(() => {
      if (this.delayTimer > 0) {
        this.delayTimer--;
      }

      if (this.soundTimer > 0) {
        this.playSound();
        this.soundTimer--;
      }
    }, 1000 / 60); // 60Hz
  }

  private playSound() {
    // TODO play sound
    console.log("BEEP");
  }

  public run() {
    this.startTimers();
    this.execInterval = setInterval(() => {
      const opcode = this.fetchOpcode();
      this.decode(opcode);
      this.render();
    }, 1000 / 700);
  }

  public stop() {
    console.log("stopped");
    clearInterval(this.execInterval);
    clearInterval(this.timerInterval);
  }

  private fetchOpcode() {
    const opCode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1]; // combine two bytes
    this.pc += 2;
    return opCode;
  }

  private decode(opcode: number) {
    /*
		Masking: opcode & 0xf000: 0xABCD & 0xf000 results in 0xA000 (only the most significant nibble is preserved).

		Right Shift: (0xA000) >> 12: 0xA000 >> 12 results in 0xA (in decimal, 10).
		*/
    const nibble = (opcode & 0xf000) >> 12;
    const x = (opcode & 0x0f00) >> 8;
    const y = (opcode & 0x00f0) >> 4;
    const n = opcode & 0x000f;
    const nn = opcode & 0x00ff;
    const nnn = opcode & 0x0fff;

    switch (nibble) {
      case 0x00e0: // 00E0: Clears the screen
        console.log("Clear the screen");
        this.display = new Array(SCREEN_HEIGHT)
          .fill(0)
          .map(() => new Array(SCREEN_WIDTH).fill(0));
        break;
      case 0x1: // 1NNN: Jumps to address NNN
        console.log("Jump to address: ", nnn.toString(16));
        this.pc = nnn;
        break;
      case 0x6: // 6XNN: Sets VX to NN
        console.log("Set register: ", x.toString(16), " to: ", nn.toString(16));
        const key = this.getRegisterKey(x);
        this.register[key] = nn;
        break;
      case 0x7: // 7XNN: Adds NN to VX
        console.log("Add register: ", x.toString(16), " to: ", nn.toString(16));
        const key2 = this.getRegisterKey(x);
        this.register[key2] = (this.register[key2] + nn) & 0xff; // value should be 8 bit
        break;
      case 0xa: // ANNN: Sets I to the address NNN
        console.log("Set index register to: ", nnn.toString(16));
        this.indexRegister = nnn;
        break;
      case 0xd: // DXYN: Draws a sprite at coordinate (VX, VY) that has a width of 8 pixels and a height of N pixels
        const xPos = this.register[this.getRegisterKey(x)] % SCREEN_WIDTH;
        const yPos = this.register[this.getRegisterKey(y)] % SCREEN_HEIGHT;
        console.log("Draw sprite at: ", xPos, yPos);

        this.register.vF = 0; // Reset VF

        for (let row = 0; row < n; row++) {
          for (let col = 0; col < 8; col++) {
            const pixel = this.memory[this.indexRegister + row];
            const pixelOn = (pixel & (0x80 >> col)) !== 0;
            if (pixelOn) {
              const x = (xPos + col) % SCREEN_WIDTH;
              const y = (yPos + row) % SCREEN_HEIGHT;

              if (this.display[y][x] === 1) {
                this.register.vF = 1;
              }

              this.display[y][x] ^= 1;
            }
          }
        }
    }
  }

  private getRegisterKey(key: number) {
    switch (key) {
      case 0x0:
        return "v0";
      case 0x1:
        return "v1";
      case 0x2:
        return "v2";
      case 0x3:
        return "v3";
      case 0x4:
        return "v4";
      case 0x5:
        return "v5";
      case 0x6:
        return "v6";
      case 0x7:
        return "v7";
      case 0x8:
        return "v8";
      case 0x9:
        return "v9";
      case 0xa:
        return "vA";
      case 0xb:
        return "vB";
      case 0xc:
        return "vC";
      case 0xd:
        return "vD";
      case 0xe:
        return "vE";
      case 0xf:
        return "vF";
      default:
        throw new Error("Invalid register key");
    }
  }

  public romLoader() {
    document
      .getElementById("romLoader")!
      .addEventListener("change", (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            this.loadRom(arrayBuffer);
            this.run(); // Start the emulator
          };
          reader.readAsArrayBuffer(file);
        }
      });
  }
}

const chip8 = new Chip8();

chip8.romLoader();

stopButton?.addEventListener("click", () => {
  chip8.stop();
});
