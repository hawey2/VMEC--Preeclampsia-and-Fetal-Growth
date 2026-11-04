"""Versioned coefficient sets.

Each set is a JSON file. Its SHA-256 checksum is printed on every report so a
printed risk can always be traced to the exact numbers that produced it.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Any

DEFAULT_LABEL = "fmf_11_13_v1"

CLINICAL_LEVELS = {"verified"}


@dataclass(frozen=True)
class CoefficientSet:
    label: str
    checksum: str
    data: dict[str, Any]

    def verification(self, component: str) -> str:
        return self.data[component]["verification"]

    def is_clinical_ready(self, component: str) -> bool:
        return self.verification(component) in CLINICAL_LEVELS

    def has_likelihood(self) -> bool:
        lk = self.data.get("likelihood") or {}
        return bool(lk.get("markers")) and lk.get("covariance") is not None


def _from_bytes(raw: bytes, fallback_label: str) -> CoefficientSet:
    data = json.loads(raw)
    return CoefficientSet(
        label=data.get("label", fallback_label),
        checksum=hashlib.sha256(raw).hexdigest(),
        data=data,
    )


def load(label: str = DEFAULT_LABEL) -> CoefficientSet:
    """Load a coefficient set shipped with the package."""
    raw = resources.files(__name__).joinpath(f"{label}.json").read_bytes()
    return _from_bytes(raw, label)


def load_file(path: str | Path) -> CoefficientSet:
    """Load a coefficient set from disk (e.g. one approved by Vinmec)."""
    p = Path(path)
    return _from_bytes(p.read_bytes(), p.stem)


def from_dict(data: dict[str, Any]) -> CoefficientSet:
    """Build a set in memory; used by tests."""
    raw = json.dumps(data, sort_keys=True).encode()
    return _from_bytes(raw, data.get("label", "in-memory"))
