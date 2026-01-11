#version 450

/*
   Simple Scanline Shader
   Demonstrates basic Slang shader structure
*/

#pragma parameter scanlineIntensity "Scanline Intensity" 0.25 0.0 1.0 0.05
#pragma parameter scanlineCount "Scanline Count" 800.0 200.0 1200.0 100.0

// ========== VERTEX SHADER ==========

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

layout(set = 0, binding = 0) uniform UBO
{
   mat4 MVP;
   vec4 OutputSize;
   vec4 SourceSize;
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
} params;

void main()
{
   // Sample input texture
   vec3 color = texture(Source, vTexCoord).rgb;

   // Apply scanlines
   float scanline = sin(vTexCoord.y * params.scanlineCount * 3.14159 * 2.0) * 0.5 + 0.5;
   scanline = mix(1.0, scanline, params.scanlineIntensity);

   color *= scanline;

   FragColor = vec4(color, 1.0);
}
