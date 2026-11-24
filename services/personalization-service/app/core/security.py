from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from app.core.jwt_keys import verify_access_token

# HTTPBearer automatically extracts the "Authorization: Bearer <token>" header
security_scheme = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    token = credentials.credentials
    try:
        # Decode the JWT using the secret key and HS256 algorithm
        payload = verify_access_token(token)
        
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject (sub)",
            )
            
        # Return dictionary mimicking NestJS validation return shape
        return {
            "userId": user_id,
            "email": email,
            "role": role
        }
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
