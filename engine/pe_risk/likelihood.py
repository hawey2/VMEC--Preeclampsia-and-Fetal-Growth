"""Biomarker likelihood given gestational age at delivery with PE.

Model structure (competing risks, O'Gorman 2016 / Tan 2018): log10 MoM values
follow a multivariate Gaussian. In pregnancies with PE the mean of each marker
is a straight line in gestational age at delivery, ``b0 + b1 * GA``, until it
reaches 0 (the unaffected mean) at ``GA = -b0 / b1``; after that it stays 0.

JSON shape::

    "likelihood": {
      "markers": {"map": {"b0": <float>, "b1_per_week": <float>}, "utpi": {...}, "plgf": {...}},
      "covariance": {"order": ["map", "utpi", "plgf"], "matrix": [[...], [...], [...]]}
    }

The older form ``{"slope_per_week", "ga_meets_unaffected_weeks"}`` and a
covariance given as ``sd`` + ``correlation`` are also accepted.
"""

from __future__ import annotations

import numpy as np

from .coefficients import CoefficientSet


def marker_mean(t_weeks: np.ndarray, params: dict) -> np.ndarray:
    """Mean log10 MoM for a pregnancy whose PE time is ``t_weeks``."""
    if "b0" in params:
        b0, b1 = params["b0"], params["b1_per_week"]
        t0 = -b0 / b1
        return np.where(t_weeks < t0, b0 + b1 * t_weeks, 0.0)
    t0 = params["ga_meets_unaffected_weeks"]
    slope = params["slope_per_week"]
    return np.where(t_weeks < t0, slope * (t_weeks - t0), 0.0)


def covariance(coef: CoefficientSet, markers: list[str]) -> np.ndarray:
    cov = coef.data["likelihood"]["covariance"]
    idx = [cov["order"].index(m) for m in markers]
    if "matrix" in cov:
        return np.asarray(cov["matrix"], dtype=float)[np.ix_(idx, idx)]
    sd = np.asarray(cov["sd"], dtype=float)[idx]
    corr = np.asarray(cov["correlation"], dtype=float)[np.ix_(idx, idx)]
    return corr * np.outer(sd, sd)


def log_likelihood(t_grid: np.ndarray, log10_moms: dict[str, float],
                   coef: CoefficientSet) -> np.ndarray:
    """Log density of the observed log10 MoMs for each PE time in ``t_grid``
    (constant terms dropped: they cancel when the posterior is normalised)."""
    markers = list(log10_moms)
    params = coef.data["likelihood"]["markers"]
    x = np.array([log10_moms[m] for m in markers])
    means = np.stack([marker_mean(t_grid, params[m]) for m in markers], axis=1)
    resid = x[None, :] - means
    prec = np.linalg.inv(covariance(coef, markers))
    return -0.5 * np.einsum("ij,jk,ik->i", resid, prec, resid)
