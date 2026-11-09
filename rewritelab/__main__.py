import argparse, json, sys
from .search import optimize
from .oracle import verify
from .barriers import atlas
from .barrier_oracle import verify_atlas


def main():
    p = argparse.ArgumentParser(description="Exact bounded arithmetic rewrite search")
    p.add_argument("command", choices=["optimize", "verify", "atlas", "verify-atlas"])
    p.add_argument("file", nargs="?", default="-")
    a = p.parse_args()
    try:
        raw = json.load(sys.stdin if a.file == "-" else open(a.file, encoding="utf8"))
        if a.command in ["optimize", "atlas"]:
            json.dump((atlas if a.command == "atlas" else optimize)(raw), sys.stdout, indent=2)
            print()
            return 0
        valid = (verify_atlas if a.command == "verify-atlas" else verify)(raw)
        print(json.dumps({"valid": valid}))
        return 0 if valid else 1
    except (ValueError, TypeError) as e:
        print(str(e), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
