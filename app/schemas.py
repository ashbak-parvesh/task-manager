from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import Priority



# Shared config – all response schemas inherit this so ORM objects work

class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


 
# User schemas
 

class UserCreate(BaseModel):
    """Payload for POST /register"""
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_]+$",
        examples=["john_doe"],
    )
    email: EmailStr = Field(..., examples=["john@example.com"])
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        examples=["Str0ng!Pass"],
    )

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v


class UserResponse(ORMBase):
    """Returned after register or when fetching profile"""
    id: int
    username: str
    email: EmailStr
    is_active: bool
    created_at: datetime


 
# Auth / Token schemas
 

class TokenResponse(BaseModel):
    """Returned after successful login"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded JWT payload — used internally"""
    user_id: Optional[int] = None
    username: Optional[str] = None


 
# Task schemas
 

class TaskCreate(BaseModel):
    """Payload for POST /tasks"""
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        examples=["Buy groceries"],
    )
    description: Optional[str] = Field(
        default=None,
        max_length=2000,
        examples=["Milk, eggs, bread"],
    )
    priority: Priority = Field(default=Priority.medium, examples=["medium"])
    due_date: Optional[datetime] = Field(default=None, examples=["2025-12-31T18:00:00Z"])


class TaskUpdate(BaseModel):
    """Payload for PUT /tasks/{id} — all fields optional (partial update)"""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    completed: Optional[bool] = None
    priority: Optional[Priority] = None
    due_date: Optional[datetime] = None


class TaskResponse(ORMBase):
    """Returned for any single task"""
    id: int
    title: str
    description: Optional[str]
    completed: bool
    priority: Priority
    due_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    owner_id: int


 
# Pagination wrapper
 
class PaginatedTasks(BaseModel):
    """Wrapper returned by GET /tasks"""
    total: int = Field(..., description="Total tasks matching the filter")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
    items: list[TaskResponse]


 
# Generic message response
 

class MessageResponse(BaseModel):
    """Used for simple success / info messages"""
    message: str