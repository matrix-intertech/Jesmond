const fs = require('fs');
const path = require('path');

function replaceLocalhost(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        replaceLocalhost(fullPath);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Fix string literals 'http://localhost:3001/api/v1/...'
      // Example: fetch('http://localhost:3001/api/v1/applications/my' -> fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/applications/my`
      content = content.replace(/'http:\/\/localhost:3001(\/api\/v1[^']*)'/g, '`${process.env.NEXT_PUBLIC_API_URL || \'http://localhost:3001\'}$1`');
      content = content.replace(/"http:\/\/localhost:3001(\/api\/v1[^"]*)"/g, '`${process.env.NEXT_PUBLIC_API_URL || \'http://localhost:3001\'}$1`');
      
      // Fix template literals `http://localhost:3001/api/v1/${id}`
      // Example: fetch(`http://localhost:3001/api/v1/properties/my/${id}` -> fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/properties/my/${id}`
      content = content.replace(/`http:\/\/localhost:3001(\/api\/v1[^`]*)`/g, '`${process.env.NEXT_PUBLIC_API_URL || \'http://localhost:3001\'}$1`');
      
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

replaceLocalhost(path.join(__dirname, 'apps/web'));
console.log('Replaced localhost references.');
