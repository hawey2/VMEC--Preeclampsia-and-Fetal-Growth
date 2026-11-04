from dataclasses import replace

import pytest

from pe_risk import Conception, Diabetes, Ethnicity, PreviousPregnancy
from pe_risk.prior import prior_mean_weeks, prior_sd_weeks


def test_reference_woman_gets_intercept(coef, reference_woman):
    assert prior_mean_weeks(reference_woman, coef) == pytest.approx(54.3637)
    assert prior_sd_weeks(coef) == pytest.approx(6.8833)


def test_east_asian_has_no_separate_term(coef, reference_woman):
    asian = replace(reference_woman, ethnicity=Ethnicity.EAST_ASIAN)
    assert prior_mean_weeks(asian, coef) == prior_mean_weeks(reference_woman, coef)


@pytest.mark.parametrize(
    "change, expected_shift",
    [
        ({"age_years": 40}, -0.206886 * 5),
        ({"age_years": 30}, 0.0),  # broken stick: no effect below 35
        ({"height_cm": 174}, 0.117110 * 10),
        ({"weight_kg": 79}, -0.0694096 * 10),
        ({"ethnicity": Ethnicity.AFRO_CARIBBEAN}, -2.6786),
        ({"ethnicity": Ethnicity.SOUTH_ASIAN}, -1.1290),
        ({"sle_or_aps": True}, -3.0519),
        ({"conception": Conception.IVF}, -1.6327),
        ({"conception": Conception.OVULATION_DRUGS}, 0.0),
        ({"family_history_pe": True}, -1.7154),
        ({"diabetes": Diabetes.TYPE1}, -3.3899),
        ({"diabetes": Diabetes.TYPE2_NO_INSULIN}, -3.3899),
    ],
)
def test_single_factor_shifts(coef, reference_woman, change, expected_shift):
    base = prior_mean_weeks(reference_woman, coef)
    shifted = prior_mean_weeks(replace(reference_woman, **change), coef)
    assert shifted - base == pytest.approx(expected_shift)


def test_chronic_hypertension_switches_off_weight_family_diabetes(coef, reference_woman):
    htn = replace(reference_woman, chronic_hypertension=True)
    base = prior_mean_weeks(htn, coef)
    assert base == pytest.approx(54.3637 - 7.2897)
    loaded = replace(htn, weight_kg=99, family_history_pe=True, diabetes=Diabetes.TYPE1)
    assert prior_mean_weeks(loaded, coef) == pytest.approx(base)


def test_previous_pe_increases_risk_more_when_earlier(coef, reference_woman):
    early = replace(reference_woman, previous=PreviousPregnancy(True, 30, 2))
    term = replace(reference_woman, previous=PreviousPregnancy(True, 40, 2))
    assert prior_mean_weeks(early, coef) == pytest.approx(54.3637 - 8.1667 + 0.0271988 * 36)
    assert prior_mean_weeks(early, coef) < prior_mean_weeks(term, coef) < 54.3637


def test_parous_without_pe_is_protective_and_fades_with_interval(coef, reference_woman):
    base = prior_mean_weeks(reference_woman, coef)
    shifts = [
        prior_mean_weeks(replace(reference_woman, previous=PreviousPregnancy(False, 40, y)), coef) - base
        for y in (1, 2, 5, 10, 15)
    ]
    assert all(s > 0 for s in shifts), shifts  # protective at every interval, even >15 y
    assert shifts == sorted(shifts, reverse=True)  # benefit falls with longer interval
    expected_1y = -4.3350 - 4.15137651 + 9.21473572 + 0.01549673 * 16**2
    assert shifts[0] == pytest.approx(expected_1y)


def test_very_short_interval_is_floored_with_warning(coef, reference_woman):
    w: list[str] = []
    short = replace(reference_woman, previous=PreviousPregnancy(False, 39, 0.05))
    floored = replace(reference_woman, previous=PreviousPregnancy(False, 39, 0.25))
    assert prior_mean_weeks(short, coef, w) == pytest.approx(prior_mean_weeks(floored, coef))
    assert w and "0.25" in w[0]
