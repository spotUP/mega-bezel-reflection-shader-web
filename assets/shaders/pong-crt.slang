#version 450

/*
   Pong CRT Shader
   Simple scanlines + curvature for retro effect
*/

#pragma parameter scanlineIntensity "Scanline Intensity" 0.3 0.0 1.0 0.05
#pragma parameter scanlineCount "Scanline Count" 300.0 200.0 1200.0 50.0
#pragma parameter curvature "Screen Curvature" 0.08 0.0 0.2 0.01
#pragma parameter brightness "Brightness" 1.1 0.5 2.0 0.1
#pragma parameter vignetteIntensity "Vignette Intensity" 0.4 0.0 1.0 0.05

// ========== VERTEX SHADER ==========

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

layout(set = 0, binding = 0) uniform UBO
{
   mat4 MVP;
};

void main()
{
   gl_Position = MVP * Position;
   vTexCoord = TexCoord;
}

// ========== FRAGMENT SHADER ==========

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

layout(set = 0, binding = 1) uniform sampler2D Source;

layout(push_constant) uniform Push
{
   float scanlineIntensity;
   float scanlineCount;
   float curvature;
   float brightness;
   float vignetteIntensity;
} params;

// Apply barrel distortion
vec2 curveUV(vec2 uv)
{
   if (params.curvature <= 0.0) return uv;

   vec2 centered = uv - 0.5;
   float r2 = dot(centered, centered);
   float distortion = 1.0 + params.curvature * r2;
   vec2 curved = centered * distortion + 0.5;

   return curved;
}

void main()
{
   // Apply CRT curvature
   vec2 curvedUV = curveUV(vTexCoord);

   // Check if outside screen bounds (black borders)
   if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0)
   {
      FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
   }

   // Sample input texture
   vec3 color = texture(Source, curvedUV).rgb;

   // Apply scanlines
   float scanline = sin(curvedUV.y * params.scanlineCount * 3.14159 * 2.0) * 0.5 + 0.5;
   scanline = mix(1.0, scanline, params.scanlineIntensity);
   color *= scanline;

   // Apply vignette (darken corners)
   vec2 toCenter = curvedUV - 0.5;
   float dist = length(toCenter);
   float vignette = smoothstep(0.8, 0.3, dist);
   vignette = mix(1.0, vignette, params.vignetteIntensity);
   color *= vignette;

   // Apply brightness
   color *= params.brightness;

   // Clamp
   color = clamp(color, 0.0, 1.0);

   FragColor = vec4(color, 1.0);
}
