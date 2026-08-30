
import enum, uuid
from datetime import datetime
from sqlalchemy import Enum, ForeignKey, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector
from app.database import Base


class Role(str, enum.Enum):
    advisor = "advisor"
    officer = "officer"


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)  # immutable post-creation
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

######## Document handling Model ########
class DocumentStatus(str, enum.Enum):
    pending = "pending"
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    needs_revision = "needs_revision"

class Document(Base):
    __tablename__ = "documents"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Relationships
    advisor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    # State Machine and Locking
    status: Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus), default=DocumentStatus.pending)
    locked_by_officer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    
    # Storage Reference (MinIO Object Key)
    original_filename: Mapped[str] = mapped_column(String, nullable=True)
    file_reference: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False) # e.g., 'pdf', 'docx'
    
    # For threading revisions
    previous_version_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    ############## Officer Review Model ############### 
class Decision(str, enum.Enum):
    approve = "approve"
    reject = "reject"
    needs_revision = "needs_revision"

class Review(Base):
    __tablename__ = "reviews"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"), nullable=False, unique=True)
    officer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    decision: Mapped[Decision] = mapped_column(Enum(Decision), nullable=False)
    comment: Mapped[str] = mapped_column(String, nullable=False)
    
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


    ###################  AI and PII Model ################
    
class Rule(Base):
    __tablename__ = "rules"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_type: Mapped[str] = mapped_column(String, nullable=False) # "disclosure", "prohibited_claim"
    text: Mapped[str] = mapped_column(String, nullable=False)
    
    # pgvector column
    embedding: Mapped[list[float]] = mapped_column(Vector(768))