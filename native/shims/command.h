#ifndef MBZ_COMMAND_SHIM_H
#define MBZ_COMMAND_SHIM_H

enum event_command {
    CMD_EVENT_NONE = 0
};

static inline void command_event(enum event_command cmd, void *data) {
    (void)cmd;
    (void)data;
}

#endif
