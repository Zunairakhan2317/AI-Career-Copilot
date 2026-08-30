from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from database import supabase
# 1. Added 'roadmap' import here
from routers import resume, job_match, roadmap


app = FastAPI(
    title="AI Career Co-Pilot API",
    version="1.0.0",
    description="Backend API for AI Career Co-Pilot"
)


# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "AI Career Co-Pilot API is running!"}


@app.get("/health")
def health_check():
    return {"status": "Backend Active"}


@app.get("/api/test-db")
def test_db_connection():
    try:
        demo_email = "demo_test@aicareercopilot.com"

        # Check if the demo user already exists before inserting, so repeated
        # calls to this test endpoint don't hit the users_email_key unique
        # constraint.
        existing = (
            supabase
            .table("users")
            .select("*")
            .eq("email", demo_email)
            .limit(1)
            .execute()
        )

        if existing.data:
            return {
                "status": "Database Connected Successfully! (demo user already existed)",
                "inserted_record": existing.data
            }

        demo_user = {
            "email": demo_email,
            "full_name": "Demo Team Member"
        }

        response = (
            supabase
            .table("users")
            .insert(demo_user)
            .execute()
        )

        return {
            "status": "Database Connected Successfully!",
            "inserted_record": response.data
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# Register routers
app.include_router(resume.router, prefix="/api")
app.include_router(job_match.router, prefix="/api")
# 2. Registered Task 4 roadmap router here
app.include_router(roadmap.router, prefix="/api")