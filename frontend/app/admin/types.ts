export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  workspace_name: string;
  workspace_slug: string;
  token: string;
  invite_url: string;
  expires_at: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  is_admin: boolean;
  access_level?: string;
  created_at: string;
  slug: string;
}

export interface SupportRequestItem {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  advisor_id: string;
}

export interface CurrentUser {
  id?: string;
  name: string;
  email: string;
  role: string;
  slug: string;
  workspace_name: string;
  workspace_slug: string;
  is_admin: boolean;
}

export interface ToastData {
  id: string;
  type: "confirm" | "success" | "error" | "info";
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "primary";
  onConfirm?: () => void;
}

export interface ResetLinkModalData {
  email: string;
  url: string;
  emailSent: boolean;
}

export interface MemberToRemoveData {
  id: string;
  name: string;
  email: string;
}

