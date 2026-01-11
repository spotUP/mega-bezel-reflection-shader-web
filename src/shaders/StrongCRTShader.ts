import * as THREE from 'three';

/**
 * Strong CRT shader with very visible effects for testing
 */
export class StrongCRTShader {
  static createMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        Source: { value: null },
        time: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D Source;
        uniform float time;
        varying vec2 vUv;

        // Strong CRT curvature
        vec2 curve(vec2 uv) {
          uv = (uv - 0.5) * 2.0;
          uv *= 1.1;
          uv.x *= 1.0 + pow((abs(uv.y) / 5.0), 2.0);
          uv.y *= 1.0 + pow((abs(uv.x) / 4.0), 2.0);
          uv = (uv / 2.0) + 0.5;
          uv = uv * 0.92 + 0.04;
          return uv;
        }

        void main() {
          // Apply strong curvature
          vec2 q = curve(vUv);

          // Check bounds - show black outside screen
          if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }

          // Sample the texture
          vec3 color = texture2D(Source, q).rgb;

          // Very strong scanlines
          float scanline = sin(q.y * 600.0) * 0.08;
          color *= (1.0 - scanline);

          // Thicker scanlines every 3rd line
          float sl = sin(q.y * 200.0);
          color.rgb *= (1.0 - sl * 0.2);

          // Stronger RGB separation (chromatic aberration)
          color.r = texture2D(Source, vec2(q.x + 0.005, q.y)).r;
          color.g = texture2D(Source, vec2(q.x + 0.001, q.y)).g;
          color.b = texture2D(Source, vec2(q.x - 0.004, q.y)).b;

          // Add visible phosphor grid/shadow mask
          vec2 pixelPos = q * vec2(800.0, 600.0);
          float mask = 1.0;

          // Aperture grille simulation
          if (mod(floor(pixelPos.x), 3.0) == 0.0) {
            mask *= 0.85;
            color.r *= 1.2; // Red phosphor stripe
          } else if (mod(floor(pixelPos.x), 3.0) == 1.0) {
            mask *= 0.85;
            color.g *= 1.2; // Green phosphor stripe
          } else {
            mask *= 0.85;
            color.b *= 1.2; // Blue phosphor stripe
          }

          color *= mask;

          // Strong vignette
          float vignette = 1.0 - distance(vUv, vec2(0.5, 0.5)) * 1.2;
          color *= vignette;

          // Brightness boost to compensate
          color *= 1.3;

          // Add green tint for that old monitor look
          color.g *= 1.1;

          // Add subtle flickering
          float flicker = 1.0 + sin(time * 60.0) * 0.02;
          color *= flicker;

          // Add film grain/noise
          float noise = fract(sin(dot(vUv * 1000.0, vec2(12.9898, 78.233))) * 43758.5453);
          color += (noise - 0.5) * 0.05;

          // Clamp
          color = clamp(color, 0.0, 1.0);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });
  }
}