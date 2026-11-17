from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_token
from app.models import User, UserRole, ApprovalStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload:
        raise credentials_exception
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise credentials_exception
    return user


def require_approved(user: User = Depends(get_current_user)) -> User:
    if user.approval_status != ApprovalStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Account pending approval")
    return user


def require_auctioneer(user: User = Depends(require_approved)) -> User:
    if user.role != UserRole.AUCTIONEER:
        raise HTTPException(status_code=403, detail="Auctioneer access required")
    return user


def require_bidder(user: User = Depends(require_approved)) -> User:
    if user.role != UserRole.BIDDER:
        raise HTTPException(status_code=403, detail="Bidder access required")
    return user
