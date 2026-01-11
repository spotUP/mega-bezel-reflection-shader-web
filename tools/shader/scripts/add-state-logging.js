const fs = require('fs');
const file = 'src/pages/Pong404WebGL.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add logging after setState declarations
content = content.replace(
  'const [shadersEnabled, setShadersEnabled] = useState(false);',
  `const [shadersEnabled, setShadersEnabled] = useState(false);
  console.log('[STATE] shadersEnabled initial value:', false);`
);

content = content.replace(
  'const [useMegaBezel, setUseMegaBezel] = useState(false);',
  `const [useMegaBezel, setUseMegaBezel] = useState(false);
  console.log('[STATE] useMegaBezel initial value:', false);`
);

fs.writeFileSync(file, content);
console.log('Added state logging');
