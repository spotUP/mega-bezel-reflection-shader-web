#!/bin/bash

file="src/pages/Pong404WebGL.tsx"

# Change initial state to true
sed -i.bak11 's/const \[shadersEnabled, setShadersEnabled\] = useState(false);/const [shadersEnabled, setShadersEnabled] = useState(true);/' "$file"
sed -i.bak12 's/const \[useMegaBezel, setUseMegaBezel\] = useState(false);/const [useMegaBezel, setUseMegaBezel] = useState(true);/' "$file"

# Update refs initial values
sed -i.bak13 's/const shadersEnabledRef = useRef<boolean>(false);/const shadersEnabledRef = useRef<boolean>(true);/' "$file"
sed -i.bak14 's/const useMegaBezelRef = useRef<boolean>(false);/const useMegaBezelRef = useRef<boolean>(true);/' "$file"

echo "✅ Shaders now enabled by default"
