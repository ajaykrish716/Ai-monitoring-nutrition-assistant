"""
Generic async client for the OpenRouter chat completions API.

This service has NO knowledge of specific questions, goals, or fields.
It simply sends structured chat messages and returns parsed responses.
"""

import asyncio
import json
import logging

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Retry configuration for transient 402 "in_flight_budget_exhausted" errors
_MAX_RETRIES = 2
_RETRY_BASE_DELAY = 2.0  # seconds


class AIServiceError(Exception):
    """Base exception raised when the AI service fails to produce a valid response."""


class AICreditLimitError(AIServiceError):
    """Raised when the AI provider rejects the request due to insufficient credits or token budget."""


class AIRateLimitError(AIServiceError):
    """Raised when the AI provider rate limit is exceeded."""


class AIAuthenticationError(AIServiceError):
    """Raised when authentication with the AI provider fails."""


def _is_transient_402(response_text: str) -> bool:
    """Check if a 402 error is a transient in-flight budget issue (retryable)."""
    return "in_flight" in response_text.lower()


async def chat_completion(
    messages: list[dict],
    *,
    response_format: dict | None = None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
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
    max_tokens : int, optional
        Maximum tokens in the response. Defaults to OPENROUTER_MAX_TOKENS.

    Returns
    -------
    dict
        Parsed JSON from the assistant message content.

    Raises
    ------
    AICreditLimitError
        If the provider reports insufficient credits or token allocation (402).
    AIRateLimitError
        If the provider reports rate limiting (429).
    AIAuthenticationError
        If the provider rejects credentials (401).
    AIServiceError
        If the request fails for other reasons or the response cannot be parsed.
    """
    settings = get_settings()

    if not settings.openrouter_api_key:
        raise AIServiceError(
            "OPENROUTER_API_KEY is not configured. "
            "Add it to server/.env to enable AI features."
        )

    # Centralized default: use environment setting if not explicitly overridden
    resolved_max_tokens = max_tokens if max_tokens is not None else settings.openrouter_max_tokens

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }

    payload: dict = {
        "model": settings.openrouter_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": resolved_max_tokens,
    }

    if response_format is not None:
        payload["response_format"] = response_format

    url = f"{settings.openrouter_base_url.rstrip('/')}/chat/completions"

    logger.info(
        "OpenRouter request started [model=%s, max_tokens=%d, temp=%.2f]",
        settings.openrouter_model,
        resolved_max_tokens,
        temperature,
    )

    last_exc = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
            break  # success
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            resp_text = exc.response.text

            if status_code == 402:
                # Transient in-flight budget errors can be retried after a brief wait
                if _is_transient_402(resp_text) and attempt < _MAX_RETRIES:
                    delay = _RETRY_BASE_DELAY * (attempt + 1)
                    logger.warning(
                        "OpenRouter 402 in-flight budget exhausted (attempt %d/%d), retrying in %.1fs",
                        attempt + 1, _MAX_RETRIES + 1, delay,
                    )
                    await asyncio.sleep(delay)
                    last_exc = exc
                    continue

                logger.error("OpenRouter 402 credit/token limit error: %s", resp_text[:300])
                raise AICreditLimitError(
                    "AI service is temporarily unavailable because the configured AI credit limit has been reached. Please try again later."
                ) from exc
            elif status_code == 401:
                logger.error("OpenRouter 401 authentication error: API key invalid or unauthorized.")
                raise AIAuthenticationError(
                    "AI service authentication failed. Please verify provider credentials."
                ) from exc
            elif status_code == 429:
                # Rate limit — retry once after brief wait
                if attempt < _MAX_RETRIES:
                    delay = _RETRY_BASE_DELAY * (attempt + 1)
                    logger.warning("OpenRouter 429 rate limited (attempt %d/%d), retrying in %.1fs", attempt + 1, _MAX_RETRIES + 1, delay)
                    await asyncio.sleep(delay)
                    last_exc = exc
                    continue
                logger.error("OpenRouter 429 rate limit exceeded: %s", resp_text[:300])
                raise AIRateLimitError(
                    "AI service rate limit reached. Please wait a moment and try again."
                ) from exc
            elif status_code == 400:
                logger.error("OpenRouter 400 bad request: %s", resp_text[:300])
                raise AIServiceError("AI request was rejected due to invalid parameters.") from exc
            elif status_code in (500, 502, 503, 504):
                if attempt < _MAX_RETRIES:
                    delay = _RETRY_BASE_DELAY * (attempt + 1)
                    logger.warning("OpenRouter %d server error (attempt %d/%d), retrying in %.1fs", status_code, attempt + 1, _MAX_RETRIES + 1, delay)
                    await asyncio.sleep(delay)
                    last_exc = exc
                    continue
                logger.error("OpenRouter server failure [%d]: %s", status_code, resp_text[:200])
                raise AIServiceError("AI provider is currently experiencing issues. Please try again later.") from exc
            else:
                logger.error("OpenRouter API error [%d]: %s", status_code, resp_text[:200])
                raise AIServiceError(f"AI provider returned unexpected status {status_code}") from exc
        except httpx.RequestError as exc:
            if attempt < _MAX_RETRIES:
                delay = _RETRY_BASE_DELAY * (attempt + 1)
                logger.warning("OpenRouter connection failure (attempt %d/%d), retrying in %.1fs", attempt + 1, _MAX_RETRIES + 1, delay)
                await asyncio.sleep(delay)
                last_exc = exc
                continue
            logger.error("OpenRouter connection failure: %s", type(exc).__name__)
            raise AIServiceError("Failed to reach AI provider. Please check network connection.") from exc
    else:
        # All retries exhausted — raise last captured exception
        if last_exc is not None:
            if isinstance(last_exc, httpx.HTTPStatusError) and last_exc.response.status_code == 402:
                raise AICreditLimitError(
                    "AI service is temporarily unavailable because the configured AI credit limit has been reached. Please try again later."
                ) from last_exc
            raise AIServiceError("AI service request failed after retries.") from last_exc

    data = resp.json()
    logger.info("OpenRouter request successful [model=%s]", settings.openrouter_model)

    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        logger.error("Unexpected AI response structure: %s", str(data)[:300])
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
        logger.error("Failed to parse AI JSON response: %s", text[:300])
        raise AIServiceError("AI returned invalid JSON") from exc
