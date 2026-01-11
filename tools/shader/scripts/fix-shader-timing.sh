#!/bin/bash

file="src/pages/Pong404WebGL.tsx"

# Revert to false initially
sed -i.bak15 's/const \[shadersEnabled, setShadersEnabled\] = useState(true);/const [shadersEnabled, setShadersEnabled] = useState(false);/' "$file"
sed -i.bak16 's/const \[useMegaBezel, setUseMegaBezel\] = useState(true);/const [useMegaBezel, setUseMegaBezel] = useState(false);/' "$file"

sed -i.bak17 's/const shadersEnabledRef = useRef<boolean>(true);/const shadersEnabledRef = useRef<boolean>(false);/' "$file"
sed -i.bak18 's/const useMegaBezelRef = useRef<boolean>(true);/const useMegaBezelRef = useRef<boolean>(false);/' "$file"

echo "✅ Reverted to disabled by default"
