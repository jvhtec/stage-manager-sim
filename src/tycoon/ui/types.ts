import type { ActionOutcome, ActionResult, TycoonState } from '@/world/types';

export type WindowKind =
  | 'city'
  | 'venue'
  | 'gig'
  | 'tour'
  | 'vehicle'
  | 'vehicles'
  | 'depot'
  | 'depots'
  | 'shows'
  | 'finance'
  | 'news'
  | 'towns'
  | 'league'
  | 'talent'
  | 'market'
  | 'policies'
  | 'rnd'
  | 'help'
  | 'menu';

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
