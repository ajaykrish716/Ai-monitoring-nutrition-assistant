"""
Generic async client for the OpenRouter chat completions API.

This service has NO knowledge of specific questions, goals, or fields.
It simply sends structured chat messages and returns parsed responses.
"""

import json
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AIServiceError(Exception):
    """Raised when the AI service fails to produce a valid response."""


async def chat_completion(
    messages: list[dict],
    *,
    response_format: dict | None = None,
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> dict:
    """
    Send a chat completion request to OpenRouter and return the parsed
    JSON content from the assistant's reply.

    Parameters
    ----------
    messages : list[dict]
        OpenAI-compatible message list (role + content).
    response_format : dict, optional
        If provided, request structured JSON output.
    temperature : float
        Sampling temperature.
    max_tokens : int
        Maximum tokens in the response.

    Returns
    -------
    dict
        Parsed JSON from the assistant message content.

    Raises
    ------
    AIServiceError
        If the request fails or the response cannot be parsed.
    """
    settings = get_settings()

    if not settings.openrouter_api_key:
        raise AIServiceError(
            "OPENROUTER_API_KEY is not configured. "
            "Add it to server/.env to enable AI features."
        )

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }

    payload: dict = {
        "model": settings.openrouter_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    if response_format is not None:
        payload["response_format"] = response_format

    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("OpenRouter API error: %s — %s", exc.response.status_code, exc.response.text)
        raise AIServiceError(f"AI provider returned status {exc.response.status_code}") from exc
    except httpx.RequestError as exc:
        logger.error("OpenRouter request failed: %s", exc)
        raise AIServiceError("Failed to reach AI provider") from exc

    data = resp.json()

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected AI response structure: %s", data)
        raise AIServiceError("AI returned an unexpected response structure") from exc

    # Parse JSON from the content — strip markdown fences if present
    text = content.strip()
    if text.startswith("```"):
        # Remove ```json ... ``` wrapper
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse AI JSON response: %s", text[:500])
        raise AIServiceError("AI returned invalid JSON") from exc
