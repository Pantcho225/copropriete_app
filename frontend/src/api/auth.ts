// frontend/src/api/auth.ts

import api from "./axios";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  is_staff: boolean;
  is_platform_admin?: boolean;
};

export type AuthMembershipCopropriete = {
  id: number;
  nom: string;
};

export type AuthMembershipPermissions = {
  can_manage_copropriete: boolean;
  can_manage_referentiel: boolean;
  can_manage_users: boolean;
  can_write_compta: boolean;
  can_read_reports: boolean;
};

export type AuthMembership = {
  id: number;
  role: string;
  role_label?: string;
  is_active: boolean;
  permissions?: AuthMembershipPermissions;
  copropriete: AuthMembershipCopropriete;
};

export type AuthMeResponse = {
  user: AuthUser;
  must_change_password: boolean;
  roles: string[];
  memberships: AuthMembership[];
  is_admin: boolean;
  is_platform_admin: boolean;
  is_superuser: boolean;
  is_coproprietaire: boolean;
};

export async function getAuthMe(): Promise<AuthMeResponse> {
  const response = await api.get<AuthMeResponse>("/api/auth/me/");
  return response.data;
}

export type PasswordResetRequestPayload = {
  identifier: string;
};

export type PasswordResetRequestResponse = {
  detail: string;
  debug_reset_token?: string;
  debug_reset_url?: string;
  debug_throttled?: boolean;
  debug_message?: string;
};

export type PasswordResetConfirmPayload = {
  token: string;
  new_password: string;
  confirm_password: string;
};

export type PasswordResetConfirmResponse = {
  detail: string;
  must_change_password: boolean;
};

export async function requestPasswordReset(
  payload: PasswordResetRequestPayload,
): Promise<PasswordResetRequestResponse> {
  const response = await api.post<PasswordResetRequestResponse>(
    "/api/auth/password-reset/request/",
    payload,
  );

  return response.data;
}

export async function confirmPasswordReset(
  payload: PasswordResetConfirmPayload,
): Promise<PasswordResetConfirmResponse> {
  const response = await api.post<PasswordResetConfirmResponse>(
    "/api/auth/password-reset/confirm/",
    payload,
  );

  return response.data;
}