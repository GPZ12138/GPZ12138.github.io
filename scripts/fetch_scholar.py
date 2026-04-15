#!/usr/bin/env python3
"""Fetch live Google Scholar stats for Peizhong Gao and write data/scholar.json.

Runs periodically in GitHub Actions (.github/workflows/update-scholar.yml).
Uses the `scholarly` library; gracefully falls back to the previous snapshot
on network failure / Scholar rate limits so the front-end is never broken.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys
from pathlib import Path

SCHOLAR_ID = os.environ.get("SCHOLAR_ID", "Jwg8XugAAAAJ")
OUT_PATH = Path(__file__).resolve().parents[1] / "data" / "scholar.json"


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_existing() -> dict:
    if OUT_PATH.exists():
        try:
            return json.loads(OUT_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {}


def coerce_int(value, default=0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def fetch_scholar(scholar_id: str) -> dict:
    from scholarly import scholarly, ProxyGenerator  # type: ignore

    # Use free proxies when available — Scholar aggressively blocks datacenter IPs.
    try:
        pg = ProxyGenerator()
        if pg.FreeProxies():
            scholarly.use_proxy(pg)
    except Exception as exc:  # noqa: BLE001
        print(f"[warn] proxy setup failed: {exc}", file=sys.stderr)

    author = scholarly.search_author_id(scholar_id)
    author = scholarly.fill(author, sections=["basics", "indices", "counts", "publications"])

    per_year_raw = author.get("cites_per_year", {}) or {}
    per_year = {str(k): coerce_int(v) for k, v in per_year_raw.items()}

    publications_count = len(author.get("publications", []) or [])

    return {
        "name": author.get("name", "Peizhong Gao"),
        "affiliation": author.get("affiliation", "Tsinghua University"),
        "scholar_id": scholar_id,
        "total_citations": coerce_int(author.get("citedby", 0)),
        "h_index": coerce_int(author.get("hindex", 0)),
        "i10_index": coerce_int(author.get("i10index", 0)),
        "publications_count": publications_count,
        "per_year": per_year,
        "last_updated": utc_now_iso(),
    }


def merge_with_fallback(new: dict, existing: dict) -> dict:
    """Prefer new values, but keep old ones where new is missing/zero."""
    merged = dict(existing)
    merged.update({k: v for k, v in new.items() if v not in (None, "", 0, {}, [])})
    # If new per_year is empty or shorter, preserve the richer existing one.
    if not new.get("per_year"):
        merged["per_year"] = existing.get("per_year", {})
    # Always refresh the timestamp if this run succeeded.
    if new.get("last_updated"):
        merged["last_updated"] = new["last_updated"]
    return merged


def write_out(payload: dict) -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
    print(f"[ok] wrote {OUT_PATH}: citations={payload.get('total_citations')} "
          f"h={payload.get('h_index')} per_year={payload.get('per_year')}")


def main() -> int:
    existing = load_existing()
    try:
        scraped = fetch_scholar(SCHOLAR_ID)
    except Exception as exc:  # noqa: BLE001
        print(f"[error] scholar fetch failed: {exc}", file=sys.stderr)
        if existing:
            # Bump only the timestamp — keep previous numbers.
            existing["last_updated"] = utc_now_iso()
            write_out(existing)
            return 0
        return 1

    merged = merge_with_fallback(scraped, existing)
    write_out(merged)
    return 0


if __name__ == "__main__":
    sys.exit(main())
