"use strict";

// A 6x8 texture stores all sprite state data.
// It represents a 3x4 grid of sprites, where each
// sprite's state is represented by a 2x2 square of pixels.
const sprite_data_grid_width = 3;
const sprite_data_grid_height = 4;
const sprite_data_point_size = 2;

const vertex_shader_text = `
attribute vec3 grid_indices;
uniform sampler2D data_texture;
varying vec4 display_color;
varying vec4 texture_uv_encoded;

void main() {
  // Scale by 2.0 and translate to fit in the [(-1,-1), (1,1)] view space.
  gl_Position = vec4(
      (0.5+grid_indices.x) / ${sprite_data_grid_width}.0 * 2.0 - 1.0,
      (0.5+grid_indices.y) / ${sprite_data_grid_height}.0 * 2.0 - 1.0,
      0.0, 1.0);

  // Each point renders to 4 pixels.
  gl_PointSize = ${sprite_data_point_size}.0;

  vec2 index_uv = vec2(
    (grid_indices.x + 0.5/${sprite_data_point_size}.0) / ${sprite_data_grid_width}.0,
    (grid_indices.y + 0.5/${sprite_data_point_size}.0) / ${sprite_data_grid_height}.0);
  texture_uv_encoded = texture2DLod(data_texture, index_uv, 0.0);
  vec2 texture_uv;
  texture_uv.x = texture_uv_encoded.x / texture_uv_encoded.y;
  texture_uv.y = texture_uv_encoded.z / texture_uv_encoded.w;
  display_color = texture2DLod(data_texture, texture_uv, 0.0);
}
`;

const fragment_shader_text = `
precision highp float;
varying vec4 display_color;
varying vec4 texture_uv_encoded;
void main() {
  if (gl_PointCoord.y < 0.5) {
    // Clear the top half of each pixel.
    // Yes, gl_PointCoord.y == 0 is the top of the point. Go figure.
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  } else {
    if (gl_PointCoord.x < 0.5) {
      gl_FragColor = texture_uv_encoded;
    } else {
      gl_FragColor = display_color;
    }
  }
}
`;

const display_vertex_shader_text = `
attribute vec3 rectangle_vertex;
attribute vec2 rectangle_sprite_data_uv;
varying vec2 sprite_data_uv;
void main() {
  gl_Position = vec4(rectangle_vertex, 1.0);
  sprite_data_uv = rectangle_sprite_data_uv;
}
`;

const display_fragment_shader_text = `
precision highp float;
uniform sampler2D sprite_data_texture;
varying vec2 sprite_data_uv;

void main() {
  vec2 index_uv = sprite_data_uv;
  if (false) {
    // We could just display the sprite colors.
    vec2 grid_dimensions = vec2(${sprite_data_grid_width}.0, ${sprite_data_grid_height}.0);
    index_uv = floor(index_uv * grid_dimensions);
    index_uv += vec2(0.75, 0.25);
    index_uv /= grid_dimensions;
  }
  gl_FragColor = texture2D(sprite_data_texture, index_uv, 0.0);
}
`;

main();

function log_shader_compile_status(gl, shader) {
  var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  console.log("Shader compiled successfully: " + compiled);
  var compilation_log = gl.getShaderInfoLog(shader);
  console.log("Shader compiler log: " + compilation_log);
}

function main() {
  // Create canvas.
  var canvas = document.getElementById("glcanvas");
  var gl = canvas.getContext("webgl", { antialias: false });

  // Define and store geometry.
  const vertices = [
    0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0,
    2.0, 1.0, 0.0, 0.0, 2.0, 0.0, 1.0, 2.0, 0.0, 2.0, 2.0, 0.0, 0.0, 3.0, 0.0,
    1.0, 3.0, 0.0, 2.0, 3.0, 0.0,
  ];

  // Create a buffer object and store vertices.
  var coordinates_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, coordinates_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  // Unbind the buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Reference 2d vertices for a rectangle.
  const single_rectangle_x = [1.0, 0.0, 0.0, 0.0, 1.0, 1.0];
  const single_rectangle_y = [1.0, 1.0, 0.0, 0.0, 0.0, 1.0];
  const points_per_rectangle = single_rectangle_x.length;

  const rectangle_vertices = new Array(
    3 * points_per_rectangle * sprite_data_grid_width * sprite_data_grid_height
  );
  const sprite_data_uvs = new Array((rectangle_vertices.length / 3) * 2);

  for (let i = 0; i < sprite_data_grid_height; ++i) {
    for (let j = 0; j < sprite_data_grid_width; ++j) {
      let point_offset =
        (i * sprite_data_grid_width + j) * points_per_rectangle;
      for (let k = 0; k < points_per_rectangle; ++k) {
        let x = (j + single_rectangle_x[k]) / sprite_data_grid_width;
        let y = (i + single_rectangle_y[k]) / sprite_data_grid_height;
        sprite_data_uvs[2 * (point_offset + k)] = x;
        sprite_data_uvs[2 * (point_offset + k) + 1] = y;
        rectangle_vertices[3 * (point_offset + k)] = x * 2.0 - 1.0;
        rectangle_vertices[3 * (point_offset + k) + 1] = y * 2.0 - 1.0;
        rectangle_vertices[3 * (point_offset + k) + 2] = 0.0;
      }
    }
  }
  // Create a buffer object for the trivial texture display.
  var rectangle_vertex_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, rectangle_vertex_buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(rectangle_vertices),
    gl.STATIC_DRAW
  );
  // Unbind the buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  var sprite_data_uv_buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sprite_data_uv_buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(sprite_data_uvs),
    gl.STATIC_DRAW
  );
  // Unbind the buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  /*========== Texture ===========*/

  // Create input texture.
  const texture_data = [
    7,
    12,
    1,
    16,
    255,
    0,
    0,
    255, // Bottom left. Red. Looks right (7/12,1/16).
    11,
    12,
    1,
    16,
    0,
    255,
    0,
    255, // Bottom middle. Green. Looks right (11/12,1/16).
    11,
    12,
    5,
    16,
    0,
    0,
    255,
    255, // Bottom right. Blue. Looks up (11/12,5/16).
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,

    3,
    12,
    1,
    16,
    255,
    0,
    0,
    255, // Looks down.
    7,
    12,
    5,
    16,
    127,
    127,
    127,
    255, // Looks at self.
    11,
    12,
    9,
    16,
    0,
    0,
    255,
    255, // Looks up.
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,

    3,
    12,
    5,
    16,
    0,
    255,
    255,
    255, // Looks down.
    7,
    12,
    9,
    16,
    191,
    191,
    191,
    255, // Looks at self.
    11,
    12,
    13,
    16,
    255,
    255,
    0,
    255, // Looks up.
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,

    3,
    12,
    9,
    16,
    0,
    255,
    255,
    255, // Top left. Cyan. Looks down.
    3,
    12,
    13,
    16,
    255,
    0,
    255,
    255, // Top middle. Magenta. Looks left.
    7,
    12,
    13,
    16,
    255,
    255,
    0,
    255, // Top right. Yellow. Looks left.
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
  ];

  var data_texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, data_texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    sprite_data_grid_width * sprite_data_point_size,
    sprite_data_grid_height * sprite_data_point_size,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array(texture_data)
  );

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Unbind the texture.
  gl.bindTexture(gl.TEXTURE_2D, null);

  // Create output texture.
  var output_texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, output_texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    sprite_data_grid_width * sprite_data_point_size,
    sprite_data_grid_height * sprite_data_point_size,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Unbind the texture.
  gl.bindTexture(gl.TEXTURE_2D, null);

  /*================ Shaders ====================*/

  // Create a vertex shader object
  var vertex_shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertex_shader, vertex_shader_text);
  gl.compileShader(vertex_shader);
  log_shader_compile_status(gl, vertex_shader);

  // Create fragment shader object
  var fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragment_shader, fragment_shader_text);
  gl.compileShader(fragment_shader);
  log_shader_compile_status(gl, fragment_shader);

  // Create a shader program object to store
  // the combined shader program
  var shader_program = gl.createProgram();

  // Attach shaders
  gl.attachShader(shader_program, vertex_shader);
  gl.attachShader(shader_program, fragment_shader);

  gl.bindAttribLocation(shader_program, 0, "grid_indices");

  // Link both the programs and use them.
  gl.linkProgram(shader_program);

  /*================ Shaders for display ====================*/

  // Create a vertex shader object
  var display_vertex_shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(display_vertex_shader, display_vertex_shader_text);
  gl.compileShader(display_vertex_shader);
  log_shader_compile_status(gl, display_vertex_shader);

  // Create fragment shader object
  var display_fragment_shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(display_fragment_shader, display_fragment_shader_text);
  gl.compileShader(display_fragment_shader);
  log_shader_compile_status(gl, display_fragment_shader);

  // Create a shader program object to store
  // the combined shader program
  var display_shader_program = gl.createProgram();

  // Attach shaders
  gl.attachShader(display_shader_program, display_vertex_shader);
  gl.attachShader(display_shader_program, display_fragment_shader);

  gl.bindAttribLocation(display_shader_program, 0, "rectangle_vertex");
  gl.bindAttribLocation(display_shader_program, 1, "rectangle_sprite_data_uv");

  // Link both the programs and use them.
  gl.linkProgram(display_shader_program);

  //// Avoiding a dumb warning to fill dummy ////////////////////////////////
  gl.enableVertexAttribArray(0);

  //// Associating shaders with buffer objects //////////////////////////////
  gl.useProgram(shader_program);

  // Tell shader that the "data_texture" uniform is bound to texture unit 1.
  var data_texture_uniform = gl.getUniformLocation(
    shader_program,
    "data_texture"
  );
  gl.uniform1i(data_texture_uniform, 1);

  gl.useProgram(null);

  //// Associating display shaders and buffers //////////////////////////////
  gl.useProgram(display_shader_program);

  // Tell shader that the "sprite_data_texture" uniform is bound to texture unit 2.
  var display_texture_uniform = gl.getUniformLocation(
    display_shader_program,
    "sprite_data_texture"
  );
  gl.uniform1i(display_texture_uniform, 2);

  gl.useProgram(null);

  //// Draw first frame /////////////////////////////////////////////////////
  // We use texture unit 2 for display, so associate initial data with that.
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, data_texture);
  gl.activeTexture(gl.TEXTURE0);
  draw_to_screen(
    canvas,
    gl,
    display_shader_program,
    rectangle_vertex_buffer,
    sprite_data_uv_buffer,
    6 * sprite_data_grid_width * sprite_data_grid_height
  );

  //// Set up event handler /////////////////////////////////////////////////
  // Framebuffer for texture output.
  var output_framebuffer = gl.createFramebuffer();
  var frame_count_odd = false;
  function draw_cb() {
    let tmp_input_texture = data_texture;
    let tmp_output_texture = output_texture;
    if (frame_count_odd) {
      tmp_input_texture = output_texture;
      tmp_output_texture = data_texture;
    }

    draw_to_texture(
      gl,
      output_framebuffer,
      tmp_input_texture,
      tmp_output_texture,
      shader_program,
      coordinates_buffer,
      sprite_data_grid_width,
      sprite_data_grid_height,
      sprite_data_point_size
    );

    draw_to_screen(
      canvas,
      gl,
      display_shader_program,
      rectangle_vertex_buffer,
      sprite_data_uv_buffer,
      6 * sprite_data_grid_width * sprite_data_grid_height
    );

    frame_count_odd = !frame_count_odd;
  }
  document.addEventListener("mousedown", draw_cb);
}

function draw_to_texture(
  gl,
  output_framebuffer,
  input_texture,
  output_texture,
  shader_program,
  coordinates_buffer,
  sprite_data_grid_width,
  sprite_data_grid_height,
  sprite_data_point_size
) {
  // The "data_texture" uniform uses texture unit 1.
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, input_texture);
  gl.activeTexture(gl.TEXTURE0);

  // The "output_texture" uniform uses texture unit 2.
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, output_texture);
  gl.activeTexture(gl.TEXTURE0);

  //// Draw to texture ///////////////////////////////////////////////////////
  gl.bindFramebuffer(gl.FRAMEBUFFER, output_framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    output_texture,
    0
  );

  gl.viewport(
    0,
    0,
    sprite_data_grid_width * sprite_data_point_size,
    sprite_data_grid_height * sprite_data_point_size
  );
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Switch shader program and attribute array 0.
  // Apparently attribute array 0 should always be used.
  gl.useProgram(shader_program);
  gl.bindBuffer(gl.ARRAY_BUFFER, coordinates_buffer);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.drawArrays(gl.POINTS, 0, sprite_data_grid_width * sprite_data_grid_height);
  gl.useProgram(null);
}

function draw_to_screen(
  canvas,
  gl,
  display_shader_program,
  rectangle_vertex_buffer,
  sprite_data_uv_buffer,
  vertex_count
) {
  //// Draw to screen ////////////////////////////////////////////////////////
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.enable(gl.DEPTH_TEST);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Switch shader program and attribute array 0.
  // Apparently attribute array 0 should always be used.
  gl.useProgram(display_shader_program);
  gl.bindBuffer(gl.ARRAY_BUFFER, rectangle_vertex_buffer);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.enableVertexAttribArray(1);
  gl.bindBuffer(gl.ARRAY_BUFFER, sprite_data_uv_buffer);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.drawArrays(gl.TRIANGLES, 0, vertex_count);
  gl.disableVertexAttribArray(1);
  gl.useProgram(null);
}
