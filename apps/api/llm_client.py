import os
from dotenv import load_dotenv
from google import genai
from groq import Groq

load_dotenv()

gemini_api_key = os.getenv("GEMINI_API_KEY")
groq_api_key = os.getenv("GROQ_API_KEY")


class LLMClient:
    """
    Singleton wrapper around the Gemini/Groq SDK clients.
    Lazily initializes each client on first use so importing this module
    never fails just because one of the two API keys is missing.
    """

    def __init__(self):
        self._gemini = None
        self._groq = None

    @property
    def gemini(self):
        if self._gemini is None:
            if not gemini_api_key:
                raise ValueError("GEMINI_API_KEY is not set. Check your .env file.")
            self._gemini = genai.Client(api_key=gemini_api_key)
        return self._gemini

    @property
    def groq(self):
        if self._groq is None:
            if not groq_api_key:
                raise ValueError("GROQ_API_KEY is not set. Check your .env file.")
            self._groq = Groq(api_key=groq_api_key)
        return self._groq

    def generate_structured_data(self, prompt: str, provider: str = "gemini",
                                 model: str = None) -> str:
        """
        Used for heavy analysis, structured parsing, and resume processing.
        Can route to Gemini or Groq depending on provider.
        """
        if provider == "gemini":
            response = self.gemini.models.generate_content(
                model=model or "gemini-3.5-flash",
                contents=prompt,
            )
            return response.text
        elif provider == "groq":
            response = self.groq.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=model or "llama-3.3-70b-versatile",
            )
            return response.choices[0].message.content
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    def generate_chat_response(self, prompt: str,
                               model: str = "llama-3.3-70b-versatile") -> str:
        """Ultra-fast, low-latency conversational responses (Groq)."""
        response = self.groq.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=model,
        )
        return response.choices[0].message.content


# Singleton instance
llm_client = LLMClient()


def call_llm(prompt: str, provider: str = "gemini", model: str = None) -> str:
    """
    Legacy functional entry point, kept for backwards compatibility.
    """
    return llm_client.generate_structured_data(prompt, provider=provider, model=model)
