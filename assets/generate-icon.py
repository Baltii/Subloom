"""Compatibility entry point: all logo/icon exports use the canonical brand master."""
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
subprocess.run(["node", str(root / "scripts/build-brand.mjs")], cwd=root, check=True)
