#ifndef MBZ_VERBOSITY_SHIM_H
#define MBZ_VERBOSITY_SHIM_H

#include <stdio.h>

#define RARCH_LOG(...) do { printf("[MBZ LOG] "); printf(__VA_ARGS__); } while(0)
#define RARCH_WARN(...) do { printf("[MBZ WARN] "); printf(__VA_ARGS__); } while(0)
#define RARCH_ERR(...) do { fprintf(stderr, "[MBZ ERR] "); fprintf(stderr, __VA_ARGS__); } while(0)
#define RARCH_DBG(...) do { } while(0)

#define RARCH_LOG_OUTPUT(...) RARCH_LOG(__VA_ARGS__)

#endif
