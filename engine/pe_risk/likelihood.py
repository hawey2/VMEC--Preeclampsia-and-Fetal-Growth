"""Biomarker likelihood given gestational age at delivery with PE.

Model structure (competing-risks, O'Gorman 2016 / Tan 2018): log10 MoM values
follow a multivariate Gaussian. In pregnancies with PE the mean of each marker
deviates from 0 linearly with gestational age at delivery, and the deviation
shrinks to 0 at the gestation where PE pregnancies look like unaffected ones.

The numeric parameters are NOT bundled because the published tables could not
be accessed (see coefficients JSON, ``likelihood.verification == "missing"``).
Expected parameter shape::

    "likelihood": {
      "markers": {
        "map":  {"slope_per_week": <float>, "ga_meets_unaffected_weeks": <float>},
        "utpi": {...}, "plgf": {...}
      },
      "covariance": {
        "order": ["map", "utpi", "plgf"],
        "sd": [<float>, <float>, <float>],
        "correlation": [[1, r12, r13], [r12, 1, r23], [r13, r23, 1]]
      }
    }

If the paper's parameterisation differs (e.g. intercept + slope, separate
SDs for PE), adapt ``marker_mean`` and the JSON together; the tests pin the
behaviour so a change is visible.
"""

from __future__ import annotations

import numpy as np

from .coefficients import CoefficientSet


def marker_mean(t_weeks: np.ndarray, params: dict) -> np.ndarray:
    """Mean log10 MoM for a pregnancy whose PE time is ``t_weeks``."""
    t0 = params["ga_meets_unaffected_weeks"]
    slope = params["slope_per_week"]
    return np.where(t_weeks < t0, slope * (t_weeks - t0), 0.0)


def covariance(coef: CoefficientSet, markers: list[str]) -> np.ndarray:
    cov = coef.data["likelihood"]["covariance"]
    order = cov["order"]
    idx = [order.index(m) for m in markers]
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
