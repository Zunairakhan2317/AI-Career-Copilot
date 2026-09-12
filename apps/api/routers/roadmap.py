from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from services.roadmap_service import (
    generate_roadmap_for_user,
    get_roadmap_by_user,
    get_roadmap_by_id,
    update_completed_milestones,
)

router = APIRouter(prefix="/roadmap", tags=["Roadmap"])


class RoadmapRequest(BaseModel):
    user_id: str
    target_role: str


class CompletedMilestonesRequest(BaseModel):
    completed_milestones: List[int]


@router.post("/generate")
def generate_roadmap(payload: RoadmapRequest):
    try:
        data = generate_roadmap_for_user(
            user_id=payload.user_id, target_role=payload.target_role
        )
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}")
def fetch_roadmap(user_id: str):
    try:
        data = get_roadmap_by_user(user_id)
        if not data:
            raise HTTPException(
                status_code=444, detail="No roadmap found for this user.")
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/{roadmap_id}")
def fetch_single_roadmap(user_id: str, roadmap_id: str):
    try:
        data = get_roadmap_by_id(roadmap_id, user_id)
        if not data:
            raise HTTPException(
                status_code=404, detail="Roadmap not found for this user.")
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{roadmap_id}/milestones")
def patch_completed_milestones(roadmap_id: str, payload: CompletedMilestonesRequest):
    try:
        data = update_completed_milestones(roadmap_id, payload.completed_milestones)
        if not data:
            raise HTTPException(status_code=404, detail="Roadmap not found.")
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
