#!/bin/bash

file="src/pages/Pong404WebGL.tsx"

# Replace shadersEnabled with shadersEnabledRef.current in render function
sed -i.bak5 's/console.log(`\[INIT\] Creating renderer - shadersEnabled: ${shadersEnabled}, useMegaBezel: ${useMegaBezel}`);/console.log(`[INIT] Creating renderer - shadersEnabled: ${shadersEnabledRef.current}, useMegaBezel: ${useMegaBezelRef.current}`);/g' "$file"

sed -i.bak6 's/if (shadersEnabled && !webglWithShadersRef.current) {/if (shadersEnabledRef.current \&\& !webglWithShadersRef.current) {/g' "$file"

sed -i.bak7 's/const presetPath = useMegaBezel/const presetPath = useMegaBezelRef.current/g' "$file"

sed -i.bak8 's/} else if (!shadersEnabled) {/} else if (!shadersEnabledRef.current) {/g' "$file"

sed -i.bak9 's/console.log(`✅ WebGL2DWithShaders initialized (${useMegaBezel/console.log(`✅ WebGL2DWithShaders initialized (${useMegaBezelRef.current/g' "$file"

sed -i.bak10 's/if (webglWithShadersRef.current && shadersEnabled) {/if (webglWithShadersRef.current \&\& shadersEnabledRef.current) {/g' "$file"

echo "✅ Updated render function to use refs"
