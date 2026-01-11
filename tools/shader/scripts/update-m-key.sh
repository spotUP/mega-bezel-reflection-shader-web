#!/bin/bash

file="src/pages/Pong404WebGL.tsx"

# Find and replace the M key handler to update refs
sed -i.bak3 's/setUseMegaBezel(true);/setUseMegaBezel(true); useMegaBezelRef.current = true;/g' "$file"
sed -i.bak4 's/setShadersEnabled(true);/setShadersEnabled(true); shadersEnabledRef.current = true;/g' "$file"

echo "✅ Updated M key handler to sync refs"
