import os
from dotenv import load_dotenv
from pathlib import Path
from google import genai
from groq import Groq

# Always load .env from this file's directory (apps/api/.env), regardless of CWD
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

# Initialize Clients
gemini_api_key = os.getenv("GEMINI_API_KEY")
groq_api_key = os.getenv("GROQ_API_KEY")

gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

print(f"[llm] GEMINI_API_KEY loaded: {bool(gemini_api_key)}, GROQ_API_KEY loaded: {bool(groq_api_key)}")


def call_llm(prompt: str, provider: str = "auto", model: str = None) -> str:
    """
    Unified LLM caller. Defaults to the first available provider:
    1. Groq (fast, free tier, open models) — preferred
    2. Gemini (fallback if no Groq key)

    Tries multiple model names per provider as fallbacks.
    """
    # Determine which provider to use
    use_groq = False
    use_gemini = False

    if provider == "auto":
        use_groq = bool(groq_client)
        use_gemini = bool(gemini_client) and not use_groq
    elif provider == "groq":
        use_groq = True
    elif provider == "gemini":
        use_gemini = True
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    if use_groq:
        if not groq_client:
            raise ValueError("GROQ_API_KEY is not set.")

        # Keep generation on known chat models. The model catalog can also
        # contain audio, moderation, or embedding models that should not be
        # selected for conversational responses.
        candidates = []
        if model:
            candidates.append(model)

        # Static fallbacks in priority order.
        for fallback in [
            "llama-3.1-8b-instant",
            "llama-3.3-70b-versatile",
            "llama-3.1-70b-versatile",
        ]:
            if fallback not in candidates:
                candidates.append(fallback)

        last_error = None
        for model_name in candidates:
            if not model_name:
                continue
            try:
                chat_completion = groq_client.chat.completions.create(
                    messages=[{"role": "user", "content": prompt}],
                    model=model_name,
                )
                print(f"[llm] groq ok with model: {model_name}")
                return chat_completion.choices[0].message.content
            except Exception as e:
                last_error = e
                print(f"[llm] groq {model_name} failed: {str(e)[:120]}")
                continue
        # If groq fails entirely, try gemini as last resort
        if gemini_client:
            print("[llm] groq exhausted all models, falling back to gemini")
            return call_llm(prompt, provider="gemini", model=model)
        raise RuntimeError(
            f"Groq failed. Check that your API key has model access at "
            f"https://console.groq.com/keys. Last error: {last_error}"
        )

    if use_gemini:
        if not gemini_client:
            raise ValueError("GEMINI_API_KEY is not set.")
        candidates = [model] if model else []

        # Use models enabled for this key when the SDK exposes the catalog.
        # This avoids relying on retired model names as the API evolves.
        if not model:
            try:
                for available in gemini_client.models.list():
                    name = getattr(available, "name", "") or ""
                    actions = getattr(available, "supported_actions", None)
                    if (
                        name.startswith("models/gemini")
                        and (not actions or "generateContent" in actions)
                    ):
                        candidates.append(name.removeprefix("models/"))
            except Exception as e:
                print(f"[llm] gemini models.list() failed: {str(e)[:120]}")

        # Keep current known fallbacks for SDKs/accounts where listing is
        # unavailable or returns no generation-capable models.
        for fallback in [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash-001",
            "gemini-flash-latest",
        ]:
            if fallback not in candidates:
                candidates.append(fallback)
        last_error = None
        for model_name in candidates:
            if not model_name:
                continue
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                )
                print(f"[llm] gemini ok with model: {model_name}")
                return response.text
            except Exception as e:
                last_error = e
                print(f"[llm] gemini {model_name} failed: {str(e)[:120]}")
                continue
        raise RuntimeError(
            f"LLM failed. Last gemini error: {last_error}. "
            f"Get a valid key at https://aistudio.google.com/apikey (starts with AIzaSy...)"
        )

    raise ValueError("No LLM provider available. Set GROQ_API_KEY or GEMINI_API_KEY in .env")


# Alias exports to bridge differences across team services
llm_client = gemini_client or groq_client
generate_llm_response = call_llm