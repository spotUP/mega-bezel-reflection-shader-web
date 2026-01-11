/*
    Mega Bezel - Tube Layer Functions
    For use with TubeFxPass and deconvergence shaders

    This file should be included AFTER common-functions.inc and common-functions-bezel.inc
*/

// ============================================================================
// HSM_ApplyPackedTubeLayers - Unpacks tube layers and composites with CRT color
// ============================================================================
vec4 HSM_ApplyPackedTubeLayers(vec4 crt_color, vec4 image_layers_packed)
{
	vec4 unpacked_precomp_tube_diffuse = vec4(0);
	vec4 unpacked_precomp_gel = vec4(0);
	vec4 unpacked_precomp_tube_highlight = vec4(0);
	vec4 unpacked_precomp_lighting_mask = vec4(0);

	HSM_Unpack_1_Rgba_To_4_Rgba(image_layers_packed,
								unpacked_precomp_tube_diffuse,
								unpacked_precomp_gel,
								unpacked_precomp_tube_highlight,
								unpacked_precomp_lighting_mask);

	unpacked_precomp_tube_diffuse = HSM_Linearize(unpacked_precomp_tube_diffuse, DEFAULT_SRGB_GAMMA);
	unpacked_precomp_gel = HSM_Linearize(unpacked_precomp_gel, DEFAULT_SRGB_GAMMA);
	unpacked_precomp_tube_highlight = HSM_Linearize(unpacked_precomp_tube_highlight, DEFAULT_SRGB_GAMMA);

	float unpacked_vignette = unpacked_precomp_tube_highlight.a - 0.25;

	unpacked_precomp_lighting_mask = HSM_Linearize(unpacked_precomp_lighting_mask, DEFAULT_SRGB_GAMMA);
	float unpacked_crt_mask = unpacked_precomp_lighting_mask.b;
	float unpacked_shadow = unpacked_precomp_lighting_mask.a;

	vec4 out_color = unpacked_precomp_tube_diffuse;

	if (HSM_MONOCHROME_MODE > 0.5 && HSM_GetUseOnCurrentScreenIndex(HSM_MONOCHROME_DUALSCREEN_VIS_MODE))
		crt_color = HSM_ApplyMonochrome(crt_color);

	crt_color *= HSM_POST_CRT_BRIGHTNESS;
	crt_color.rgb *= unpacked_crt_mask;

	if (HSM_GetUseScreenVignette())
		crt_color.rgb *= unpacked_vignette;

	if (HSM_GetUseTubeColoredGel())
	{
		crt_color.rgb *= HSM_TUBE_COLORED_GEL_CRT_BRIGHTNESS;
		if (HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT > 0)
			crt_color.rgb = mix(crt_color.rgb, crt_color.rgb * clamp(HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_BRIGHTNESS * unpacked_precomp_gel.rgb, 0, 1), HSM_TUBE_COLORED_GEL_IMAGE_MULTIPLY_AMOUNT);

		if ( HSM_TUBE_COLORED_GEL_LAYERING_ORDER == 1 )
		{
			unpacked_precomp_gel.rgb *= unpacked_shadow;
			out_color = HSM_BlendModeLayerMix(out_color, unpacked_precomp_gel, BLEND_MODE_NORMAL, HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT);
		}
	}

	if (HSM_CRT_BLEND_MODE == 1)
		out_color = HSM_BlendModeLayerMix(out_color, crt_color, BLEND_MODE_ADD, HSM_CRT_BLEND_AMOUNT);
	else if (HSM_CRT_BLEND_MODE == 2)
	{
		out_color = clamp(out_color, 0, 1);
		out_color = HSM_BlendModeLayerMix(out_color, crt_color, BLEND_MODE_MULTIPLY, HSM_CRT_BLEND_AMOUNT);
	}
	else if (HSM_CRT_BLEND_MODE == 3)
	{
		out_color = clamp(out_color, 0, 1);
		out_color = HSM_BlendModeLayerMix(out_color, crt_color, BLEND_MODE_NORMAL, HSM_CRT_BLEND_AMOUNT);
	}

	if (HSM_GetUseTubeColoredGel())
	{
		unpacked_precomp_gel.rgb *= unpacked_shadow;
		if ( HSM_TUBE_COLORED_GEL_LAYERING_ORDER == 0 )
			out_color = HSM_BlendModeLayerMix(out_color, unpacked_precomp_gel, BLEND_MODE_NORMAL, HSM_TUBE_COLORED_GEL_IMAGE_NORMAL_AMOUNT);
	}

	out_color.rgb += unpacked_precomp_tube_highlight.rgb;

	return out_color;
}
