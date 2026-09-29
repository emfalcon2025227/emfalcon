import 'express';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: string;
  ownerId?: string;
  tenantId?: string;
  name?: string;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
