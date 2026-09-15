from pydantic import BaseModel


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionRequest(BaseModel):
    """Exactly the shape `PushSubscription.toJSON()` produces in the browser —
    the frontend posts the object straight through, no reshaping needed."""

    endpoint: str
    keys: PushSubscriptionKeys


class VapidPublicKeyResponse(BaseModel):
    public_key: str
    enabled: bool
