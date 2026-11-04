from pe_risk import coefficients


def test_every_component_names_its_source_and_status(coef):
    levels = set(coef.data["verification_levels"])
    for comp in ("prior", "mom", "likelihood", "truncation", "dating"):
        assert coef.data[comp]["source"], comp
        assert coef.verification(comp) in levels, comp


def test_nothing_is_marked_clinical_ready_yet(coef):
    """Flip a component to 'verified' only after a second person checks it
    against the printed paper; this test then needs updating on purpose."""
    for comp in ("prior", "mom", "likelihood"):
        assert not coef.is_clinical_ready(comp)
    assert not coef.has_likelihood()


def test_checksum_is_stable(coef):
    assert coefficients.load().checksum == coef.checksum
