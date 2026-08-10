"""Blocks CRUD endpoints."""

from fastapi import APIRouter, HTTPException

from backend.models.block import Block, BlockCreate, BlockUpdate
from backend.storage import get_blocks_store

router = APIRouter(prefix="/api/blocks", tags=["blocks"])


@router.get("", response_model=list[Block])
def list_blocks():
    store = get_blocks_store()
    return store.get_blocks()


@router.get("/{block_id}", response_model=Block)
def get_block(block_id: str):
    store = get_blocks_store()
    block = store.get_block(block_id)
    if block is None:
        raise HTTPException(404, "Block not found")
    return block


@router.post("", response_model=Block, status_code=201)
def create_block(body: BlockCreate):
    store = get_blocks_store()
    return store.add_block(body.model_dump())


@router.put("/{block_id}", response_model=Block)
def update_block(block_id: str, body: BlockUpdate):
    store = get_blocks_store()
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    block = store.update_block(block_id, updates)
    if block is None:
        raise HTTPException(404, "Block not found")
    return block


@router.delete("/{block_id}", status_code=204)
def delete_block(block_id: str):
    store = get_blocks_store()
    if not store.delete_block(block_id):
        raise HTTPException(404, "Block not found")
