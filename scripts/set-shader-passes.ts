#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';

const configPath = path.join(process.cwd(), 'public/shaders/mega-bezel/crt-guest-no-fxaa.slangp');

const passCount = parseInt(process.argv[2], 10);

if (isNaN(passCount) || passCount < 1 || passCount > 17) {
  console.error('❌ Error: Pass count must be between 1 and 17');
  console.log('Usage: npx tsx scripts/set-shader-passes.ts <pass_count>');
  console.log('Example: npx tsx scripts/set-shader-passes.ts 10');
  process.exit(1);
}

try {
  // Read current config
  const content = fs.readFileSync(configPath, 'utf-8');

  // Replace shaders = X line
  const updatedContent = content.replace(/^shaders = \d+/m, `shaders = ${passCount}`);

  // Write back
  fs.writeFileSync(configPath, updatedContent, 'utf-8');

  console.log(`✅ Updated shader pass count to ${passCount}`);
  console.log(`📂 File: ${configPath}`);
  console.log(`🔄 Reload the page to see changes`);
  console.log(``);
  console.log(`Shader passes:`);
  const lines = updatedContent.split('\n');
  for (let i = 0; i < passCount; i++) {
    const shaderLine = lines.find(l => l.startsWith(`shader${i} =`));
    if (shaderLine) {
      const shaderPath = shaderLine.split('=')[1].trim();
      console.log(`  ${i}: ${shaderPath}`);
    }
  }

} catch (error) {
  console.error('❌ Error updating shader config:', error);
  process.exit(1);
}
