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

            void main() {
              if (texture(tex, uv).r == 0.0) {
                fragColor = vec4(uv.x,0,uv.y,1);
              } else {
                fragColor = texture(tex, uv) + vec4(0,0.01,0,0);
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
        gl.uniform1f(this.location, this.u_time / 1000.0);
        return deltaTime;
      },
    };

    const resize = {
      yes: true,
      draw() {
        if (this.yes) {
          canvas.height = canvas.offsetHeight * devicePixelRatio;
          canvas.width = canvas.offsetWidth * devicePixelRatio;
          gl.viewport(0, 0, canvas.width, canvas.height);
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
