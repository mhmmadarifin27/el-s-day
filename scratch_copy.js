const fs = require('fs');
const path = require('path');

const userProfile = process.env.USERPROFILE || process.env.HOME;
const sourcePath = path.join(userProfile, '.gemini', 'antigravity', 'brain', '0c7fa1ad-bbcd-4edd-bad9-95a6edffe566', 'media__1780124763436.jpg');
const destPath = path.join(__dirname, 'public', 'logo.jpg');

try {
  fs.copyFileSync(sourcePath, destPath);
  console.log('Logo copied successfully to public/logo.jpg');
} catch (err) {
  console.error('Failed to copy logo:', err);
}
