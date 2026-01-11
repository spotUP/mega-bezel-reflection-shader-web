#version 450

// Combined bezel and image layers shader
// This renders all the bezel, frame, and image layers
// Use LAYERS_UNDER_CRT mode (renders bezel under the CRT screen)
#define LAYERS_UNDER_CRT

/////////////// IMPORTS ///////////////
#include "common/globals-and-image-layers-params.inc"
#include "common/common-functions.inc"
#include "bezel-images.inc"
