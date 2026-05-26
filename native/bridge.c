#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
int mbz_init(void) {
    return 1;
}

EMSCRIPTEN_KEEPALIVE
int mbz_version(void) {
    return 1;
}
