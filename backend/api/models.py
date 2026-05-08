from pydantic import BaseModel
from typing import Optional, Any
import datetime


class ProjectCreate(BaseModel):
    name: str
    analyst: str = ""
    corridor_speed_mph: float = 35
    active_plan: str = "AM"
    intersections: list = []
    demand: dict = {}


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    analyst: Optional[str] = None
    corridor_speed_mph: Optional[float] = None
    active_plan: Optional[str] = None
    intersections: Optional[list] = None
    demand: Optional[dict] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    analyst: str
    created: str
    updated: str
    corridor_speed_mph: float
    active_plan: str
    intersections: list
    demand: dict

    class Config:
        from_attributes = True
