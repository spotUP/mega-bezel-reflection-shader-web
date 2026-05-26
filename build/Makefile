CC = emcc
CFLAGS = -O2 -s WASM=1 -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_NAME=MegaBezelModule

NATIVE_DIR = ../native
OUT_DIR = ../dist/wasm

SOURCES = $(NATIVE_DIR)/bridge.c

TARGET = $(OUT_DIR)/mega-bezel.js

.PHONY: all clean dirs

all: dirs $(TARGET)

dirs:
	@mkdir -p $(OUT_DIR)

$(TARGET): $(SOURCES)
	$(CC) $(CFLAGS) -o $@ $^

clean:
	rm -rf $(OUT_DIR)
