from datetime import date

import pytest

from pe_risk import dating

EXAM = date(2026, 11, 4)


def test_lmp_edd_and_manual_agree():
    lmp = date(2026, 8, 12)  # 84 days before the exam = 12+0
    ga = dating.ga_days_from_lmp(lmp, EXAM)
    assert ga == 84
    edd = dating.edd_from_ga(ga, EXAM)
    assert edd == date(2027, 5, 19)
    assert dating.ga_days_from_edd(edd, EXAM) == 84
    assert dating.ga_days_manual(12, 0) == 84


def test_ivf_day5_transfer():
    # day-5 embryo transferred 65 days ago: 65 + 5 + 14 = 84 days = 12+0
    assert dating.ga_days_from_ivf(date(2026, 8, 31), 5, EXAM) == 84
    with pytest.raises(ValueError):
        dating.ga_days_from_ivf(date(2026, 8, 31), 4, EXAM)


def test_manual_days_range():
    with pytest.raises(ValueError):
        dating.ga_days_manual(12, 7)
