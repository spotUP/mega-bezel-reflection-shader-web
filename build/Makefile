CC = emcc
CXX = em++

NATIVE_DIR = ../native
DEPS_DIR = $(NATIVE_DIR)/deps/libretro-common
OUT_DIR = ../dist/wasm

INCLUDES = \
	-I$(DEPS_DIR)/include \
	-I$(NATIVE_DIR)/shims \
	-I$(NATIVE_DIR)/gfx

CFLAGS = -O2 -s WASM=1 \
	-s EXPORTED_RUNTIME_METHODS='["cwrap","ccall","UTF8ToString","FS"]' \
	-s ALLOW_MEMORY_GROWTH=1 \
	-s MODULARIZE=1 \
	-s EXPORT_NAME=MegaBezelModule \
	-s FORCE_FILESYSTEM=1 \
	-DRARCH_INTERNAL \
	-DHAVE_CONFIGFILE \
	-DMBZ_STANDALONE \
	$(INCLUDES)

SOURCES = \
	$(NATIVE_DIR)/bridge.c \
	$(NATIVE_DIR)/shims/configuration.c \
	$(NATIVE_DIR)/gfx/video_shader_parse.c \
	$(DEPS_DIR)/file/config_file.c \
	$(DEPS_DIR)/file/config_file_userdata.c \
	$(DEPS_DIR)/file/file_path.c \
	$(DEPS_DIR)/file/file_path_io.c \
	$(DEPS_DIR)/string/stdstring.c \
	$(DEPS_DIR)/lists/string_list.c \
	$(DEPS_DIR)/lists/dir_list.c \
	$(DEPS_DIR)/compat/compat_strl.c \
	$(DEPS_DIR)/compat/compat_posix_string.c \
	$(DEPS_DIR)/compat/compat_strcasestr.c \
	$(DEPS_DIR)/compat/fopen_utf8.c \
	$(DEPS_DIR)/streams/file_stream.c \
	$(DEPS_DIR)/streams/file_stream_transforms.c \
	$(DEPS_DIR)/encodings/encoding_utf.c \
	$(DEPS_DIR)/vfs/vfs_implementation.c

TARGET = $(OUT_DIR)/mega-bezel.js

.PHONY: all clean dirs

all: dirs $(TARGET)

dirs:
	@mkdir -p $(OUT_DIR)

$(TARGET): $(SOURCES)
	$(CC) $(CFLAGS) -o $@ $^

clean:
	rm -rf $(OUT_DIR)
