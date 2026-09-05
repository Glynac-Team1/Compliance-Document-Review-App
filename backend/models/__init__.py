import enum, uuid
from datetime import datetime
from sqlalchemy import Enum, ForeignKey, String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
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
    advisor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus), default=DocumentStatus.pending)
    original_filename: Mapped[str | None] = mapped_column(String, nullable=True)
    locked_by_officer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    file_reference: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)
    previous_version_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


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


###################  AI and Retrieval Corpus Models  ################

class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Stable natural key from worker/ai/rules_corpus.py (e.g.
    # "RULE_FINRA_2210_NO_GUARANTEES"). This is what ingestion upserts
    # against, so re-running the seed script never creates duplicates —
    # the surrogate UUID `id` above is only for foreign-key references
    # from other tables (e.g. a future Flag.matched_rule_id).
    rule_key: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    rule_type: Mapped[str] = mapped_column(String, nullable=False)  # "disclosure", "prohibited_claim", ...
    text: Mapped[str] = mapped_column(String, nullable=False)

    # pgvector column — 768-dim to match BAAI/bge-base-en-v1.5 (see script below)
    embedding: Mapped[list[float]] = mapped_column(Vector(768))

    # --- Lineage / provenance / versioning ---
    # Answers "where did this rule come from, and is it still current" —
    # required for a compliance app where a flag needs to be traceable
    # back to a specific, dated version of a rule's wording.
    source: Mapped[str] = mapped_column(String, nullable=False, default="synthetic-seed")
    corpus_version: Mapped[str] = mapped_column(String, nullable=False, default="v1")
    embedding_model: Mapped[str] = mapped_column(String, nullable=False, default="BAAI/bge-base-en-v1.5")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )