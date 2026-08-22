import os
from dotenv import load_dotenv
from google import genai
from groq import Groq

load_dotenv()

# Initialize Clients
gemini_api_key = os.getenv("GEMINI_API_KEY")
groq_api_key = os.getenv("GROQ_API_KEY")

gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

def call_llm(prompt: str, provider: str = "gemini", model: str = None) -> str:
    """
    Unified LLM caller for Gemini and Groq.
    """
    if provider == "gemini":
        if not gemini_client:
            raise ValueError("GEMINI_API_KEY is not set.")
        model_name = model or "gemini-3.5-flash"
        response = gemini_client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        return response.text

    elif provider == "groq":
        if not groq_client:
            raise ValueError("GROQ_API_KEY is not set.")
        model_name = model or "llama-3.3-70b-versatile"
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=model_name,
        )
        return chat_completion.choices[0].message.content

    else:
        raise ValueError(f"Unsupported provider: {provider}")