 (key lines — full file wires async engine + autogenerate)
from app.database import Base
from app.models import *  # noqa — registers every table on Base.metadata
target_metadata = Base.metadata