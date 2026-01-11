import * as THREE from 'three';

/**
 * Simple CRT shader that actually works with Three.js
 * Provides scanlines, curvature, and color effects
 */
export class SimpleCRTShader {
  static createMaterial(uniforms: Record<string, THREE.IUniform> = {}): THREE.ShaderMaterial {
    const defaultUniforms = {
      Source: { value: null },
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(800, 600) },
      curvature: { value: 0.2 },
      scanlineIntensity: { value: 0.3 },
      scanlineCount: { value: 240 },
      vignetteAmount: { value: 0.4 },
      brightness: { value: 1.0 },
      contrast: { value: 1.1 },
      ...uniforms
    };

    return new THREE.ShaderMaterial({
      uniforms: defaultUniforms,
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
        uniform vec2 resolution;
        uniform float curvature;
        uniform float scanlineIntensity;
        uniform float scanlineCount;
        uniform float vignetteAmount;
        uniform float brightness;
        uniform float contrast;

        varying vec2 vUv;

        // CRT curvature effect
        vec2 curveUV(vec2 uv) {
          uv = uv * 2.0 - 1.0;
          vec2 offset = abs(uv.yx) / vec2(6.0, 4.0);
          uv = uv + uv * offset * offset * curvature;
          uv = uv * 0.5 + 0.5;
          return uv;
        }

        // Scanline effect
        float scanline(vec2 uv) {
          float line = sin(uv.y * scanlineCount * 3.14159);
          return 1.0 - scanlineIntensity * (line * line);
        }

        // Vignette effect
        float vignette(vec2 uv) {
          uv = (uv - 0.5) * 0.98;
          return 1.0 - vignetteAmount * dot(uv, uv);
        }

        void main() {
          vec2 curvedUV = curveUV(vUv);

          // Sample texture with curved coordinates
          vec4 color = texture2D(Source, curvedUV);

          // Apply scanlines
          color.rgb *= scanline(curvedUV);

          // Apply vignette
          color.rgb *= vignette(curvedUV);

          // Apply brightness and contrast
          color.rgb = (color.rgb - 0.5) * contrast + 0.5;
          color.rgb *= brightness;

          // Add slight color separation for CRT effect
          float aberration = 0.002;
          color.r = texture2D(Source, curvedUV + vec2(aberration, 0.0)).r;
          color.b = texture2D(Source, curvedUV - vec2(aberration, 0.0)).b;

          // Output color
          gl_FragColor = color;
        }
      `,
      depthTest: false,
      depthWrite: false
    });
  }
}