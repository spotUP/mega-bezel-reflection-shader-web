// Minimal blur helpers for web build.
// The original blur functions are not bundled, so provide safe fallbacks.

vec3 tex2Dblur9x9(sampler2D tex, vec2 uv, vec2 dxdy) {
  return texture(tex, uv).rgb;
}
