#define NUM_OCTAVES 3

uniform sampler2D tDiffuse;
uniform sampler2D tPrev;
uniform vec2 uResolution;
uniform float uTime;

varying vec2 vUv;

// https://github.com/yiwenl/glsl-fbm/blob/master/2d.glsl
float rand(vec2 n) {
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(vec2 p){
	vec2 ip = floor(p);
	vec2 u = fract(p);
	u = u*u*(3.0-2.0*u);

	float res = mix(
		mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
		mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
	return res*res;
}

float fbm(vec2 x) {
	float v = 0.0;
	float a = 0.5;
	vec2 shift = vec2(100);
	// Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
	for (int i = 0; i < NUM_OCTAVES; ++i) {
		v += a * noise(x);
		x = rot * x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}

// https://github.com/jamieowen/glsl-blend/blob/master/darken.glsl
float blendDarken(float base, float blend) {
	return min(blend,base);
}

vec3 blendDarken(vec3 base, vec3 blend) {
	return vec3(blendDarken(base.r,blend.r),blendDarken(base.g,blend.g),blendDarken(base.b,blend.b));
}

vec3 blendDarken(vec3 base, vec3 blend, float opacity) {
	return (blendDarken(base, blend) * opacity + base * (1.0 - opacity));
}

vec3 hsl2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );

    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

vec3 rgb2hsl( in vec3 c ){
  float h = 0.0;
	float s = 0.0;
	float l = 0.0;
	float r = c.r;
	float g = c.g;
	float b = c.b;
	float cMin = min( r, min( g, b ) );
	float cMax = max( r, max( g, b ) );

	l = ( cMax + cMin ) / 2.0;
	if ( cMax > cMin ) {
		float cDelta = cMax - cMin;

        //s = l < .05 ? cDelta / ( cMax + cMin ) : cDelta / ( 2.0 - ( cMax + cMin ) ); Original
		s = l < .0 ? cDelta / ( cMax + cMin ) : cDelta / ( 2.0 - ( cMax + cMin ) );

		if ( r == cMax ) {
			h = ( g - b ) / cDelta;
		} else if ( g == cMax ) {
			h = 2.0 + ( b - r ) / cDelta;
		} else {
			h = 4.0 + ( r - g ) / cDelta;
		}

		if ( h < 0.0) {
			h += 6.0;
		}
		h = h / 6.0;
	}
	return vec3( h, s, l );
}


vec3 bgColor = vec3(1.);
void main() {
  vec4 color = texture2D(tDiffuse, vUv); // mose movement
  vec4 prev = texture2D(tPrev, vUv); // previous frame
  vec2 aspect = vec2(1., 1.); // what % of each axis to apply

  // TODO: neat to have variance over time
  float offset = floor(uTime / 2.0);
  float radius = 0.005;
  vec2 displacement = fbm(vUv * 22. + offset) * aspect * radius;

  // sample colors around orthogonally sorta like gaussian blur?
  vec4 texel = texture2D(tPrev, vUv);
  vec4 texel2 = texture2D(tPrev, vec2(vUv.x + displacement.x, vUv.y));
  vec4 texel3 = texture2D(tPrev, vec2(vUv.x - displacement.x, vUv.y));
  vec4 texel4 = texture2D(tPrev, vec2(vUv.x, vUv.y + displacement.y));
  vec4 texel5 = texture2D(tPrev, vec2(vUv.x, vUv.y - displacement.y));

  // blend all the texels together
  vec3 floodcolor = texel.rgb;
  floodcolor = blendDarken(floodcolor, texel2.rgb);
  floodcolor = blendDarken(floodcolor, texel3.rgb);
  floodcolor = blendDarken(floodcolor, texel4.rgb);
  floodcolor = blendDarken(floodcolor, texel5.rgb);

  vec3 watercolor = blendDarken(prev.rgb, floodcolor * 1.01, 0.35);
  vec3 gradient = hsl2rgb(vec3(color.g + (noise(vec2(uTime, 0.0)) * 0.1) - 0.05, 0.5, 0.5));
  // choose which color based off of passed in `color`
  vec3 lcolor = mix(vec3(1.), gradient, color.r);
  vec3 finalColor = blendDarken(watercolor, lcolor);

#if 0
  gl_FragColor = color + prev * 0.9;
#elif 0
  gl_FragColor = vec4(displacement, 0., 1.);
#elif 0
  gl_FragColor = vec4(watercolor, 1.);
#elif 0
  gl_FragColor = vec4(gradient, 1.);
#else
  gl_FragColor = vec4(min(bgColor, finalColor * 1.01), 1.);
#endif
}
