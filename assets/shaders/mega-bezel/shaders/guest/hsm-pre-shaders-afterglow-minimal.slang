#version 450

// Minimal version of hsm-pre-shaders-afterglow to test what's breaking

layout(std140, set = 0, binding = 0) uniform UBO
{
   mat4 MVP;
} global;

#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main()
{
   gl_Position = global.MVP * Position;
   vTexCoord = TexCoord;
}

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;
layout(set = 0, binding = 2) uniform sampler2D PreCRTPass;
layout(set = 0, binding = 3) uniform sampler2D AfterglowPass;

#define COMPAT_TEXTURE(c,d) texture(c,d)

// Uniforms that the original shader uses
uniform float AS;
uniform float sat;
uniform float BP;
uniform float PARAM_pre_bb;

void main()
{
   // ULTRA SIMPLE TEST: Just output PreCRTPass directly
   vec4 imgColor = COMPAT_TEXTURE(PreCRTPass, vTexCoord.xy);
   FragColor = imgColor;
}
