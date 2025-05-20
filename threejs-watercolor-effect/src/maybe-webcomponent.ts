// russel boswell

class WebglElement extends HTMLElement {
  connectedCallback() {
    const sr = this.attachShadow({ mode: "closed" });
    sr.innerHTML = `<canvas id="canvas" style="width: 100%; height: 100%;"></canvas>`;

    /* VARIABLES */
    const canvas = sr.getElementById("canvas");
    const gl = canvas.getContext("webgl2");
    const program = gl.createProgram();
    let resize = true;

    /* VERTEX SHADER */
    const vertBuffer = gl.createBuffer();
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const vertexShaderSource = `#version 300 es
            in vec2 position;
            out vec2 vUV;

            void main(){
                gl_Position = vec4(position, 0.0, 1.0);
                vUV = (position + 1.0) * 0.5;
            }
        `;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    gl.attachShader(program, vertexShader);

    /* FRAGMENT SHADER */
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    const fragmentShaderSource = `#version 300 es
            precision mediump float;
            in vec2 vUV;
            out vec4 fragColor;

            void main(){
                fragColor = vec4(vUV.x, 0.0, vUV.y, 1.0);
            }
        `;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    gl.attachShader(program, fragmentShader);

    /* FUNCTIONS */
    gl.linkProgram(program);
    gl.useProgram(program);

    function config() {
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function draw() {
      if (resize) {
        config();
        resize = false;
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function animate() {
      draw();
      requestAnimationFrame(animate);
    }
    animate();

    window.addEventListener("resize", () => {
      resize = true;
    });
  }
}
window.customElements.define("webgl-element", WebglElement);
