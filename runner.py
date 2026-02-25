import os
import subprocess
juz = 30
os.environ["JUZ"] = str(juz)

script = """
const { execSync } = require('child_process');
const juz = process.env.JUZ;
try {
  execSync('npm run render:ayah-batch -- ' + juz, { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status ?? 130);
}
"""

with open("render_all_ayahs.cjs", "w") as f:
    f.write(script.strip())

try:
    subprocess.run(["node", "render_all_ayahs.cjs"], check=True)
except KeyboardInterrupt:
    print("\nInterrupted. Re-run to skip completed ayahs.")
    raise SystemExit(130)