uniform sampler2D tSource;
uniform vec2 uResolution;
varying vec2 vUv;

void main() {
  vec4 prev = texture2D(tSource, vUv);
  float whiteness = (prev.r + prev.g + prev.b) / 3.;
  gl_FragColor = vec4(prev.rgb, 1. - whiteness);
  // gl_FragColor = vec4(1., 0., 1., 0.2);
}
