import aiosqlite
import json
import uuid
from datetime import date
from typing import Optional

DB_PATH = "/Users/lucasferreira/Desktop/my_traffic_sim/backend/traffic_sim.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                analyst TEXT DEFAULT '',
                created TEXT NOT NULL,
                updated TEXT NOT NULL,
                data TEXT NOT NULL
            )
        """)
        await db.commit()


async def list_projects() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, name, analyst, created, updated, data FROM projects ORDER BY updated DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            result = []
            for row in rows:
                project = json.loads(row["data"])
                project["id"] = row["id"]
                project["name"] = row["name"]
                project["analyst"] = row["analyst"]
                project["created"] = row["created"]
                project["updated"] = row["updated"]
                result.append(project)
            return result


async def create_project(name: str, analyst: str, extra_data: dict) -> dict:
    project_id = str(uuid.uuid4())
    today = str(date.today())
    project = {
        "id": project_id,
        "name": name,
        "analyst": analyst,
        "created": today,
        "updated": today,
        "corridor_speed_mph": extra_data.get("corridor_speed_mph", 35),
        "active_plan": extra_data.get("active_plan", "AM"),
        "intersections": extra_data.get("intersections", []),
        "demand": extra_data.get("demand", {}),
    }
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO projects (id, name, analyst, created, updated, data) VALUES (?, ?, ?, ?, ?, ?)",
            (project_id, name, analyst, today, today, json.dumps(project)),
        )
        await db.commit()
    return project


async def get_project(project_id: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT data FROM projects WHERE id = ?", (project_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row is None:
                return None
            return json.loads(row["data"])


async def update_project(project_id: str, updates: dict) -> Optional[dict]:
    existing = await get_project(project_id)
    if existing is None:
        return None
    today = str(date.today())
    for key, value in updates.items():
        if value is not None:
            existing[key] = value
    existing["updated"] = today
    existing["id"] = project_id
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE projects SET name = ?, analyst = ?, updated = ?, data = ? WHERE id = ?",
            (
                existing.get("name", ""),
                existing.get("analyst", ""),
                today,
                json.dumps(existing),
                project_id,
            ),
        )
        await db.commit()
    return existing


async def delete_project(project_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM projects WHERE id = ?", (project_id,)
        )
        await db.commit()
        return cursor.rowcount > 0
