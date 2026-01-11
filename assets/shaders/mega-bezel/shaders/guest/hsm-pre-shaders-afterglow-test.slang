#version 450

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

void main()
{
   // SIMPLE TEST: Just output PreCRTPass unchanged
   vec4 imgColor = COMPAT_TEXTURE(PreCRTPass, vTexCoord.xy);
   FragColor = vec4(imgColor.rgb, 1.0);
}
