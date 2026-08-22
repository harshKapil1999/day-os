declare global {
  namespace Express {
    interface Request { authUserId?: string; requestId?: string; }
  }
}
export {};
