const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const bootstrapSource = path.join(projectRoot, 'node_modules', 'bootstrap', 'dist');
const bootstrapTarget = path.join(projectRoot, 'public', 'vendor', 'bootstrap');

if (!fs.existsSync(bootstrapSource)) {
  throw new Error('Bootstrap is not installed. Run npm install before building.');
}

fs.mkdirSync(path.dirname(bootstrapTarget), { recursive: true });
fs.rmSync(bootstrapTarget, { recursive: true, force: true });
fs.cpSync(bootstrapSource, bootstrapTarget, { recursive: true });

console.log('Prepared public Bootstrap assets.');
