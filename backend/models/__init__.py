import enum, uuid
from datetime import datetime
from sqlalchemy import Enum, ForeignKey, String, DateTime, Boolean
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
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[DocumentStatus] = mapped_column(Enum(DocumentStatus), default=DocumentStatus.pending)
    locked_by_officer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    file_reference: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)
    previous_version_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    ai_analysis: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # TODO: confirm with team — redundant with AIAnalysis/Flag tables below?

    # --- added for revision threading (plan §5 / §6) ---
    thread_root_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documents.id"), nullable=True)


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
    source: Mapped[str] = mapped_column(String, nullable=False, default="synthetic-seed")
    corpus_version: Mapped[str] = mapped_column(String, nullable=False, default="v1")
    embedding_model: Mapped[str] = mapped_column(String, nullable=False, default="BAAI/bge-base-en-v1.5")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )


###################  AI Analysis / Audit / Notification Models  ################

class AnalysisStatus(str, enum.Enum):
    pending = "pending"
    ready = "ready"
    error = "error"


class Severity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class AuditAction(str, enum.Enum):
    submitted = "submitted"
    viewed = "viewed"
    decided = "decided"
    resubmitted = "resubmitted"


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"), unique=True, nullable=False)
    summary: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[AnalysisStatus] = mapped_column(Enum(AnalysisStatus), default=AnalysisStatus.pending, nullable=False)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Flag(Base):
    __tablename__ = "flags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ai_analyses.id"), nullable=False)
    passage_excerpt: Mapped[str] = mapped_column(String, nullable=False)
    matched_rule_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("rules.id"), nullable=False)
    explanation: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[Severity] = mapped_column(Enum(Severity), nullable=False)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"), nullable=False)
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class PIIMapping(Base):
    __tablename__ = "pii_mappings"

    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"), primary_key=True)
    placeholder: Mapped[str] = mapped_column(String, primary_key=True)
    original_value: Mapped[str] = mapped_column(String, nullable=False)


class Precedent(Base):
    __tablename__ = "precedents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"), nullable=False)
    masked_text: Mapped[str] = mapped_column(String, nullable=False)
    decision: Mapped[str] = mapped_column(String, nullable=False)
    comment: Mapped[str | None] = mapped_column(String, nullable=True)
    # 768-dim to match rules.embedding (BAAI/bge-base-en-v1.5) — plan doc says
    # 384 but the real Rule model above uses 768; kept consistent with that.
    embedding: Mapped[list[float]] = mapped_column(Vector(768))


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"), nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)