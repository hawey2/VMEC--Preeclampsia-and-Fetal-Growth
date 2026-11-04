"""Gestational age at the examination from the chosen dating method.

Implemented: CRL (Robinson & Fleming 1975), BPD (de Paco Matallana 2025),
LMP, EDD, IVF transfer date and manual entry. HC dating is not implemented:
no published first-trimester HC dating formula has been chosen yet.
"""

from __future__ import annotations

import math
from datetime import date
from enum import Enum


class DatingMethod(str, Enum):
    CRL = "crl"
    LMP = "lmp"
    EDD = "edd"
    IVF = "ivf"
    MANUAL = "manual"
    BPD = "bpd"
    HC = "hc"


def ga_days_from_crl(crl_mm: float) -> float:
    """Robinson & Fleming 1975: GA (days) = 8.052 * sqrt(CRL mm) + 23.73.
    Valid for CRL 45-84 mm, the 11+0 to 13+6 week screening window."""
    if not 45 <= crl_mm <= 84:
        raise ValueError(f"CRL {crl_mm} mm is outside 45-84 mm (11+0 to 13+6 weeks)")
    return 8.052 * math.sqrt(crl_mm) + 23.73


def ga_days_from_bpd(bpd_mm: float) -> float:
    """de Paco Matallana C et al. UOG 2025;65:560-566 (doi:10.1002/uog.29216):
    GA (days) = (BPD mm + 16.33798) / 0.4299, derived at 11+0 to 13+6 weeks."""
    if not 15 <= bpd_mm <= 28:
        raise ValueError(f"BPD {bpd_mm} mm is outside 15-28 mm (about 11-13 weeks)")
    return (bpd_mm + 16.33798) / 0.4299


def bpd_median_mm(ga_days: float) -> float:
    """The same regression read the other way: expected BPD for a given GA."""
    return 0.4299 * ga_days - 16.33798


def ga_days_from_lmp(lmp: date, exam: date) -> float:
    return float((exam - lmp).days)


def ga_days_from_edd(edd: date, exam: date) -> float:
    return float(280 - (edd - exam).days)


def ga_days_from_ivf(transfer: date, embryo_age_days: int, exam: date) -> float:
    """Embryo age 3 or 5 days at transfer; conception = transfer - embryo age,
    and GA counts 14 days before conception."""
    if embryo_age_days not in (3, 5, 6):
        raise ValueError("embryo age at transfer must be 3, 5 or 6 days")
    return float((exam - transfer).days + embryo_age_days + 14)


def ga_days_manual(weeks: int, days: int) -> float:
    if not 0 <= days <= 6:
        raise ValueError("days must be 0-6")
    return float(weeks * 7 + days)


def edd_from_ga(ga_days: float, exam: date) -> date:
    from datetime import timedelta

    return exam + timedelta(days=round(280 - ga_days))


def format_ga(ga_days: float) -> str:
    d = int(ga_days)
    return f"{d // 7}+{d % 7}"
