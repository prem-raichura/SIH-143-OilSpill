// Ocean surface shader: procedural wind waves, sky reflection, sun glint, and an oil mask that
// (1) damps the short waves (why radar sees oil as dark), (2) darkens thick oil, (3) adds thin-film sheen.
// uSar = 1 switches to a radar-style rendering of the same surface (brightness ~ roughness, with speckle).
import * as THREE from "three";

const vertex = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}
`;

const fragment = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunStrength;
uniform vec3 uDeep;
uniform vec3 uScatter;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec2 uWindDir;
uniform float uWindSpeed;
uniform sampler2D uOil;
uniform vec4 uOilBox;
uniform float uSar;
uniform float uSarWind;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorld;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Gradient of the sea surface height from a sum of directional waves around the wind direction.
vec2 waveGrad(vec2 p, float t, float amp, float dist) {
  vec2 d0 = normalize(uWindDir + vec2(1e-4, 0.0));
  vec2 g = vec2(0.0);
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float wl = 120.0 * pow(0.58, fi);
    float ang = (hash21(vec2(fi, 3.1)) - 0.5) * 1.5;
    vec2 dir = vec2(cos(ang) * d0.x - sin(ang) * d0.y, sin(ang) * d0.x + cos(ang) * d0.y);
    float k = 6.2831853 / wl;
    float c = sqrt(9.81 / k);
    float a = amp * wl * 0.010;
    float fade = 1.0 - smoothstep(wl * 30.0, wl * 140.0, dist);
    float ph = k * dot(dir, p) - k * c * t + fi * 1.7;
    g += dir * (a * k * cos(ph)) * fade;
  }
  // fine capillary texture near the camera
  float nf = 1.0 - smoothstep(60.0, 900.0, dist);
  vec2 q = p * 0.55 + d0 * t * 0.8;
  float e = 0.35;
  float n0 = vnoise(q);
  g += vec2(vnoise(q + vec2(e, 0.0)) - n0, vnoise(q + vec2(0.0, e)) - n0) * 0.35 * amp * nf;
  return g;
}

void main() {
  #include <logdepthbuf_fragment>
  float dist = length(cameraPosition - vWorld);
  vec2 uv = (vWorld.xz - uOilBox.xy) / uOilBox.zw;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float th = texture2D(uOil, clamp(uv, 0.0, 1.0)).r * inside;
  float oil = clamp(th * 1.35, 0.0, 1.0);

  if (uSar > 0.5) {
    // Radar look: backscatter grows with short-wave roughness; oil damps it; high wind breaks through.
    float bg = smoothstep(1.2, 7.0, uSarWind) * (0.75 + 0.25 * smoothstep(7.0, 14.0, uSarWind));
    float damping = 0.92 * (1.0 - smoothstep(9.0, 15.0, uSarWind));
    float rough = bg * (1.0 - damping * oil);
    float n = hash21(floor(vWorld.xz / 18.0));
    float speck = -log(max(n, 0.002));
    float across = clamp((vWorld.x - uOilBox.x) / uOilBox.z, 0.0, 1.0);
    float b = rough * 0.5 * speck * mix(1.2, 0.8, across);
    gl_FragColor = vec4(vec3(clamp(b, 0.0, 1.0)), 1.0);
    #include <colorspace_fragment>
    return;
  }

  float amp = clamp(uWindSpeed / 8.0, 0.25, 1.6);
  vec2 g = waveGrad(vWorld.xz, uTime, amp, dist) * (1.0 - 0.9 * oil);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 R = reflect(-V, N);
  float ndv = max(dot(N, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

  vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(max(R.y, 0.0), 0.45));
  vec3 body = uDeep + uScatter * clamp(length(g) * 1.6, 0.0, 1.0) * max(uSunDir.y, 0.05);
  float shin = mix(260.0, 1800.0, oil);
  float spec = pow(max(dot(R, uSunDir), 0.0), shin) * uSunStrength * mix(1.0, 3.0, oil);
  vec3 col = mix(body, sky, fres) + uSunColor * spec;

  // Thick oil: dark, glossy
  float thick = smoothstep(0.18, 0.5, th);
  vec3 core = vec3(0.03, 0.022, 0.015) + sky * fres * 0.5;
  col = mix(col, core + uSunColor * spec, thick * 0.9);
  // Thin film: iridescent sheen, strongest at grazing angles
  float thin = smoothstep(0.015, 0.06, th) * (1.0 - smoothstep(0.1, 0.24, th));
  vec3 irid = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + th * 6.0 + ndv * 1.6));
  col *= 1.0 - 0.35 * smoothstep(0.015, 0.2, th);
  col += (irid - 0.5) * 0.09 * thin * (0.5 + fres) * max(uSunStrength, 0.3);

  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createWaterMaterial(oil: THREE.Texture, oilBox: THREE.Vector4) {
  // Fixed daytime sun (matches SUN_DIR in OceanScene): about 35° up, from the south-east.
  const alt = (35 * Math.PI) / 180;
  const az = (135 * Math.PI) / 180;
  const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)).normalize();
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color("#FFF3DC") },
      uSunStrength: { value: 1.4 },
      uDeep: { value: new THREE.Color("#0E5A86") },
      uScatter: { value: new THREE.Color("#2BB3B1") },
      uSkyZenith: { value: new THREE.Color("#3F7FD0") },
      uSkyHorizon: { value: new THREE.Color("#CFE4F5") },
      uWindDir: { value: new THREE.Vector2(1, 0) },
      uWindSpeed: { value: 6 },
      uOil: { value: oil },
      uOilBox: { value: oilBox },
      uSar: { value: 0 },
      uSarWind: { value: 6 },
      uFogColor: { value: new THREE.Color("#CFE4F5") },
      uFogDensity: { value: 0.0000055 },
    },
  });
}
