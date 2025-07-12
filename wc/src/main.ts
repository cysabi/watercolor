class WebglElement extends HTMLElement {
  connectedCallback() {
    const sr = this.attachShadow({ mode: "closed" });
    sr.innerHTML = `<canvas id="canvas" style="width: 100%; height: 100%;"></canvas>`;
    const canvas = sr.getElementById("canvas") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2")!;
    const vertBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    const vertexShader = createShader(
      gl,
      gl.VERTEX_SHADER,
      `#version 300 es
        in vec2 position;
        out vec2 vUV;

        void main(){
            gl_Position = vec4(position, 0.0, 1.0);
            vUV = (position + 1.0) * 0.5;
        }
      ` // ??? in vs out
      // ??? uniform in fragment vs vertex
    );

    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      `#version 300 es
        precision mediump float;
        in vec2 vUV;
        out vec4 fragColor;
        uniform float u_time;
        uniform sampler2D u_texture;
        uniform vec2 u_resolution;

        void main() {
          fragColor = texture(u_texture, vUV);
          fragColor.r += 0.2;
        }
      `
    );
    const program = createProgram(gl, vertexShader!, fragmentShader!)!;
    gl.useProgram(program);

    const pass = {
      index: 0,
      fbos: [] as WebGLFramebuffer[],
      textures: [] as WebGLTexture[],
      location: gl.getUniformLocation(program, "u_texture"),
      swap() {
        gl.uniform1i(pass.location, this.index); // ???
        this.index = this.index ? 0 : 1;
      },
      getCurrentFBO() {
        return this.fbos[this.index];
      },
      getCurrentTexture() {
        return this.textures[this.index];
      },
      create() {
        var texture = gl.createTexture();
        // gl.activeTexture(gl.TEXTURE0 + this.index); // ???
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
        this.textures[this.index] = texture;

        // Create a framebuffer
        var fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        this.fbos[this.index] = fbo;

        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0
        );
      },
    };
    pass.create();
    pass.swap();
    pass.create();

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
      location: gl.getUniformLocation(program, "u_resolution"),
      draw() {
        if (this.yes) {
          canvas.height = canvas.offsetHeight * devicePixelRatio;
          canvas.width = canvas.offsetWidth * devicePixelRatio;
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.uniform2f(this.location, canvas.width, canvas.height);
          pass.create();
          pass.swap();
          pass.create();
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

      gl.bindFramebuffer(gl.FRAMEBUFFER, pass.getCurrentFBO());
      gl.bindTexture(gl.TEXTURE_2D, pass.getCurrentTexture()); // ???
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      pass.swap();

      gl.bindFramebuffer(gl.FRAMEBUFFER, pass.getCurrentFBO());
      gl.bindTexture(gl.TEXTURE_2D, pass.getCurrentTexture());
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null); // add display shader???
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

window.customElements.define("webgl-element", WebglElement);
