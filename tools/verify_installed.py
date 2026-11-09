"""Check an installed wheel outside its source checkout."""

import json, subprocess, sys, tempfile
from pathlib import Path

controls = json.loads(Path(sys.argv[1]).read_text())
with tempfile.TemporaryDirectory() as tmp:
    for c in controls:
        request = Path(tmp) / "request.json"
        report = Path(tmp) / "report.json"
        request.write_text(json.dumps(c["input"]))
        module = subprocess.check_output(
            [sys.executable, "-m", "rewritelab", "optimize", str(request)], cwd=tmp
        )
        console = subprocess.check_output(
            [str(Path(sys.executable).parent / "rewritelab"), "optimize", str(request)],
            cwd=tmp,
        )
        assert json.loads(module) == json.loads(console)
        report.write_bytes(module)
        for cmd in [
            [sys.executable, "-m", "rewritelab"],
            [str(Path(sys.executable).parent / "rewritelab")],
        ]:
            assert json.loads(
                subprocess.check_output(cmd + ["verify", str(report)], cwd=tmp)
            ) == {"valid": True}
        broken = json.loads(module)
        broken["best_semantic"]["cost"] += 1
        report.write_text(json.dumps(broken))
        p = subprocess.run(
            [sys.executable, "-m", "rewritelab", "verify", str(report)],
            cwd=tmp,
            capture_output=True,
        )
        assert p.returncode == 1 and json.loads(p.stdout) == {"valid": False}
print(
    f"Installed module and console: {len(controls)} complete controls independently verified; forged reports rejected"
)
