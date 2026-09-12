from fastapi import APIRouter, HTTPException
from services.interview_service import (
    start_interview_session,
    send_message,
    end_interview_session,
    get_user_sessions,
    fetch_session,
)
from schemas import (
    InterviewStartRequest,
    InterviewMessageRequest,
    InterviewEndRequest,
)


router = APIRouter(prefix="/interview", tags=["interview"])


@router.post("/start")
def start(payload: InterviewStartRequest):
    try:
        return start_interview_session(
            user_id=payload.user_id,
            job_description=payload.job_description,
            resume_id=payload.resume_id,
            target_role=payload.target_role,
            total_questions=payload.total_questions,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/message")
def message(payload: InterviewMessageRequest):
    try:
        return send_message(
            session_id=payload.session_id,
            user_id=payload.user_id,
            user_message=payload.user_message,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/end")
def end(payload: InterviewEndRequest):
    try:
        return end_interview_session(
            session_id=payload.session_id,
            user_id=payload.user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{user_id}")
def list_sessions(user_id: str):
    try:
        return {"status": "success", "data": get_user_sessions(user_id)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{user_id}/{session_id}")
def get_one(user_id: str, session_id: str):
    try:
        data = fetch_session(session_id, user_id)
        if not data:
            raise HTTPException(status_code=404, detail="Session not found.")
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
