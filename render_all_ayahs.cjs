const { execSync } = require('child_process');
const juz = process.env.JUZ;
try {
  execSync('npm run render:ayah-batch -- ' + juz, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status ?? 130);
}