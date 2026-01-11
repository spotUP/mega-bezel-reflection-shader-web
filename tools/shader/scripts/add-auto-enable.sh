#!/bin/bash

file="src/pages/Pong404WebGL.tsx"

# Find the line with the first useEffect and add our new useEffect before it
# Insert after the useState declarations (around line 952)
sed -i.bak19 '/const \[useMegaBezel, setUseMegaBezel\]/a\
\
  // Auto-enable shaders when game is connected\
  useEffect(() => {\
    if (connectionStatus === '\''connected'\'' && !shadersEnabled && !useMegaBezel) {\
      console.log('\''[AUTO] Enabling Mega Bezel shaders on game start'\'');\
      setUseMegaBezel(true);\
      useMegaBezelRef.current = true;\
      setShadersEnabled(true);\
      shadersEnabledRef.current = true;\
      webglCtxRef.current = null;\
      webglWithShadersRef.current = null;\
    }\
  }, [connectionStatus, shadersEnabled, useMegaBezel]);
' "$file"

echo "✅ Added auto-enable shader effect"
