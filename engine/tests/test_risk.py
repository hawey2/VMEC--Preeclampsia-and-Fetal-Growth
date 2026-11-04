import math
from dataclasses import replace

import numpy as np
import pytest

from pe_risk import Analyser, Assessment, Biomarkers, PreviousPregnancy, assess, coefficients
from pe_risk.dating import format_ga, ga_days_from_crl
from pe_risk.likelihood import marker_mean
from pe_risk.risk import T_GRID, posterior_risks, prior_risk


def test_crl_dating_matches_robinson():
    assert ga_days_from_crl(45) == pytest.approx(77.75, abs=0.01)
    assert ga_days_from_crl(84) == pytest.approx(97.53, abs=0.01)
    assert format_ga(ga_days_from_crl(60)) == "12+2"  # 86.1 days
    with pytest.raises(ValueError):
        ga_days_from_crl(30)


def test_reference_woman_prior_risks(reference_woman):
    r = assess(Assessment(ga_days=84, maternal=reference_woman))
    by_cut = {e.cutoff_weeks: e for e in r.maternal_factors_only}
    # closed form: Phi((c - 54.3637) / 6.8833), conditioned on no PE by 12 weeks
    assert by_cut[37].probability == pytest.approx(0.5 * (1 + math.erf((37 - 54.3637) / 6.8833 / math.sqrt(2))), rel=1e-6)
    assert by_cut[37].one_in == 172
    assert by_cut[32].one_in == 1727


def test_higher_risk_factors_raise_risk(reference_woman):
    low = assess(Assessment(84, reference_woman)).maternal_factors_only[1].probability
    high_mf = replace(reference_woman, chronic_hypertension=True, previous=PreviousPregnancy(True, 32, 2))
    high = assess(Assessment(84, high_mf)).maternal_factors_only[1].probability
    assert high > 50 * low


def test_outside_window_is_refused(reference_woman):
    with pytest.raises(ValueError, match="outside 11\\+0 to 13\\+6"):
        assess(Assessment(ga_days=140, maternal=reference_woman))


def test_model_refuses_to_combine_without_likelihood(reference_woman, coef):
    no_lk = coefficients.from_dict({**coef.data, "likelihood": {"verification": "missing", "markers": None, "covariance": None}})
    b = Biomarkers(map_mmhg=95, utpi_left=2.2, utpi_right=2.4, plgf_pg_ml=20, plgf_analyser=Analyser.COBAS_E411)
    r = assess(Assessment(84, reference_woman, b), no_lk)
    assert r.combined is None
    assert set(r.moms) == {"map", "utpi", "plgf"}
    assert any("likelihood parameters are missing" in w for w in r.warnings)
    assert any("not for clinical use" in w for w in r.warnings)


def test_bundled_likelihood_combines_markers(reference_woman):
    """Bundled (secondary-source) parameters: abnormal markers raise preterm-PE risk well above
    the history-only risk, normal markers lower it, and results are flagged not clinical."""
    high = Biomarkers(map_mmhg=105, utpi_left=2.6, utpi_right=2.8, plgf_pg_ml=15, plgf_analyser=Analyser.COBAS_E411)
    r = assess(Assessment(88, reference_woman, high))
    prior37 = r.maternal_factors_only[1].probability
    assert r.combined is not None and r.markers_used == ["map", "plgf", "utpi"]
    assert r.combined[1].probability > 10 * prior37
    assert r.combined[0].probability < r.combined[1].probability
    assert any("likelihood" in w and "not for clinical use" in w for w in r.warnings)

    normal = Biomarkers(map_mmhg=84, utpi_left=1.5, utpi_right=1.6)
    rn = assess(Assessment(88, reference_woman, normal))
    assert rn.combined[1].probability < prior37


def test_mean_log10_mom_lines():
    """Pin the PE regression lines: b0 + b1*GA, flat at 0 from -b0/b1 weeks."""
    import numpy as np
    from pe_risk import likelihood
    p = coefficients.load().data["likelihood"]["markers"]
    assert likelihood.marker_mean(np.array([30.0]), p["utpi"])[0] == pytest.approx(0.5861 - 0.014233 * 30)
    assert likelihood.marker_mean(np.array([45.0]), p["utpi"])[0] == 0.0
    assert likelihood.marker_mean(np.array([30.0]), p["plgf"])[0] == pytest.approx(-0.92352 + 0.021584 * 30)


def test_missing_inputs_are_reported(reference_woman):
    r = assess(Assessment(84, reference_woman, Biomarkers(utpi_left=1.5, plgf_pg_ml=30)))
    assert r.moms == {}
    assert any("left and right" in w for w in r.warnings)
    assert any("analyser" in w for w in r.warnings)


def test_mom_truncation(reference_woman):
    r = assess(Assessment(84, reference_woman, Biomarkers(plgf_mom=0.1)))
    assert r.moms["plgf"] == pytest.approx(10 ** -0.56550992, abs=1e-3)
    assert any("truncated" in w for w in r.warnings)


def test_posterior_equals_prior_when_markers_are_uninformative(coef_with_test_likelihood):
    """With a likelihood flat in t, the numerical posterior must reproduce the closed-form prior."""
    flat = coefficients.from_dict({
        **coef_with_test_likelihood.data,
        "likelihood": {
            **coef_with_test_likelihood.data["likelihood"],
            "markers": {"map": {"slope_per_week": 0.0, "ga_meets_unaffected_weeks": 42.0}},
        },
    })
    for mu in (40.0, 54.3637):
        num = posterior_risks(mu, 6.8833, 12.0, {"map": 0.0}, flat, (32.0, 37.0))
        exact = [prior_risk(mu, 6.8833, 12.0, c) for c in (32.0, 37.0)]
        assert num == pytest.approx(exact, rel=1e-3)


def test_abnormal_markers_raise_and_normal_markers_lower_risk(reference_woman, coef_with_test_likelihood):
    coef = coef_with_test_likelihood
    prior = assess(Assessment(84, reference_woman), coef).maternal_factors_only[1].probability
    bad = assess(Assessment(84, reference_woman, Biomarkers(map_mom=1.15, utpi_mom=1.6, plgf_mom=0.5)), coef)
    good = assess(Assessment(84, reference_woman, Biomarkers(map_mom=0.95, utpi_mom=0.9, plgf_mom=1.2)), coef)
    assert bad.combined[1].probability > 5 * prior
    assert good.combined[1].probability < prior
    assert bad.markers_used == ["map", "plgf", "utpi"]


def test_marker_mean_is_zero_after_meeting_point():
    p = {"slope_per_week": -0.01, "ga_meets_unaffected_weeks": 40.0}
    m = marker_mean(np.array([30.0, 40.0, 45.0]), p)
    assert m.tolist() == pytest.approx([0.1, 0.0, 0.0])


def test_simulation_calibration(coef_with_test_likelihood):
    """Simulate women from the model itself: mean predicted risk must match the
    simulated rate of PE before 37 weeks (checks the Bayes step end to end)."""
    coef = coef_with_test_likelihood
    rng = np.random.default_rng(2026)
    mu, sd, ga, n = 40.0, 6.8833, 12.0, 3000
    lk = coef.data["likelihood"]
    order = lk["covariance"]["order"]
    sds = np.array(lk["covariance"]["sd"])
    cov = np.array(lk["covariance"]["correlation"]) * np.outer(sds, sds)

    t = rng.normal(mu, sd, size=n * 2)
    t = t[t > ga][:n]
    means = np.stack([marker_mean(t, lk["markers"][m]) for m in order], axis=1)
    x = means + rng.multivariate_normal(np.zeros(3), cov, size=n)

    predicted = [
        posterior_risks(mu, sd, ga, dict(zip(order, row)), coef, (37.0,))[0] for row in x
    ]
    observed = float(np.mean(t < 37))
    assert np.mean(predicted) == pytest.approx(observed, abs=0.025)
    # and the markers add information: affected women score higher on average
    pred = np.array(predicted)
    assert pred[t < 37].mean() > pred[t >= 37].mean() + 0.1


def test_report_carries_model_identity(reference_woman, coef):
    r = assess(Assessment(84, reference_woman))
    assert r.model_label == "fmf-11-13-v1"
    assert r.model_checksum == coef.checksum and len(r.model_checksum) == 64
    assert T_GRID[0] == 0.0


def test_plgf_mom_uses_sample_gestation(reference_woman):
    same_day = assess(Assessment(84, reference_woman, Biomarkers(plgf_pg_ml=40, plgf_analyser=Analyser.KRYPTOR)))
    earlier = assess(Assessment(84, reference_woman, Biomarkers(plgf_pg_ml=40, plgf_analyser=Analyser.KRYPTOR, plgf_ga_days=78)))
    # PlGF rises with GA, so the same value drawn earlier is a higher MoM
    assert earlier.moms["plgf"] > same_day.moms["plgf"]


def test_whole_of_day_97_is_inside_the_window():
    """13+6 means any time on day 97: CRL 84 mm (97.5 days) is accepted, day 98 (14+0) is not."""
    from pe_risk import Assessment, Ethnicity, MaternalFactors, assess

    mf = MaternalFactors(age_years=30, weight_kg=60, height_cm=160, ethnicity=Ethnicity.EAST_ASIAN)
    assert assess(Assessment(ga_days=ga_days_from_crl(84), maternal=mf)).maternal_factors_only
    with pytest.raises(ValueError):
        assess(Assessment(ga_days=98.0, maternal=mf))
