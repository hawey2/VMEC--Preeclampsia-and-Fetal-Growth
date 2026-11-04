"""Gestational age from first-trimester dating.

Only CRL dating is implemented in phase 1. BPD, HC, LMP, IVF and manual
dating are added with the web form (phase 2).
"""

from __future__ import annotations

import math


def ga_days_from_crl(crl_mm: float) -> float:
    """Robinson & Fleming 1975: GA (days) = 8.052 * sqrt(CRL mm) + 23.73.
    Valid for CRL 45-84 mm, the 11+0 to 13+6 week screening window."""
    if not 45 <= crl_mm <= 84:
        raise ValueError(f"CRL {crl_mm} mm is outside 45-84 mm (11+0 to 13+6 weeks)")
    return 8.052 * math.sqrt(crl_mm) + 23.73


def format_ga(ga_days: float) -> str:
    d = int(ga_days)
    return f"{d // 7}+{d % 7}"
