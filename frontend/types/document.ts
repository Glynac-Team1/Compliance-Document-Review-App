export type DocumentStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'needs_revision'

export type Decision = 'approve' | 'reject' | 'needs_revision'

export type UserRole = 'advisor' | 'officer'

export interface ComplianceFlag {
  passage_excerpt?: string
  passage?: string
  matched_rule_id?: string
  matched_rule_name?: string
  explanation?: string
  severity?: 'low' | 'medium' | 'high' | 'critical' | string
  rule_excerpt?: string
}

export interface AIAnalysis {
  status?: 'pending' | 'completed' | 'failed' | string
  summary?: string
  model?: string
  provider?: string
  degraded?: boolean
  flags?: ComplianceFlag[]
  error_type?: string
  error_detail?: string
  manual_review_required?: boolean
}

export interface DocumentReview {
  decision: Decision
  comment: string
  decided_at?: string
  officer_name?: string
}

export interface DocumentThreadVersion {
  version: number
  document_id: string
  filename: string
  file_type: string
  status: DocumentStatus
  created_at: string
  previous_version_id?: string | null
  review?: DocumentReview | null
  ai_analysis?: {
    status?: string
    summary?: string
  } | null
}

export interface DocumentThread {
  thread_root_id: string
  total_versions: number
  versions: DocumentThreadVersion[]
}

export interface DocumentItem {
  id: string
  name?: string
  filename?: string
  original_filename?: string
  submitter?: string
  uploaded?: string
  upload_date?: string
  date?: string
  status: DocumentStatus
  file_type?: string
  type?: string
  ai_analysis?: AIAnalysis | null
  locked_by_officer_id?: string | null
  locked_by_officer_name?: string | null
  is_locked_by_me?: boolean
  is_locked_by_other?: boolean
  officer_comment?: string | null
  thread_root_id?: string | null
  previous_version_id?: string | null
}

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  slug?: string
}

export interface AuditActor {
  name: string
  email: string
  role?: string | null
}

export interface AuditLogEvent {
  id: string
  action: 'submitted' | 'viewed' | 'claimed' | 'decided' | 'resubmitted' | string
  timestamp: string
  actor: AuditActor
}

export interface DocumentAuditTrail {
  document_id: string
  audit_events: AuditLogEvent[]
}
