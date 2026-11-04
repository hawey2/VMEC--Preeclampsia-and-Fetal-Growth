"""Prior distribution of gestational age at delivery with PE from maternal factors.

Wright et al. 2015 (AJOG 213:62): T ~ Normal(mu, sd^2), mu from a linear model
in maternal characteristics and history.
"""

from __future__ import annotations

from .coefficients import CoefficientSet
from .models import Conception, Diabetes, MaternalFactors


def prior_terms(mf: MaternalFactors, coef: CoefficientSet,
                warnings: list[str] | None = None) -> list[tuple[str, float]]:
    """Each non-zero contribution to the mean, in weeks, labelled so the app
    can show the working. The first item is the intercept."""
    c = coef.data["prior"]
    terms: list[tuple[str, float]] = [("intercept", c["intercept"])]

    def add(name: str, value: float) -> None:
        if value != 0:
            terms.append((name, value))

    if mf.age_years > 35:
        add("age_over_35", c["age_over_35_per_year"] * (mf.age_years - 35))
    add("height", c["height_minus_164_per_cm"] * (mf.height_cm - 164))
    add("ethnicity", c["ethnicity"].get(mf.ethnicity.value, 0.0))
    if mf.chronic_hypertension:
        add("chronic_hypertension", c["chronic_hypertension"])
    if mf.sle_or_aps:
        add("sle_or_aps", c["sle_or_aps"])
    if mf.conception is Conception.IVF:
        add("ivf", c["ivf"])

    prev = mf.previous
    if prev is not None:
        sq = (prev.ga_at_delivery_weeks - 24) ** 2
        if prev.had_pe:
            p = c["parous_previous_pe"]
            add("parous_previous_pe", p["intercept"] + p["prev_ga_minus_24_squared"] * sq)
        else:
            p = c["parous_no_previous_pe"]
            floor = c["implementation_choices"]["min_interval_years"]
            interval = prev.interval_years
            if interval < floor:
                if warnings is not None:
                    warnings.append(
                        f"Interpregnancy interval {interval:g} y raised to {floor:g} y "
                        "for the prior model (unvalidated bound)."
                    )
                interval = floor
            add("parous_no_previous_pe",
                p["intercept"]
                + p["interval_years_pow_minus_1"] * interval ** -1
                + p["interval_years_pow_minus_0_5"] * interval ** -0.5
                + p["prev_ga_minus_24_squared"] * sq)

    if not mf.chronic_hypertension:
        w = c["without_chronic_hypertension"]
        add("weight", w["weight_minus_69_per_kg"] * (mf.weight_kg - 69))
        if mf.family_history_pe:
            add("family_history_pe", w["family_history_pe"])
        if mf.diabetes is not Diabetes.NONE:
            add("diabetes", w["diabetes_type1_or_2"])
    return terms


def prior_mean_weeks(mf: MaternalFactors, coef: CoefficientSet,
                     warnings: list[str] | None = None) -> float:
    return sum(v for _, v in prior_terms(mf, coef, warnings))


def prior_sd_weeks(coef: CoefficientSet) -> float:
    return coef.data["prior"]["sd"]
