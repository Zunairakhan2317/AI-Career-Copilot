from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.roadmap_service import (
    generate_roadmap_for_user,
    get_roadmap_by_user,
)

router = APIRouter(prefix="/roadmap", tags=["Roadmap"])


class RoadmapRequest(BaseModel):
    user_id: str
    target_role: str


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
