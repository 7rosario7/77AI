import datetime
from openai import AsyncOpenAI

openai = AsyncOpenAI()

async def reflect(pool, prompt: str, user_id: str, session_id: str):
    # load prior messages
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT role, content
              FROM messages
             WHERE user_id=$1
               AND session_id=$2
             ORDER BY created_at
            """,
            user_id, session_id
        )
    history = [{"role": r["role"], "content": r["content"]} for r in rows]
    history.append({"role": "user", "content": prompt})

    # call OpenAI
    resp = await openai.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=history
    )
    ai_msg = resp.choices[0].message.content

    # persist both
    now = datetime.datetime.utcnow()
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO messages (user_id,session_id,role,content,created_at)
            VALUES ($1,$2,$3,$4,$5)
            """,
            [
                (user_id, session_id, "user", prompt, now),
                (user_id, session_id, "assistant", ai_msg, now),
            ]
        )

    return [
        {"role": "user",      "content": prompt},
        {"role": "assistant", "content": ai_msg},
    ]
