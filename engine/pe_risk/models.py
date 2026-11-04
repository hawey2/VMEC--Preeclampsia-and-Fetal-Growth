"""Input and output types for the risk engine.

All inputs are plain values so the API layer (phase 3) can build them from
form data without touching the maths.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Ethnicity(str, Enum):
    WHITE = "white"
    AFRO_CARIBBEAN = "afro_caribbean"
    SOUTH_ASIAN = "south_asian"
    EAST_ASIAN = "east_asian"
    MIXED = "mixed"


class Conception(str, Enum):
    SPONTANEOUS = "spontaneous"
    OVULATION_DRUGS = "ovulation_drugs"
    IVF = "ivf"


class Diabetes(str, Enum):
    NONE = "none"
    TYPE1 = "type1"
    TYPE2_INSULIN = "type2_insulin"
    TYPE2_NO_INSULIN = "type2_no_insulin"


class Analyser(str, Enum):
    DELFIA_XPRESS = "delfia_xpress"
    COBAS_E411 = "cobas_e411"  # Roche Elecsys PlGF
    KRYPTOR = "kryptor"


@dataclass(frozen=True)
class PreviousPregnancy:
    """The most recent previous pregnancy delivering at 24 weeks or later."""

    had_pe: bool
    ga_at_delivery_weeks: float
    interval_years: float
    """Years from that delivery to the conception of the current pregnancy."""


@dataclass(frozen=True)
class MaternalFactors:
    age_years: float
    weight_kg: float
    height_cm: float
    ethnicity: Ethnicity
    smoker: bool = False
    conception: Conception = Conception.SPONTANEOUS
    chronic_hypertension: bool = False
    diabetes: Diabetes = Diabetes.NONE
    sle_or_aps: bool = False
    family_history_pe: bool = False
    """Mother of the patient had preeclampsia."""
    previous: PreviousPregnancy | None = None
    """None means nulliparous."""


@dataclass(frozen=True)
class Biomarkers:
    """Either raw values or MoMs; a MoM given here wins over a raw value."""

    map_mmhg: float | None = None
    map_mom: float | None = None
    utpi_left: float | None = None
    utpi_right: float | None = None
    utpi_mom: float | None = None
    plgf_pg_ml: float | None = None
    plgf_analyser: Analyser | None = None
    plgf_mom: float | None = None
    plgf_ga_days: float | None = None
    """GA when the blood was taken, if not on the examination day."""


@dataclass(frozen=True)
class Assessment:
    ga_days: float
    maternal: MaternalFactors
    biomarkers: Biomarkers = field(default_factory=Biomarkers)


@dataclass(frozen=True)
class RiskEstimate:
    """Risk of delivery with PE before ``cutoff_weeks``, as a probability."""

    cutoff_weeks: float
    probability: float

    @property
    def one_in(self) -> int:
        if self.probability <= 0:
            return 10**7
        return max(1, round(1 / self.probability))


@dataclass
class RiskReport:
    model_label: str
    model_checksum: str
    prior_mean_weeks: float
    prior_sd_weeks: float
    moms: dict[str, float]
    maternal_factors_only: list[RiskEstimate]
    combined: list[RiskEstimate] | None
    markers_used: list[str]
    warnings: list[str]
