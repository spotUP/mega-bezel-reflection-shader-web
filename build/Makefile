CC = emcc
CXX = em++

NATIVE_DIR = ../native
LRC_DIR = $(NATIVE_DIR)/deps/libretro-common
GLSLANG_DIR = $(NATIVE_DIR)/deps/glslang/glslang
SPIRV_CROSS_DIR = $(NATIVE_DIR)/deps/SPIRV-Cross
OUT_DIR = ../dist/wasm

INCLUDES = \
	-I$(LRC_DIR)/include \
	-I$(NATIVE_DIR)/shims \
	-I$(NATIVE_DIR)/gfx \
	-I$(NATIVE_DIR)/gfx/drivers_shader \
	-I$(GLSLANG_DIR)/glslang/OSDependent/Unix \
	-I$(GLSLANG_DIR)/OGLCompilersDLL \
	-I$(GLSLANG_DIR)/glslang/MachineIndependent \
	-I$(GLSLANG_DIR)/glslang/Public \
	-I$(GLSLANG_DIR)/SPIRV \
	-I$(GLSLANG_DIR)/glslang \
	-I$(GLSLANG_DIR) \
	-I$(SPIRV_CROSS_DIR)

COMMON_FLAGS = -O2 \
	-DRARCH_INTERNAL \
	-DHAVE_CONFIGFILE \
	-DMBZ_STANDALONE \
	-DHAVE_SLANG \
	-DHAVE_SPIRV_CROSS \
	-DHAVE_BUILTINGLSLANG \
	-DHAVE_GLSLANG \
	$(INCLUDES)

CFLAGS = $(COMMON_FLAGS)
CXXFLAGS = $(COMMON_FLAGS) -std=c++14 -fno-exceptions -DSPIRV_CROSS_EXCEPTIONS_TO_ASSERTIONS

LDFLAGS = -s WASM=1 \
	-s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","UTF8ToString","FS"]' \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MODULARIZE=1 \
	-s EXPORT_NAME=MegaBezelModule \
	-s FORCE_FILESYSTEM=1

# C sources (preset parser + libretro-common)
C_SOURCES = \
	$(NATIVE_DIR)/bridge.c \
	$(NATIVE_DIR)/shims/configuration.c \
	$(NATIVE_DIR)/gfx/video_shader_parse.c \
	$(NATIVE_DIR)/gfx/drivers_shader/glslang_util.c \
	$(LRC_DIR)/file/config_file.c \
	$(LRC_DIR)/file/config_file_userdata.c \
	$(LRC_DIR)/file/file_path.c \
	$(LRC_DIR)/file/file_path_io.c \
	$(LRC_DIR)/string/stdstring.c \
	$(LRC_DIR)/lists/string_list.c \
	$(LRC_DIR)/lists/dir_list.c \
	$(LRC_DIR)/compat/compat_strl.c \
	$(LRC_DIR)/compat/compat_posix_string.c \
	$(LRC_DIR)/compat/compat_strcasestr.c \
	$(LRC_DIR)/compat/fopen_utf8.c \
	$(LRC_DIR)/streams/file_stream.c \
	$(LRC_DIR)/streams/file_stream_transforms.c \
	$(LRC_DIR)/encodings/encoding_utf.c \
	$(LRC_DIR)/vfs/vfs_implementation.c

# C++ sources (shader compiler)
CXX_SOURCES = \
	$(NATIVE_DIR)/bridge_compiler.cpp \
	$(NATIVE_DIR)/gfx/drivers_shader/glslang.cpp \
	$(NATIVE_DIR)/gfx/drivers_shader/glslang_util_cxx.cpp \
	$(NATIVE_DIR)/gfx/drivers_shader/slang_process.cpp \
	$(NATIVE_DIR)/gfx/drivers_shader/slang_reflection.cpp \
	$(GLSLANG_DIR)/SPIRV/GlslangToSpv.cpp \
	$(GLSLANG_DIR)/SPIRV/InReadableOrder.cpp \
	$(GLSLANG_DIR)/SPIRV/Logger.cpp \
	$(GLSLANG_DIR)/SPIRV/SpvBuilder.cpp \
	$(wildcard $(GLSLANG_DIR)/glslang/GenericCodeGen/*.cpp) \
	$(wildcard $(GLSLANG_DIR)/OGLCompilersDLL/*.cpp) \
	$(wildcard $(GLSLANG_DIR)/glslang/MachineIndependent/*.cpp) \
	$(wildcard $(GLSLANG_DIR)/glslang/MachineIndependent/preprocessor/*.cpp) \
	$(GLSLANG_DIR)/glslang/OSDependent/Unix/ossource.cpp \
	$(SPIRV_CROSS_DIR)/spirv_cross.cpp \
	$(SPIRV_CROSS_DIR)/spirv_cfg.cpp \
	$(SPIRV_CROSS_DIR)/spirv_glsl.cpp \
	$(SPIRV_CROSS_DIR)/spirv_hlsl.cpp \
	$(SPIRV_CROSS_DIR)/spirv_msl.cpp \
	$(SPIRV_CROSS_DIR)/spirv_parser.cpp \
	$(SPIRV_CROSS_DIR)/spirv_cross_parsed_ir.cpp

C_OBJS = $(C_SOURCES:.c=.o)
CXX_OBJS = $(CXX_SOURCES:.cpp=.o)
OBJS = $(C_OBJS) $(CXX_OBJS)

TARGET = $(OUT_DIR)/mega-bezel.js

.PHONY: all clean dirs

all: dirs $(TARGET)

dirs:
	@mkdir -p $(OUT_DIR)

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c -o $@ $<

$(TARGET): $(OBJS)
	$(CXX) $(LDFLAGS) -o $@ $^

clean:
	rm -rf $(OUT_DIR)
	find $(NATIVE_DIR) -name '*.o' -delete
