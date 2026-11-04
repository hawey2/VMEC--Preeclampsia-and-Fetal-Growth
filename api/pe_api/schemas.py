"""Request and response shapes for the assessment API."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, model_validator

from pe_risk import Analyser, Conception, Diabetes, Ethnicity
from pe_risk.dating import DatingMethod


class Patient(BaseModel):
    """Shown on the printed report only; not stored in phase 2."""

    name: str = ""
    pid: str = ""


class Dating(BaseModel):
    method: DatingMethod
    crl_mm: float | None = Field(None, ge=45, le=84)
    lmp: date | None = None
    edd: date | None = None
    transfer_date: date | None = None
    embryo_age_days: int | None = None
    weeks: int | None = Field(None, ge=0, le=45)
    days: int | None = Field(None, ge=0, le=6)

    @model_validator(mode="after")
    def _needs_fields(self):
        need = {
            DatingMethod.CRL: ["crl_mm"],
            DatingMethod.LMP: ["lmp"],
            DatingMethod.EDD: ["edd"],
            DatingMethod.IVF: ["transfer_date", "embryo_age_days"],
            DatingMethod.MANUAL: ["weeks", "days"],
        }.get(self.method)
        if need is None:
            raise ValueError(f"dating by {self.method.value.upper()} is not available yet; use CRL")
        missing = [f for f in need if getattr(self, f) is None]
        if missing:
            raise ValueError(f"dating by {self.method.value} needs: {', '.join(missing)}")
        return self


class Previous(BaseModel):
    had_pe: bool
    ga_at_delivery_weeks: float = Field(ge=24, le=44)
    delivery_date: date


class BiomarkerIn(BaseModel):
    map_readings: list[tuple[float, float]] | None = Field(
        None, description="(systolic, diastolic) pairs, normally two from each arm"
    )
    map_mmhg: float | None = Field(None, gt=40, lt=160)
    map_mom: float | None = Field(None, gt=0)
    utpi_left: float | None = Field(None, gt=0, lt=6)
    utpi_right: float | None = Field(None, gt=0, lt=6)
    utpi_mom: float | None = Field(None, gt=0)
    plgf_pg_ml: float | None = Field(None, gt=0, lt=2000)
    plgf_analyser: Analyser | None = None
    plgf_mom: float | None = Field(None, gt=0)


class AssessmentIn(BaseModel):
    patient: Patient = Patient()
    exam_date: date
    date_of_birth: date
    height_cm: float = Field(ge=120, le=210)
    weight_kg: float = Field(ge=30, le=200)
    ethnicity: Ethnicity
    smoker: bool = False
    dating: Dating
    conception: Conception = Conception.SPONTANEOUS
    vanishing_twin: bool = False
    chronic_hypertension: bool = False
    diabetes: Diabetes = Diabetes.NONE
    sle_or_aps: bool = False
    family_history_pe: bool = False
    previous: Previous | None = None
    biomarkers: BiomarkerIn = BiomarkerIn()

    @model_validator(mode="after")
    def _dates(self):
        if self.date_of_birth >= self.exam_date:
            raise ValueError("date of birth must be before the examination date")
        return self


class Risk(BaseModel):
    cutoff_weeks: float
    probability: float
    one_in: int


class ScreenResult(BaseModel):
    basis: str  # "combined" or "maternal_factors_only"
    cutoff_one_in: int
    high_risk: bool


class AssessmentOut(BaseModel):
    patient: Patient
    exam_date: date
    ga_days: float
    ga_label: str
    edd: date
    dating_method: DatingMethod
    age_years: float
    interval_years: float | None
    map_mmhg: float | None
    utpi_mean: float | None
    plgf_pg_ml: float | None
    plgf_analyser: Analyser | None
    moms: dict[str, float]
    maternal_factors_only: list[Risk]
    combined: list[Risk] | None
    markers_used: list[str]
    screen: ScreenResult
    model_label: str
    model_checksum: str
    warnings: list[str]
    generated_at: str
