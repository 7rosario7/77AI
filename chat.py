import os
import asyncpg
import openai
from openai import AsyncOpenAI
from principles import principles

# Use the first entry in your principles list as the full system prompt
SYSTEM_PROMPT = principles[0]

# Read your OpenAI key once, at import time:
_API_KEY = os.getenv("OPENAI_API_KEY")
if not _API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY environment variable")

# Create a single shared client:
openai_client = AsyncOpenAI(api_key=_API_KEY)

async def reflect(db_pool: asyncpg.Pool, prompt: str, user_id: int, session_id: str, initial: bool = False):
    """
    - db_pool: asyncpg.Pool
    - prompt: the user’s input (or ignored if initial=True)
    - user_id, session_id: for storing/fetching history
    - initial=True ⇒ inject the SYSTEM_PROMPT at start
    """
    # 1) load history from the DB
    rows = await db_pool.fetch(
        "SELECT role, content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at",
        session_id, user_id
    )
    messages = [{"role": r["role"], "content": r["content"]} for r in rows]

    # 2) if new session, kick off with system prompt:
    if initial:
        messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})
    else:
        # record the incoming user message
        messages.append({"role": "user", "content": prompt})
        await db_pool.execute(
            "INSERT INTO messages (session_id, user_id, role, content, created_at) VALUES ($1,$2,$3,$4,now())",
            session_id, user_id, "user", prompt
        )

    # 3) call OpenAI
    resp = await openai_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=messages
    )
    assistant_msg = resp.choices[0].message.content

    # 4) persist the assistant’s reply
    await db_pool.execute(
        "INSERT INTO messages (session_id, user_id, role, content, created_at) VALUES ($1,$2,$3,$4,now())",
        session_id, user_id, "assistant", assistant_msg
    )

    return [{"role": "assistant", "content": assistant_msg}]
