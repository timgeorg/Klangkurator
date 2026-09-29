"""APIRouter aggregation — includes all sub-routers."""

from fastapi import APIRouter

from .songs import router as songs_router
from .tags import router as tags_router
from .relationships import router as relationships_router
from .blocks import router as blocks_router
from .sets import router as sets_router
from .library import router as library_router
from .audio import router as audio_router
from .artwork import router as artwork_router
from .misc import router as misc_router

router = APIRouter()
router.include_router(songs_router)
router.include_router(tags_router)
router.include_router(relationships_router)
router.include_router(blocks_router)
router.include_router(sets_router)
router.include_router(library_router)
router.include_router(audio_router)
router.include_router(artwork_router)
router.include_router(misc_router)