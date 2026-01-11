#!/bin/bash

file="src/pages/Pong404WebGL.tsx"

# Add refs after megaBezelEnablingRef
sed -i.bak2 '/const megaBezelEnablingRef = useRef<boolean>(false);/a\
  const shadersEnabledRef = useRef<boolean>(false); // Track shadersEnabled state\
  const useMegaBezelRef = useRef<boolean>(false); // Track useMegaBezel state
' "$file"

echo "✅ Added shadersEnabledRef and useMegaBezelRef"
