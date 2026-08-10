"""DJSet model with phase-based set planning support."""

from pydantic import BaseModel


class AltTransition(BaseModel):
    ref_id: str
    label: str | None = None


class SetItem(BaseModel):
    id: str
    type: str  # "song" | "block"
    ref_id: str  # song_id or block_id
    position: int
    transition_notes: str | None = None
    alternative_transitions: list[AltTransition] = []


class SetPhase(BaseModel):
    id: str
    name: str
    position: int
    target_duration_min: int | None = None
    notes: str | None = None
    items: list[SetItem] = []


class DJSetBase(BaseModel):
    name: str
    description: str | None = None
    color: str
    # Legacy flat model (backward compat)
    items: list[SetItem] = []
    # New phase-based model
    phases: list[SetPhase] = []
    # Set planning fields
    event_name: str | None = None
    event_date: str | None = None
    target_duration_min: int | None = None
    crates: list[str] = []
    notes: str | None = None


class DJSetCreate(DJSetBase):
    pass


class DJSetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    items: list[SetItem] | None = None
    phases: list[SetPhase] | None = None
    event_name: str | None = None
    event_date: str | None = None
    target_duration_min: int | None = None
    crates: list[str] | None = None
    notes: str | None = None


class DJSet(DJSetBase):
    id: str
    created_at: str
    updated_at: str
