import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import current_user, require_admin
from app.db.session import get_db
from app.models.location import Location
from app.models.risk_event import RiskEvent
from app.models.user import User
from app.schemas.location import LocationCreate, LocationRead, LocationSummary

router = APIRouter(prefix="/locations", tags=["locations"])


@router.post("", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create_location(
    request: LocationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
) -> Location:
    """Register a site. Any signed-in account may — this is the same bar as
    submitting telemetry, not an admin action; the platform is meant to grow
    by operators adding their own junctions/cameras, not by a gatekeeper."""
    location = Location(
        name=request.name,
        description=request.description,
        latitude=request.latitude,
        longitude=request.longitude,
        created_by=user.id,
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


@router.get("", response_model=list[LocationSummary])
async def list_locations(db: AsyncSession = Depends(get_db)) -> list[LocationSummary]:
    """Every registered site, each with a live rollup. Public, like every
    other read in this API — an operator's junction list is not a secret.

    One query per location for the rollup rather than a single grouped join:
    the expected count here is tens to low hundreds of sites, not millions of
    events, so the simple, obviously-correct version is the right one — the
    same pragmatic call ai/blackspot/engine.py makes aggregating in Python
    rather than reaching for PostGIS at this scale.
    """
    result = await db.execute(select(Location).order_by(Location.created_at.desc()))
    locations = list(result.scalars().all())

    summaries: list[LocationSummary] = []
    for loc in locations:
        agg = await db.execute(
            select(RiskEvent)
            .where(RiskEvent.location_id == loc.id)
            .order_by(RiskEvent.created_at.desc())
            .limit(1)
        )
        latest = agg.scalar_one_or_none()
        count_result = await db.execute(
            select(RiskEvent.id).where(RiskEvent.location_id == loc.id)
        )
        summaries.append(
            LocationSummary(
                **LocationRead.model_validate(loc).model_dump(),
                event_count=len(count_result.all()),
                latest_risk_score=latest.risk_score if latest else None,
                latest_risk_level=latest.risk_level if latest else None,
                latest_event_at=latest.created_at if latest else None,
            )
        )
    return summaries


@router.get("/{location_id}", response_model=LocationSummary)
async def get_location(location_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> LocationSummary:
    location = await db.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such location")

    agg = await db.execute(
        select(RiskEvent)
        .where(RiskEvent.location_id == location_id)
        .order_by(RiskEvent.created_at.desc())
        .limit(1)
    )
    latest = agg.scalar_one_or_none()
    count_result = await db.execute(select(RiskEvent.id).where(RiskEvent.location_id == location_id))
    return LocationSummary(
        **LocationRead.model_validate(location).model_dump(),
        event_count=len(count_result.all()),
        latest_risk_score=latest.risk_score if latest else None,
        latest_risk_level=latest.risk_level if latest else None,
        latest_event_at=latest.created_at if latest else None,
    )


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> None:
    """Admin-only, same bar as DELETE /risk/events/{id} — removing a site
    that hundreds of events may reference is a correction, not routine
    housekeeping. Events referencing it are not deleted (location_id just
    goes NULL via ondelete=SET NULL on the FK); their telemetry is real and
    stays, only the site label is gone."""
    location = await db.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No such location")
    await db.delete(location)
    await db.commit()
