import type { ActionOutcome, ActionResult, TycoonState } from '@/world/types';

export type WindowKind =
  | 'city'
  | 'venue'
  | 'gig'
  | 'vehicle'
  | 'vehicles'
  | 'depot'
  | 'depots'
  | 'shows'
  | 'finance'
  | 'news'
  | 'towns'
  | 'help';

export interface WinCtx {
  state: TycoonState;
  dispatch: (fn: (s: TycoonState) => ActionOutcome) => ActionResult;
  open: (kind: WindowKind, refId?: string) => void;
  close: () => void;
  goTo: (x: number, y: number) => void;
  follow: (vehicleId: string | null) => void;
  followingId: string | null;
  toast: (message: string, ok?: boolean) => void;
}
