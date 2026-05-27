#include <GLES3/gl3.h>
#include <cstdlib>
#include <cstdio>

struct Size2D { unsigned width, height; };

extern "C" {

void gl3_framebuffer_copy(
      GLuint fb_id,
      GLuint quad_program,
      GLuint quad_vbo,
      GLint flat_ubo_vertex,
      struct Size2D size,
      GLuint image)
{
   glBindFramebuffer(GL_FRAMEBUFFER, fb_id);
   glActiveTexture(GL_TEXTURE2);
   glBindTexture(GL_TEXTURE_2D, image);
   glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
   glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
   glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
   glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
   glViewport(0, 0, size.width, size.height);
   glClear(GL_COLOR_BUFFER_BIT);

   glUseProgram(quad_program);
   if (flat_ubo_vertex >= 0) {
      static float mvp[16] = {
          2.0f, 0.0f, 0.0f, 0.0f,
          0.0f, 2.0f, 0.0f, 0.0f,
          0.0f, 0.0f, 2.0f, 0.0f,
         -1.0f,-1.0f, 0.0f, 1.0f
      };
      glUniform4fv(flat_ubo_vertex, 4, mvp);
   }

   glDisable(GL_CULL_FACE);
   glDisable(GL_BLEND);
   glDisable(GL_DEPTH_TEST);
   glEnableVertexAttribArray(0);
   glEnableVertexAttribArray(1);
   glBindBuffer(GL_ARRAY_BUFFER, quad_vbo);
   glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float),
                         (void *)((uintptr_t)(0)));
   glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float),
                         (void *)((uintptr_t)(2 * sizeof(float))));
   glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
   glBindBuffer(GL_ARRAY_BUFFER, 0);
   glDisableVertexAttribArray(0);
   glDisableVertexAttribArray(1);

   glUseProgram(0);
   glBindTexture(GL_TEXTURE_2D, 0);
   glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

void gl3_framebuffer_copy_partial(
      GLuint fb_id,
      GLuint quad_program,
      GLint flat_ubo_vertex,
      struct Size2D size,
      GLuint image,
      float rx, float ry)
{
   GLuint vbo;
   const float quad_data[16] = {
      0.0f, 0.0f, 0.0f, 0.0f,
      1.0f, 0.0f, rx,   0.0f,
      0.0f, 1.0f, 0.0f, ry,
      1.0f, 1.0f, rx,   ry,
   };

   glBindFramebuffer(GL_FRAMEBUFFER, fb_id);
   glActiveTexture(GL_TEXTURE2);
   glBindTexture(GL_TEXTURE_2D, image);
   glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
   glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
   glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
   glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
   glViewport(0, 0, size.width, size.height);
   glClear(GL_COLOR_BUFFER_BIT);

   glUseProgram(quad_program);
   if (flat_ubo_vertex >= 0) {
      static float mvp[16] = {
          2.0f, 0.0f, 0.0f, 0.0f,
          0.0f, 2.0f, 0.0f, 0.0f,
          0.0f, 0.0f, 2.0f, 0.0f,
         -1.0f,-1.0f, 0.0f, 1.0f
      };
      glUniform4fv(flat_ubo_vertex, 4, mvp);
   }
   glDisable(GL_CULL_FACE);
   glDisable(GL_BLEND);
   glDisable(GL_DEPTH_TEST);
   glEnableVertexAttribArray(0);
   glEnableVertexAttribArray(1);

   glGenBuffers(1, &vbo);
   glBindBuffer(GL_ARRAY_BUFFER, vbo);
   glBufferData(GL_ARRAY_BUFFER, sizeof(quad_data), quad_data, GL_STREAM_DRAW);
   glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float),
                         (void *)((uintptr_t)(0)));
   glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float),
                         (void *)((uintptr_t)(2 * sizeof(float))));
   glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
   glBindBuffer(GL_ARRAY_BUFFER, 0);
   glDeleteBuffers(1, &vbo);
   glDisableVertexAttribArray(0);
   glDisableVertexAttribArray(1);
   glUseProgram(0);
   glBindTexture(GL_TEXTURE_2D, 0);
   glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

GLuint gl3_compile_shader(GLenum stage, const char *source)
{
   GLint status;
   GLuint shader   = glCreateShader(stage);
   const char *ptr = source;

   glShaderSource(shader, 1, &ptr, NULL);
   glCompileShader(shader);
   glGetShaderiv(shader, GL_COMPILE_STATUS, &status);

   if (!status) {
      GLint length;
      glGetShaderiv(shader, GL_INFO_LOG_LENGTH, &length);
      if (length > 0) {
         char *info_log = (char*)malloc(length);
         if (info_log) {
            glGetShaderInfoLog(shader, length, &length, info_log);
            fprintf(stderr, "[MBZ] Failed to compile shader: %s\n", info_log);
            free(info_log);
            glDeleteShader(shader);
            return 0;
         }
      }
      glDeleteShader(shader);
      return 0;
   }

   return shader;
}

uint32_t gl3_get_cross_compiler_target_version(void)
{
   return 300;
}

}
