#version 450

/*
   Stub Cache Pass for WebGL
   Provides sensible default values for the Mega Bezel cache system
   without requiring the full cache computation infrastructure
*/

#pragma name CacheInfoPass

// WebGL2 compatible UBO - matches the uniforms set by PureWebGL2Renderer
layout(std140, set = 0, binding = 0) uniform UBO
{
    mat4 MVP;
    vec4 SourceSize;
    vec4 OriginalSize;
    vec4 OutputSize;
    uint FrameCount;
} global;

// Parameters needed for cache - these become uniform floats in WebGL
#pragma parameter FinalViewportSizeX "Final Viewport Width" 800.0 100.0 4096.0 1.0
#pragma parameter FinalViewportSizeY "Final Viewport Height" 600.0 100.0 4096.0 1.0

// WebGL uniforms for parameters (set by renderer)
uniform float PARAM_FinalViewportSizeX;
uniform float PARAM_FinalViewportSizeY;

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

// Helper to get cache sample range
vec4 GetCacheSampleRange(float column_index, float row_index)
{
    float num_rows = 8.0;
    float num_columns = 8.0;
    float range_width = 1.0 / num_columns;
    float range_height = 1.0 / num_rows;
    float zero_based_row_index = row_index - 1.0;
    float zero_based_column_index = column_index - 1.0;
    vec4 out_sample_range = vec4(0);
    out_sample_range.x = zero_based_column_index * range_width;
    out_sample_range.y = zero_based_row_index * range_height;
    out_sample_range.z = out_sample_range.x + range_width;
    out_sample_range.w = out_sample_range.y + range_height;
    return out_sample_range;
}

bool IsCoordIn2DRange(vec2 in_coord, vec4 in_2d_range)
{
    return (in_coord.x > in_2d_range.x &&
            in_coord.y > in_2d_range.y &&
            in_coord.x < in_2d_range.z &&
            in_coord.y < in_2d_range.w);
}

void main()
{
    // Get viewport size from UBO (using global prefix for WebGL2 compatibility)
    // CRITICAL: Use max() to ensure we never have 0 values which cause NaN
    float viewport_width = max(PARAM_FinalViewportSizeX, global.OutputSize.x);
    if (viewport_width < 1.0) viewport_width = 800.0;  // Fallback

    float viewport_height = max(PARAM_FinalViewportSizeY, global.OutputSize.y);
    if (viewport_height < 1.0) viewport_height = 600.0;  // Fallback

    float output_aspect = viewport_width / viewport_height;

    // Source size (the game output) - from UBO
    // CRITICAL: Ensure source_size is never zero to prevent NaN in division
    vec2 source_size = global.SourceSize.xy;
    if (source_size.x < 1.0) source_size.x = 600.0;  // Default game width (square)
    if (source_size.y < 1.0) source_size.y = 600.0;  // Default game height (square)

    float source_aspect = source_size.x / source_size.y;

    // Default screen aspect - use source aspect or 1.0 for square
    // For this game, we want square (1:1)
    float screen_aspect = (source_aspect > 0.9 && source_aspect < 1.1) ? 1.0 : source_aspect;

    // Default screen scale (fit to viewport with some margin)
    float scale_y = 0.88;  // 88% of viewport height
    float scale_x = scale_y * screen_aspect / output_aspect;
    vec2 screen_scale = vec2(scale_x, scale_y);

    // Tube scale (slightly larger than screen)
    vec2 tube_scale = screen_scale * 1.02;

    // Position offset (centered)
    vec2 pos_offset = vec2(0.0, 0.0);

    // Cropped size
    vec2 cropped_size = source_size;

    // Size with res mult
    vec2 cropped_size_with_res_mult = cropped_size;

    // Screen size in pixels
    vec2 screen_size = vec2(viewport_width, viewport_height) * screen_scale;

    vec4 sample_2d_range;
    FragColor = vec4(0.0);

    // Sample 1, 1 - sampling direction mult and average luma
    sample_2d_range = GetCacheSampleRange(1.0, 1.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.r = 1.0;  // SAMPLING_SCANLINE_DIR_MULT
        FragColor.g = 1.0;  // SAMPLING_OPPOSITE_DIR_MULT
        FragColor.a = 0.5;  // AVERAGE_LUMA
    }

    // Sample 2, 1 - screen aspect and scale
    sample_2d_range = GetCacheSampleRange(2.0, 1.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.r = screen_aspect;  // SCREEN_ASPECT
        FragColor.ba = screen_scale;  // SCREEN_SCALE
    }

    // Sample 3, 1 - tube scale and position offset
    sample_2d_range = GetCacheSampleRange(3.0, 1.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = tube_scale;     // TUBE_SCALE
        FragColor.ba = pos_offset;     // SCREEN_POS_OFFSET
    }

    // Sample 4, 1 - cropped size with res mult and rotated core prepped size
    sample_2d_range = GetCacheSampleRange(4.0, 1.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = cropped_size_with_res_mult;  // CROPPED_ROTATED_SIZE_WITH_RES_MULT
        FragColor.ba = source_size;                  // ROTATED_CORE_PREPPED_SIZE
    }

    // Sample 1, 2 - cropped rotated size and sample area start
    sample_2d_range = GetCacheSampleRange(1.0, 2.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = cropped_size;   // CROPPED_ROTATED_SIZE
        FragColor.ba = vec2(0.0);      // SAMPLE_AREA_START_PIXEL_COORD
    }

    // Sample 2, 2 - 2nd screen aspect and scale (same as 1st for single screen)
    sample_2d_range = GetCacheSampleRange(2.0, 2.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.r = screen_aspect;
        FragColor.gb = screen_scale;
    }

    // Sample 3, 2 - 2nd screen tube scale and position
    sample_2d_range = GetCacheSampleRange(3.0, 2.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = tube_scale;
        FragColor.ba = pos_offset;
    }

    // Sample 4, 2 - 2nd screen cropped size with res mult
    sample_2d_range = GetCacheSampleRange(4.0, 2.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = cropped_size_with_res_mult;
    }

    // Sample 1, 3 - 2nd screen cropped size and sample start
    sample_2d_range = GetCacheSampleRange(1.0, 3.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = cropped_size;
        FragColor.ba = vec2(0.0);
    }

    // Sample 2, 3 - core size
    sample_2d_range = GetCacheSampleRange(2.0, 3.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = source_size;  // CORE_SIZE
        FragColor.ba = source_size;  // ROTATED_CORE_ORIGINAL_SIZE
    }

    // Sample 3, 3 - viewport scale and position
    sample_2d_range = GetCacheSampleRange(3.0, 3.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = vec2(1.0, 1.0);  // VIEWPORT_SCALE (zoom)
        FragColor.ba = vec2(0.0, 0.0);  // VIEWPORT_POSITION
    }

    // Sample 4, 3 - 2nd screen scale and position offset
    sample_2d_range = GetCacheSampleRange(4.0, 3.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = screen_scale;
        FragColor.ba = pos_offset;
    }

    // Sample 1, 4 - parameter sum and frame count
    sample_2d_range = GetCacheSampleRange(1.0, 4.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.r = 1000.0;              // parameter_sum (arbitrary)
        FragColor.g = float(global.FrameCount);  // frame count
        FragColor.ba = source_size;        // rotated_derezed_size
    }

    // Sample 2, 4 - negative crop expand multiplier
    sample_2d_range = GetCacheSampleRange(2.0, 4.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.r = 1.0;  // NEGATIVE_CROP_EXPAND_MULTIPLIER
        FragColor.g = 0.0;  // MAX_NEGATIVE_CROP
        FragColor.b = 0.0;  // use_vertical_scanlines (0 = horizontal)
    }

    // Sample 3, 4 - tube diffuse scale
    sample_2d_range = GetCacheSampleRange(3.0, 4.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = tube_scale;  // TUBE_DIFFUSE_SCALE 1st screen
        FragColor.ba = tube_scale;  // TUBE_DIFFUSE_SCALE 2nd screen
    }

    // Sample 4, 4 - screen size in pixels
    sample_2d_range = GetCacheSampleRange(4.0, 4.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.rg = screen_size;  // SCREEN_SIZE 1st screen
        FragColor.ba = screen_size;  // SCREEN_SIZE 2nd screen
    }

    // Sample 8, 8 - cache info changed flag
    sample_2d_range = GetCacheSampleRange(8.0, 8.0);
    if (IsCoordIn2DRange(vTexCoord, sample_2d_range))
    {
        FragColor.r = 0.0;  // CACHE_INFO_CHANGED = false
    }
}
