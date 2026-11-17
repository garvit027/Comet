import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings
from app.models import User, UserRole, ApprovalStatus, SupplierProfile
from app.schemas.schemas import UserCreate, Token, LoginRequest, UserOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if payload.role == UserRole.BIDDER and not payload.company_name:
        raise HTTPException(status_code=400, detail="Company name is required for bidders")

    approval_status = ApprovalStatus.APPROVED
    if payload.role == UserRole.AUCTIONEER:
        if payload.approval_code and payload.approval_code == settings.auctioneer_approval_code:
            approval_status = ApprovalStatus.APPROVED
        elif settings.auto_approve_auctioneers:
            approval_status = ApprovalStatus.APPROVED
        else:
            approval_status = ApprovalStatus.PENDING

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
        full_name=payload.full_name,
        approval_status=approval_status,
        organization_name=payload.organization_name,
        department=payload.department,
    )
    db.add(user)
    db.flush()

    if payload.role == UserRole.BIDDER:
        profile = SupplierProfile(
            user_id=user.id,
            company_name=payload.company_name or payload.full_name,
            contact_person=payload.contact_person or payload.full_name,
            phone_number=payload.phone_number,
            business_category=payload.business_category,
            gstin=payload.gstin,
        )
        db.add(profile)

    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    company_name = None
    if user.role == UserRole.BIDDER:
        prof = db.query(SupplierProfile).filter(SupplierProfile.user_id == user.id).first()
        company_name = prof.company_name if prof else None
    return Token(
        access_token=token,
        role=user.role,
        approval_status=user.approval_status,
        user_id=user.id,
        full_name=user.full_name,
        company_name=company_name,
    )


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company_name = None
    supplier_profile_id = None
    if user.role == UserRole.BIDDER:
        prof = db.query(SupplierProfile).filter(SupplierProfile.user_id == user.id).first()
        if prof:
            company_name = prof.company_name
            supplier_profile_id = str(prof.id)
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "full_name": user.full_name,
        "approval_status": user.approval_status.value,
        "organization_name": user.organization_name,
        "department": user.department,
        "company_name": company_name,
        "supplier_profile_id": supplier_profile_id,
    }
