export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
}

export interface SessionUser {
  id: string;
  username: string;
}
