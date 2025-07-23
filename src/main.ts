class WebglElement extends HTMLElement {
  connectedCallback() {
    const sr = this.attachShadow({ mode: "closed" });
    sr.innerHTML = `<canvas id="canvas" style="width: 100%; height: 100%;"></canvas>`;
    const canvas = sr.getElementById("canvas") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2")!;

    // vertex stuff
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // shaders
    const vs = createShader(
      gl,
      gl.VERTEX_SHADER,
      `#version 300 es
            in vec2 pos;
            out vec2 uv;
            void main() {
                gl_Position = vec4(pos, 0, 1);
                uv = pos * 0.5 + 0.5;
            }
        `
    );
    const fs = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      `#version 300 es
            precision mediump float;
            in vec2 uv;
            out vec4 fragColor;
            uniform sampler2D tex;
            uniform vec2 u_resolution;
            uniform vec2 u_mousepos;
            uniform bool u_mousedown;

            void main() {
              vec2 coords = uv * u_resolution;
              float d = distance(u_mousepos, coords);

              fragColor = texture(tex, uv) - vec4(0, 0.01, 0, 0);

              if (d < 100.0) {
                if (u_mousedown) {
                  fragColor = vec4(d/100.0, 0.5, 0.5, 0);
                } else {
                  fragColor = vec4(0.5, 0.5, d/100.0, 0);
                }
              }
            }
        `
    );
    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const pass = {
      current: 0,
      textures: [] as WebGLTexture[],
      fbos: [] as WebGLFramebuffer[],
      create() {
        const tex = gl.createTexture();
        this.textures[this.current] = tex;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          canvas.width,
          canvas.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create a framebuffer
        const fbo = gl.createFramebuffer();
        this.fbos[this.current] = fbo;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          tex,
          0
        );
      },
      swap() {
        this.current = 1 - this.current;
      },
      init() {
        this.create();
        this.swap();
        this.create();
      },
    };
    pass.init();

    const timer = {
      location: gl.getUniformLocation(program, "u_time"),
      u_time: 0,
      draw(currentTime: number = 0) {
        const deltaTime = currentTime - this.u_time;
        this.u_time = currentTime;
        gl.uniform1f(timer.location, this.u_time / 1000.0);
        return deltaTime;
      },
    };

    const mouse = {
      location_pos: gl.getUniformLocation(program, "u_mousepos"),
      location_down: gl.getUniformLocation(program, "u_mousedown"),
      down() {
        gl.uniform1i(mouse.location_down, 1);
      },
      up() {
        gl.uniform1i(mouse.location_down, 0);
      },
      move(event: MouseEvent) {
        console.log(event.offsetY, event.offsetX);
        gl.uniform2fv(mouse.location_pos, [
          event.offsetX * devicePixelRatio,
          canvas.height - event.offsetY * devicePixelRatio,
        ]);
      },
    };
    gl.uniform2fv(mouse.location_pos, [0, 0]);
    canvas.addEventListener("mousedown", mouse.down);
    canvas.addEventListener("mouseup", mouse.up);
    canvas.addEventListener("mousemove", mouse.move);

    const resize = {
      yes: true,
      location: gl.getUniformLocation(program, "u_resolution"),
      draw() {
        if (this.yes) {
          canvas.height = canvas.offsetHeight * devicePixelRatio;
          canvas.width = canvas.offsetWidth * devicePixelRatio;
          gl.viewport(0, 0, canvas.width, canvas.height);
          console.log(canvas.height, canvas.width);
          gl.uniform2fv(resize.location, [canvas.width, canvas.height]);
          pass.init();
          this.yes = false;
        }
      },
      listener() {
        this.yes = true;
      },
    };
    window.addEventListener("resize", resize.listener);

    const draw = (currentTime: number) => {
      resize.draw();
      timer.draw(currentTime);

      const srcTex = pass.textures[pass.current];
      const dstFb = pass.fbos[1 - pass.current];

      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFb);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      pass.swap();
    };

    (function loop(currentTime) {
      draw(currentTime);
      requestAnimationFrame(loop);
    })(0);
  }
}

function createShader(gl: WebGL2RenderingContext, type: number, source: any) {
  var shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  const log = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw Error(log!);
}

window.customElements.define("webgl-element", WebglElement);
