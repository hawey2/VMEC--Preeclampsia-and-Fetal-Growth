from dataclasses import replace

import pytest

from pe_risk import Analyser, Conception, Ethnicity, PreviousPregnancy
from pe_risk import mom


def test_reference_woman_at_11_weeks_has_mom_one_at_intercept(coef, reference_woman):
    """At GA 77 days and reference covariates every term except the intercept is zero."""
    assert mom.map_mom(10**1.9364, 77, reference_woman, coef) == pytest.approx(1.0)
    assert mom.utpi_mom(10**0.26457, 77, reference_woman, coef) == pytest.approx(1.0)
    for analyser, intercept in [
        (Analyser.DELFIA_XPRESS, 1.332959332),
        (Analyser.COBAS_E411, 1.542535524),
        (Analyser.KRYPTOR, 1.430615169),
    ]:
        assert mom.plgf_mom(10**intercept, 77, reference_woman, analyser, coef) == pytest.approx(1.0)


def test_expected_medians_are_clinically_plausible(coef, reference_woman):
    # MAP about 86 mmHg, UtA-PI about 1.8, Roche PlGF about 35 pg/mL at 11+0
    assert 10 ** mom.expected_log10_map(77, reference_woman, coef) == pytest.approx(86.4, abs=0.1)
    assert 10 ** mom.expected_log10_utpi(77, reference_woman, coef) == pytest.approx(1.84, abs=0.01)
    assert 10 ** mom.expected_log10_plgf(77, reference_woman, Analyser.COBAS_E411, coef) == pytest.approx(34.9, abs=0.1)


def test_gestational_age_direction(coef, reference_woman):
    # UtA-PI falls and PlGF rises across 11-13 weeks
    assert mom.expected_log10_utpi(97, reference_woman, coef) < mom.expected_log10_utpi(77, reference_woman, coef)
    assert mom.expected_log10_plgf(97, reference_woman, Analyser.KRYPTOR, coef) > \
        mom.expected_log10_plgf(77, reference_woman, Analyser.KRYPTOR, coef)


def test_east_asian_terms(coef, reference_woman):
    asian = replace(reference_woman, ethnicity=Ethnicity.EAST_ASIAN)
    d_utpi = mom.expected_log10_utpi(84, asian, coef) - mom.expected_log10_utpi(84, reference_woman, coef)
    d_plgf = mom.expected_log10_plgf(84, asian, Analyser.COBAS_E411, coef) - \
        mom.expected_log10_plgf(84, reference_woman, Analyser.COBAS_E411, coef)
    d_map = mom.expected_log10_map(84, asian, coef) - mom.expected_log10_map(84, reference_woman, coef)
    assert d_utpi == pytest.approx(0.00763)
    assert d_plgf == pytest.approx(0.034550109)
    assert d_map == 0.0


def test_covariate_terms(coef, reference_woman):
    smoker = replace(reference_woman, smoker=True)
    assert mom.expected_log10_plgf(84, smoker, Analyser.KRYPTOR, coef) - \
        mom.expected_log10_plgf(84, reference_woman, Analyser.KRYPTOR, coef) == pytest.approx(0.160836176)
    ivf = replace(reference_woman, conception=Conception.IVF)
    assert mom.expected_log10_plgf(84, ivf, Analyser.KRYPTOR, coef) - \
        mom.expected_log10_plgf(84, reference_woman, Analyser.KRYPTOR, coef) == pytest.approx(-0.022250585)
    htn = replace(reference_woman, chronic_hypertension=True, weight_kg=79)
    plain = replace(reference_woman, weight_kg=79)
    assert mom.expected_log10_map(84, htn, coef) - mom.expected_log10_map(84, plain, coef) == \
        pytest.approx(0.05363 - 0.00023975 * 10)
    parous = replace(reference_woman, previous=PreviousPregnancy(False, 39, 5))
    assert mom.expected_log10_map(84, parous, coef) - mom.expected_log10_map(84, reference_woman, coef) == \
        pytest.approx(-0.00663 + 0.00082639 * 3)


def test_mean_arterial_pressure_from_four_readings():
    readings = [(120, 75), (118, 76), (122, 74), (120, 75)]
    assert mom.mean_arterial_pressure(readings) == pytest.approx(90.0)
    with pytest.raises(ValueError):
        mom.mean_arterial_pressure([])
