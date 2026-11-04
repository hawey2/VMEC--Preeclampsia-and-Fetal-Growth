"""Convert raw biomarker values to multiples of the median (MoM).

Tan et al. 2018 (UOG 52:186), Appendix 1: each model gives log10 of the
expected median for a woman with the same gestational age and characteristics.
"""

from __future__ import annotations

from .coefficients import CoefficientSet
from .models import Analyser, Conception, Diabetes, MaternalFactors


def _diabetes_term(m: dict, diabetes: Diabetes) -> float:
    key = {
        Diabetes.TYPE1: "diabetes_type1",
        Diabetes.TYPE2_INSULIN: "diabetes_type2_insulin",
        Diabetes.TYPE2_NO_INSULIN: "diabetes_type2_no_insulin",
    }.get(diabetes)
    return m.get(key, 0.0) if key else 0.0


def _parity_terms(m: dict, mf: MaternalFactors) -> float:
    prev = mf.previous
    if prev is None:
        return 0.0
    if prev.had_pe:
        return m.get("parous_previous_pe", 0.0)
    out = m.get("parous_no_previous_pe", 0.0)
    out += m.get("parous_no_previous_pe_x_interval_minus_2", 0.0) * (prev.interval_years - 2)
    return out


def expected_log10_map(ga_days: float, mf: MaternalFactors, coef: CoefficientSet) -> float:
    m = coef.data["mom"]["map"]
    ga, wt = ga_days - 77, mf.weight_kg - 69
    y = (
        m["intercept"]
        + m["ga"] * ga + m["ga_squared"] * ga**2
        + m["weight"] * wt + m["weight_squared"] * wt**2
        + m["height"] * (mf.height_cm - 164)
        + m["ethnicity"].get(mf.ethnicity.value, 0.0)
        + _diabetes_term(m, mf.diabetes)
        + _parity_terms(m, mf)
    )
    if mf.smoker:
        y += m["smoker"]
    if mf.chronic_hypertension:
        y += m["chronic_hypertension"] + m["chronic_hypertension_x_weight"] * wt
    if mf.family_history_pe:
        y += m["family_history_pe"]
    return y


def expected_log10_utpi(ga_days: float, mf: MaternalFactors, coef: CoefficientSet) -> float:
    m = coef.data["mom"]["utpi"]
    ga, wt = ga_days - 77, mf.weight_kg - 69
    return (
        m["intercept"]
        + m["ga"] * ga
        + m["weight"] * wt + m["weight_squared"] * wt**2
        + m["age"] * (mf.age_years - 35)
        + m["ethnicity"].get(mf.ethnicity.value, 0.0)
        + _diabetes_term(m, mf.diabetes)
        + _parity_terms(m, mf)
    )


def expected_log10_plgf(ga_days: float, mf: MaternalFactors, analyser: Analyser,
                        coef: CoefficientSet) -> float:
    m = coef.data["mom"]["plgf"]
    ga, wt = ga_days - 77, mf.weight_kg - 69
    y = (
        m["intercept_by_analyser"][analyser.value]
        + m["ga"] * ga + m["ga_squared"] * ga**2
        + m["weight"] * wt + m["weight_squared"] * wt**2
        + m["age"] * (mf.age_years - 35)
        + m["ethnicity"].get(mf.ethnicity.value, 0.0)
        + _diabetes_term(m, mf.diabetes)
        + _parity_terms(m, mf)
    )
    if mf.smoker:
        y += m["smoker"]
    if mf.conception is Conception.IVF:
        y += m["ivf"]
    return y


def map_mom(value_mmhg: float, ga_days: float, mf: MaternalFactors, coef: CoefficientSet) -> float:
    return value_mmhg / 10 ** expected_log10_map(ga_days, mf, coef)


def utpi_mom(value: float, ga_days: float, mf: MaternalFactors, coef: CoefficientSet) -> float:
    return value / 10 ** expected_log10_utpi(ga_days, mf, coef)


def plgf_mom(value_pg_ml: float, ga_days: float, mf: MaternalFactors, analyser: Analyser,
             coef: CoefficientSet) -> float:
    return value_pg_ml / 10 ** expected_log10_plgf(ga_days, mf, analyser, coef)


def mean_arterial_pressure(readings: list[tuple[float, float]]) -> float:
    """MAP from (systolic, diastolic) pairs, averaged as the FMF protocol says
    (two readings from each arm). MAP = diastolic + (systolic - diastolic) / 3."""
    if not readings:
        raise ValueError("at least one blood pressure reading is required")
    maps = [d + (s - d) / 3 for s, d in readings]
    return sum(maps) / len(maps)
