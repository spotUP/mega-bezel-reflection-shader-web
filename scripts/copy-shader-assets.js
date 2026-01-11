const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../assets/shaders');
const dest = path.resolve(process.cwd(), 'public/shaders');

function copyDir(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(src)) {
  console.error('Shader assets not found at:', src);
  process.exit(1);
}

copyDir(src, dest);
console.log('Copied shader assets to:', dest);
