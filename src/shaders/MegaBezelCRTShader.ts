import * as THREE from 'three';

/**
 * Advanced CRT shader inspired by Mega Bezel
 * Provides comprehensive CRT emulation effects
 */
export class MegaBezelCRTShader {
  static createMaterial(passType: string = 'default'): THREE.ShaderMaterial {
    // Different shader configurations for different passes
    if (passType === 'screen-scale') {
      return this.createScreenScaleShader();
    } else if (passType === 'grade') {
      return this.createColorGradeShader();
    } else if (passType === 'sharpen') {
      return this.createSharpenShader();
    } else {
      return this.createDefaultCRTShader();
    }
  }

  private static createDefaultCRTShader(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        Source: { value: null },
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(800, 600) }
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
        uniform vec2 resolution;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(Source, vUv);
          gl_FragColor = color;
        }
      `,
      depthTest: false,
      depthWrite: false
    });
  }

  private static createScreenScaleShader(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        Source: { value: null },
        resolution: { value: new THREE.Vector2(800, 600) },
        curvature: { value: new THREE.Vector2(0.02, 0.02) },
        scanlineWeight: { value: 0.3 },
        scanlineGap: { value: 2.0 },
        brightness: { value: 1.0 }
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
        uniform vec2 resolution;
        uniform vec2 curvature;
        uniform float scanlineWeight;
        uniform float scanlineGap;
        uniform float brightness;

        varying vec2 vUv;

        // Apply barrel distortion for CRT curvature
        vec2 barrelDistortion(vec2 coord) {
          vec2 cc = coord - 0.5;
          float dist = dot(cc, cc);
          vec2 result = coord + cc * (dist + curvature.x * dist * dist) * curvature.y;
          return result;
        }

        // Generate scanlines
        float scanline(float y) {
          float scanline = clamp(0.95 + 0.05 * cos(3.14159 * y * resolution.y * scanlineGap), 0.0, 1.0);
          float grille = 0.85 + 0.15 * clamp(1.5 * cos(3.14159 * y * resolution.y * 4.0), 0.0, 1.0);
          return scanline * grille * 1.2;
        }

        // RGB shadow mask
        vec3 shadowMask(vec2 pos) {
          vec3 mask = vec3(1.0);
          float line = floor(pos.y * resolution.y);
          float column = floor(pos.x * resolution.x);

          if (mod(column, 3.0) == 0.0) mask.r = 0.7;
          else if (mod(column, 3.0) == 1.0) mask.g = 0.7;
          else mask.b = 0.7;

          return mask;
        }

        void main() {
          // Apply curvature
          vec2 curvedUV = barrelDistortion(vUv);

          // Check if we're outside the screen bounds
          if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
          }

          // Sample the texture
          vec3 color = texture2D(Source, curvedUV).rgb;

          // Apply scanlines
          float scanlineMultiplier = mix(1.0, scanline(curvedUV.y), scanlineWeight);
          color *= scanlineMultiplier;

          // Apply RGB shadow mask
          color *= shadowMask(curvedUV);

          // Apply vignette
          float vignette = 1.0 - 0.6 * length(vUv - 0.5);
          color *= vignette;

          // Apply brightness
          color *= brightness;

          // Add slight bloom effect
          vec3 bloom = texture2D(Source, curvedUV).rgb;
          color += bloom * 0.1;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });
  }

  private static createColorGradeShader(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        Source: { value: null },
        saturation: { value: 1.1 },
        contrast: { value: 1.15 },
        brightness: { value: 1.05 },
        gamma: { value: 1.2 }
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
        uniform float saturation;
        uniform float contrast;
        uniform float brightness;
        uniform float gamma;

        varying vec2 vUv;

        vec3 adjustSaturation(vec3 color, float sat) {
          float gray = dot(color, vec3(0.299, 0.587, 0.114));
          return mix(vec3(gray), color, sat);
        }

        void main() {
          vec3 color = texture2D(Source, vUv).rgb;

          // Apply gamma correction
          color = pow(color, vec3(1.0 / gamma));

          // Adjust saturation
          color = adjustSaturation(color, saturation);

          // Apply contrast
          color = (color - 0.5) * contrast + 0.5;

          // Apply brightness
          color *= brightness;

          // NTSC color correction (simulate old TV phosphors)
          mat3 ntscMatrix = mat3(
            1.0, 0.0, 0.0,
            0.0, 0.88, 0.0,
            0.0, 0.0, 0.82
          );
          color = ntscMatrix * color;

          // Clamp to valid range
          color = clamp(color, 0.0, 1.0);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });
  }

  private static createSharpenShader(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        Source: { value: null },
        resolution: { value: new THREE.Vector2(800, 600) },
        sharpness: { value: 0.5 }
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
        uniform vec2 resolution;
        uniform float sharpness;

        varying vec2 vUv;

        void main() {
          vec2 step = 1.0 / resolution;

          // 5-sample sharpen kernel
          vec3 color = texture2D(Source, vUv).rgb * (1.0 + 4.0 * sharpness);
          color -= texture2D(Source, vUv + vec2(-step.x, 0.0)).rgb * sharpness;
          color -= texture2D(Source, vUv + vec2(step.x, 0.0)).rgb * sharpness;
          color -= texture2D(Source, vUv + vec2(0.0, -step.y)).rgb * sharpness;
          color -= texture2D(Source, vUv + vec2(0.0, step.y)).rgb * sharpness;

          // Prevent overshooting
          color = clamp(color, 0.0, 1.0);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });
  }
}