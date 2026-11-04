import copy

import pytest

from pe_risk import Ethnicity, MaternalFactors, coefficients

# Synthetic likelihood parameters for testing the maths ONLY.
# They are invented, not from any paper, and must never reach clinical use.
TEST_ONLY_LIKELIHOOD = {
    "verification": "missing",
    "source": "TEST ONLY - invented numbers to exercise the engine",
    "markers": {
        "map": {"slope_per_week": -0.004, "ga_meets_unaffected_weeks": 42.0},
        "utpi": {"slope_per_week": -0.010, "ga_meets_unaffected_weeks": 42.0},
        "plgf": {"slope_per_week": 0.012, "ga_meets_unaffected_weeks": 42.0},
    },
    "covariance": {
        "order": ["map", "utpi", "plgf"],
        "sd": [0.035, 0.11, 0.20],
        "correlation": [[1.0, -0.05, -0.02], [-0.05, 1.0, -0.10], [-0.02, -0.10, 1.0]],
    },
}


@pytest.fixture
def coef():
    return coefficients.load()


@pytest.fixture
def coef_with_test_likelihood(coef):
    data = copy.deepcopy(coef.data)
    data["label"] = "TEST-ONLY"
    data["likelihood"] = copy.deepcopy(TEST_ONLY_LIKELIHOOD)
    return coefficients.from_dict(data)


@pytest.fixture
def reference_woman():
    """Reference group of Wright 2015 and of the MoM equations."""
    return MaternalFactors(age_years=35, weight_kg=69, height_cm=164, ethnicity=Ethnicity.WHITE)
