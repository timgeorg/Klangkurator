"""Tag model matching src/lib/storage.ts Tag interface."""

from pydantic import BaseModel


class TagBase(BaseModel):
    name: str
    color: str


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class Tag(TagBase):
    id: str
    created_at: str
