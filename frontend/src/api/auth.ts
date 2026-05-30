import api from "./axios";

export type AuthMeUser = {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_superuser: boolean;
  is_staff: boolean;
};

export type AuthMeMembership = {
  id: number;
  role: string;
  is_active: boolean;
  copropriete: {
    id: number;
    nom: string;
  };
};

export type AuthMeResponse = {
  user: AuthMeUser;
  must_change_password: boolean;
  roles: string[];
  memberships: AuthMeMembership[];
  is_admin: boolean;
  is_superuser: boolean;
  is_coproprietaire?: boolean;
};

export async function getAuthMe(): Promise<AuthMeResponse> {
  const response = await api.get<AuthMeResponse>("/api/auth/me/");
  return response.data;
}