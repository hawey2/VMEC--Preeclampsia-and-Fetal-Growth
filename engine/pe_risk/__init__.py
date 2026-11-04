"""Preeclampsia risk engine (FMF competing-risks model, published coefficients).

Decision support only. Not for clinical use until every coefficient component
is marked "verified" and the engine has been validated against the FMF
calculator and local outcomes.
"""

from .coefficients import load, load_file
from .models import (
    Analyser,
    Assessment,
    Biomarkers,
    Conception,
    Diabetes,
    Ethnicity,
    MaternalFactors,
    PreviousPregnancy,
    RiskEstimate,
    RiskReport,
)
from .risk import assess

__all__ = [
    "Analyser", "Assessment", "Biomarkers", "Conception", "Diabetes", "Ethnicity",
    "MaternalFactors", "PreviousPregnancy", "RiskEstimate", "RiskReport",
    "assess", "load", "load_file",
]
__version__ = "0.1.0"
