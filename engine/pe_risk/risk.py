"""Combine the prior and biomarkers into patient-specific risks."""

from __future__ import annotations

import math

import numpy as np

from . import likelihood, mom
from .coefficients import CoefficientSet, load
from .models import Assessment, RiskEstimate, RiskReport
from .prior import prior_mean_weeks, prior_sd_weeks

DEFAULT_CUTOFFS = (32.0, 37.0)
WINDOW_DAYS = (77, 97)  # 11+0 to 13+6: any GA from day 77.0 up to (not including) day 98
T_GRID = np.arange(0.0, 120.0, 0.01)  # weeks; prior mass outside is negligible


def _norm_cdf(z: float) -> float:
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def prior_risk(mu: float, sd: float, ga_weeks: float, cutoff: float) -> float:
    """P(PE before ``cutoff`` | no PE yet at ``ga_weeks``)."""
    if cutoff <= ga_weeks:
        return 0.0
    f_g = _norm_cdf((ga_weeks - mu) / sd)
    f_c = _norm_cdf((cutoff - mu) / sd)
    return (f_c - f_g) / (1 - f_g)


def posterior_risks(mu: float, sd: float, ga_weeks: float, log10_moms: dict[str, float],
                    coef: CoefficientSet, cutoffs: tuple[float, ...]) -> list[float]:
    t = T_GRID[T_GRID > ga_weeks]
    log_post = -0.5 * ((t - mu) / sd) ** 2 + likelihood.log_likelihood(t, log10_moms, coef)
    w = np.exp(log_post - log_post.max())
    total = np.trapezoid(w, t)
    out = []
    for c in cutoffs:
        mask = t <= c
        out.append(float(np.trapezoid(w[mask], t[mask]) / total) if mask.sum() > 1 else 0.0)
    return out


def _collect_moms(a: Assessment, coef: CoefficientSet, warnings: list[str]) -> dict[str, float]:
    b, mf, ga = a.biomarkers, a.maternal, a.ga_days
    moms: dict[str, float] = {}
    if b.map_mom is not None:
        moms["map"] = b.map_mom
    elif b.map_mmhg is not None:
        moms["map"] = mom.map_mom(b.map_mmhg, ga, mf, coef)

    if b.utpi_mom is not None:
        moms["utpi"] = b.utpi_mom
    elif b.utpi_left is not None and b.utpi_right is not None:
        moms["utpi"] = mom.utpi_mom((b.utpi_left + b.utpi_right) / 2, ga, mf, coef)
    elif (b.utpi_left is None) != (b.utpi_right is None):
        warnings.append("UtA-PI needs both left and right values; UtA-PI not used.")

    if b.plgf_mom is not None:
        moms["plgf"] = b.plgf_mom
    elif b.plgf_pg_ml is not None:
        if b.plgf_analyser is None:
            warnings.append("PlGF analyser not given; PlGF not used.")
        else:
            sample_ga = b.plgf_ga_days if b.plgf_ga_days is not None else ga
            moms["plgf"] = mom.plgf_mom(b.plgf_pg_ml, sample_ga, mf, b.plgf_analyser, coef)

    trunc = coef.data.get("truncation", {})
    for k, v in list(moms.items()):
        lo, hi = trunc.get(k, (0, math.inf))
        if v < lo or v > hi:
            warnings.append(f"{k.upper()} MoM {v:.2f} outside {lo}-{hi}; truncated.")
            moms[k] = min(max(v, lo), hi)
    return moms


def assess(a: Assessment, coef: CoefficientSet | None = None,
           cutoffs: tuple[float, ...] = DEFAULT_CUTOFFS) -> RiskReport:
    coef = coef or load()
    warnings: list[str] = []

    if not (WINDOW_DAYS[0] <= a.ga_days < WINDOW_DAYS[1] + 1):
        raise ValueError(
            f"gestational age {a.ga_days} days is outside 11+0 to 13+6 weeks "
            f"({WINDOW_DAYS[0]}-{WINDOW_DAYS[1]} days)"
        )

    for comp in ("prior", "mom", "likelihood", "truncation"):
        if comp == "likelihood" and not coef.has_likelihood():
            continue
        if not coef.is_clinical_ready(comp):
            warnings.append(
                f"Coefficients for '{comp}' are '{coef.verification(comp)}', "
                "not verified: not for clinical use."
            )

    ga_w = a.ga_days / 7
    mu = prior_mean_weeks(a.maternal, coef, warnings)
    sd = prior_sd_weeks(coef)
    mf_only = [RiskEstimate(c, prior_risk(mu, sd, ga_w, c)) for c in cutoffs]

    moms = _collect_moms(a, coef, warnings)
    combined = None
    if moms:
        if coef.has_likelihood():
            log10 = {k: math.log10(v) for k, v in moms.items()}
            probs = posterior_risks(mu, sd, ga_w, log10, coef, cutoffs)
            combined = [RiskEstimate(c, p) for c, p in zip(cutoffs, probs)]
        else:
            warnings.append(
                "Biomarker likelihood parameters are missing; showing risk from "
                "maternal factors only. MoMs are reported but not combined."
            )

    return RiskReport(
        model_label=coef.label,
        model_checksum=coef.checksum,
        prior_mean_weeks=mu,
        prior_sd_weeks=sd,
        moms=moms,
        maternal_factors_only=mf_only,
        combined=combined,
        markers_used=sorted(moms) if combined is not None else [],
        warnings=warnings,
    )
