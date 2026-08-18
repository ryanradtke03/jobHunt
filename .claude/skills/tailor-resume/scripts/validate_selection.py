#!/usr/bin/env python3
"""
Validates a proposed resume bullet selection against the source pool.

Usage: python3 validate_selection.py pool.json selection.json

Checks, per selected bullet:
  1. Its bulletId exists somewhere in the pool.
  2. Every digit sequence in its finalText already appears in that bullet's
     original text (no invented or altered numbers).

Prints each violation and exits 1 if any are found; prints a summary and
exits 0 if the selection is clean. Never build the resume from a selection
this script flagged.
"""

import json
import re
import sys

DIGIT_RE = re.compile(r"\d+")


def digits_of(text: str) -> set[str]:
    return set(DIGIT_RE.findall(text))


def index_pool(pool: dict) -> dict[str, dict]:
    index: dict[str, dict] = {}
    for entry in pool.get("entries", []):
        for bullet in entry.get("bullets", []):
            index[bullet["id"]] = {
                "entryId": entry["id"],
                "text": bullet["text"],
                "digits": digits_of(bullet["text"]),
            }
    return index


def validate(pool: dict, selection: dict) -> list[str]:
    index = index_pool(pool)
    errors: list[str] = []

    selections = selection.get("selections")
    if not isinstance(selections, list):
        return ['Selection JSON is missing a "selections" array.']

    for item in selections:
        bullet_id = item.get("bulletId")
        final_text = item.get("finalText")
        if not isinstance(bullet_id, str) or not isinstance(final_text, str):
            errors.append(f"Malformed selection entry: {json.dumps(item)}")
            continue

        original = index.get(bullet_id)
        if original is None:
            errors.append(f'bulletId "{bullet_id}" does not exist in the pool.')
            continue

        bad_digits = digits_of(final_text) - original["digits"]
        if bad_digits:
            errors.append(
                f'bulletId "{bullet_id}": finalText introduces number(s) '
                f'{sorted(bad_digits)} not present in the original bullet text '
                f'("{original["text"]}").'
            )

    return errors


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python3 validate_selection.py pool.json selection.json", file=sys.stderr)
        return 2

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        pool = json.load(f)
    with open(sys.argv[2], "r", encoding="utf-8") as f:
        selection = json.load(f)

    errors = validate(pool, selection)

    if errors:
        print(f"FAILED — {len(errors)} violation(s):\n")
        for e in errors:
            print(f"  - {e}")
        return 1

    count = len(selection.get("selections", []))
    print(f"OK — {count} selected bullet(s), all valid (known id, no invented/altered numbers).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
