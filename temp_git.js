const { execSync } = require('child_process');
try {
  execSync('git checkout -b dev', { stdio: 'inherit' });
  console.log('Checked out dev');
} catch (e) {
  console.error(e.message);
}
