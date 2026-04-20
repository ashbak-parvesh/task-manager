import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Priority, Task, User
from app.schemas import (
    MessageResponse,
    PaginatedTasks,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# ---------------------------------------------------------------------------
# Helper – fetch task or 404
# ---------------------------------------------------------------------------
async def _get_task_or_404(task_id: int, user: User, db: AsyncSession) -> Task:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.owner_id == user.id)
    )
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with id={task_id} not found.",
        )
    return task


# ---------------------------------------------------------------------------
# CREATE TASK
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:

    task = Task(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        due_date=payload.due_date,
        owner_id=current_user.id,
    )

    db.add(task)
    await db.commit()        # ✅ FIX
    await db.refresh(task)

    return task


# ---------------------------------------------------------------------------
# LIST TASKS (IMPORTANT FIX AREA)
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=PaginatedTasks,
    status_code=status.HTTP_200_OK,
)
async def list_tasks(
    completed: Optional[bool] = Query(None),
    priority: Optional[Priority] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    base_query = select(Task).where(Task.owner_id == current_user.id)

    if completed is not None:
        base_query = base_query.where(Task.completed == completed)

    if priority is not None:
        base_query = base_query.where(Task.priority == priority)

    if search:
        base_query = base_query.where(Task.title.ilike(f"%{search}%"))

    # total count
    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar_one()

    offset = (page - 1) * page_size

    tasks_result = await db.execute(
        base_query.order_by(Task.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )

    tasks = tasks_result.scalars().all()

    return PaginatedTasks(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
        items=tasks,
    )


# ---------------------------------------------------------------------------
# GET SINGLE TASK
# ---------------------------------------------------------------------------
@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_task_or_404(task_id, current_user, db)


# ---------------------------------------------------------------------------
# UPDATE TASK
# ---------------------------------------------------------------------------
@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    task = await _get_task_or_404(task_id, current_user, db)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    await db.commit()        # ✅ FIX
    await db.refresh(task)

    return task


# ---------------------------------------------------------------------------
# DELETE TASK
# ---------------------------------------------------------------------------
@router.delete("/{task_id}", response_model=MessageResponse)
async def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    task = await _get_task_or_404(task_id, current_user, db)

    await db.delete(task)
    await db.commit()        # ✅ FIX

    return MessageResponse(message="Task deleted successfully")