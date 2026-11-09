import argparse, json, sys
from .search import optimize
from .oracle import verify
from .barriers import atlas
from .barrier_oracle import verify_atlas
from .weights import weights
from .weight_oracle import verify_weights


def main():
    p = argparse.ArgumentParser(description="Exact bounded arithmetic rewrite search")
    p.add_argument("command", choices=["optimize", "verify", "atlas", "verify-atlas", "weights", "verify-weights"])
    p.add_argument("file", nargs="?", default="-")
    a = p.parse_args()
    try:
        raw = json.load(sys.stdin if a.file == "-" else open(a.file, encoding="utf8"))
        if a.command in ["optimize", "atlas", "weights"]:
            json.dump(({"atlas":atlas,"weights":weights,"optimize":optimize}[a.command])(raw), sys.stdout, indent=2)
            print()
            return 0
        valid = ({"verify-atlas":verify_atlas,"verify-weights":verify_weights,"verify":verify}[a.command])(raw)
        print(json.dumps({"valid": valid}))
        return 0 if valid else 1
    except (ValueError, TypeError) as e:
        print(str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
