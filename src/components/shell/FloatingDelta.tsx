import { AnimatePresence, motion } from 'framer-motion';

export interface DeltaEvent {
  id: string;
  amount: number;
}

interface FloatingDeltaProps {
  deltas: DeltaEvent[];
}

/**
 * Floating "+$2,400" / "-$300" text that drifts up and fades out next to the
 * HUD balance whenever it changes. Purely cosmetic — GameShell owns the
 * queue of active deltas and prunes each one after its animation completes.
 */
export function FloatingDelta({ deltas }: FloatingDeltaProps) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2">
      <AnimatePresence>
        {deltas.map(delta => (
          <motion.div
            key={delta.id}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -24 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-semibold ${
              delta.amount >= 0 ? 'text-success' : 'text-destructive'
            }`}
          >
            {delta.amount >= 0 ? '+' : '-'}${Math.abs(Math.round(delta.amount)).toLocaleString()}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
