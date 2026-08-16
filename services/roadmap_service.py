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

    # 3. Call LLM
    llm_raw_output = generate_llm_response(prompt)

    try:
        roadmap_json = json.loads(llm_raw_output)
    except json.JSONDecodeError:
        roadmap_json = {"raw_output": llm_raw_output}

    # 4. Save to Supabase 'learning_roadmaps' table
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
        .execute()
    )
    return response.data