import json
from database import supabase
from llm_client import generate_llm_response  # Adjust import if function name differs


def generate_roadmap_for_user(user_id: str, target_role: str):
    # 1. Fetch user's existing skills from Supabase
    skills_response = (
        supabase.table("skills").select("*").eq("user_id", user_id).execute()
    )

    existing_skills = [
        item["skill_name"] for item in skills_response.data
    ] if skills_response.data else []

    # 2. Construct LLM prompt for gap analysis and roadmap
    prompt = f"""
    You are an AI Career Coach.
    User's current skills: {', '.join(existing_skills) if existing_skills else 'None listed'}
    User's target role: {target_role}

    Perform a skill gap analysis and output a personalized learning roadmap.
    Return ONLY a valid JSON object matching this exact structure:
    {{
        "missing_skills": ["skill1", "skill2"],
        "roadmap": [
            {{
                "milestone": "Phase 1: Foundations",
                "target_timeline": "2 weeks",
                "topics": ["topic1", "topic2"],
                "resource_links": ["https://example.com"]
            }}
        ]
    }}
    """

    # 3. Call LLM (use provider="auto" -> Groq preferred, Gemini fallback)
    llm_raw_output = generate_llm_response(prompt, provider="auto")

    try:
        roadmap_json = json.loads(llm_raw_output)
    except json.JSONDecodeError:
        roadmap_json = {"raw_output": llm_raw_output}

    # 4. Ensure completed_milestones array exists (Option A — store inside roadmap_data jsonb)
    if "completed_milestones" not in roadmap_json:
        roadmap_json["completed_milestones"] = []

    # 5. Save to Supabase 'learning_roadmaps' table
    data_to_insert = {
        "user_id": user_id,
        "target_role": target_role,
        "roadmap_data": roadmap_json,
    }

    insert_response = (
        supabase.table("learning_roadmaps").insert(data_to_insert).execute()
    )

    return insert_response.data


def get_roadmap_by_user(user_id: str):
    response = (
        supabase.table("learning_roadmaps")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return response.data


def get_roadmap_by_id(roadmap_id: str, user_id: str):
    """Fetch a single roadmap, scoped to the user (security check)."""
    response = (
        supabase.table("learning_roadmaps")
        .select("*")
        .eq("id", roadmap_id)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else None


def update_completed_milestones(roadmap_id: str, completed_milestones: list[int]):
    """
    PATCH endpoint helper — merge the new completed_milestones list
    into the existing roadmap_data jsonb column (Option A).
    """
    # 1. Fetch current roadmap_data
    response = (
        supabase.table("learning_roadmaps")
        .select("roadmap_data")
        .eq("id", roadmap_id)
        .execute()
    )
    if not response.data:
        return None

    current_data = response.data[0].get("roadmap_data") or {}
    current_data["completed_milestones"] = list(completed_milestones)

    # 2. Write back
    update_response = (
        supabase.table("learning_roadmaps")
        .update({"roadmap_data": current_data})
        .eq("id", roadmap_id)
        .execute()
    )
    return update_response.data[0] if update_response.data else None
