import { useEffect, useState } from 'react';
import { DEPT_LABELS } from '@/world/catalog';
import { getCountry } from '@/world/content/countries';
import { deptTotals } from '@/world/loading';
import { marketNow } from '@/world/market';
import { worldOf } from '@/world/mapgen';
import { DIFFICULTIES, GOALS, goalDeadlineYear } from '@/world/scenario';
import { DEPTS, type TycoonState } from '@/world/types';
import { formatPopulation, money } from './format';

/** What the business looked like when you walked into it, by start year. */
export const ERA: Record<number, { headline: string; text: string }> = {
  1975: {
    headline: 'Pub rock, glam and prog',
    text: 'The big halls are filled by speaker stacks and a console the size of a door. Lights are par cans on a hired truss. Everyone is making it up as they go — which is exactly why a small firm can get a start.',
  },
  1980: {
    headline: 'New wave and bigger PAs',
    text: 'Punk has gone mainstream and the first proper touring PAs are rolling out of the big rental houses. The crowds want it louder, and the bands want it bigger.',
  },
  1985: {
    headline: 'The year the world watches a stage',
    text: 'Live Aid is about to show a billion people what a production can do. Digital delays and automated lights are arriving, and the money is following them in.',
  },
  1990: {
    headline: 'Arena rock and acid house',
    text: 'CD sales are booming and the touring business has become a proper industry. Consoles are getting computers; the rental houses are getting rich.',
  },
  2000: {
    headline: 'Line arrays and digital desks',
    text: 'Line arrays hang in every arena and LED walls are on the way. The dot-com wobble hasn’t reached live music — gig money has never been better.',
  },
  2010: {
    headline: 'Live is where the money is',
    text: 'Streaming has gutted record sales, so artists are back on the road. Rigs are smaller, brighter and digital — and everyone in the crowd has a camera.',
  },
};

const TIPS = [
  'Click a price tag on the map (or open Shows) and book a job.',
  'Assign a truck. It loads gear and crew from its depot and leaves in time for load-in at 10:00.',
  'Keep an eye on the news bar: the economy, rivals and the odd disaster all show up there.',
];

interface Slide {
  kicker: string;
  title: string;
  body: React.ReactNode;
}

function slides(s: TycoonState): Slide[] {
  const world = worldOf(s);
  const hq = world.cityById.get(s.company.hqCityId);
  const country = getCountry(s.country);
  const era = ERA[s.startYear] ?? ERA[1990];
  const periods = marketNow(s).periods;
  const kit = DEPTS.map(d => ({ d, n: deptTotals(s.depots[0]?.gear ?? {})[d] })).filter(x => x.n > 0);
  const rivals = [...s.rivals].sort((a, b) => b.reputation - a.reputation).slice(0, 3);
  const goal = GOALS[s.goal ?? 'sandbox'];
  const deadline = goalDeadlineYear(s);
  const diff = DIFFICULTIES[s.difficulty ?? 'normal'];
  return [
    {
      kicker: `${country.flag} ${country.name}`,
      title: String(s.startYear),
      body: (
        <>
          <p className="tt-open-lead">{era.headline}.</p>
          <p>{era.text}</p>
          {periods[0] && (
            <p className="tt-open-note">
              <b>{periods[0].label}.</b> {periods[0].news}
            </p>
          )}
        </>
      ),
    },
    {
      kicker: 'Your company',
      title: s.company.name,
      body: (
        <>
          <p>
            You operate out of <b>{hq?.name}</b>
            {hq ? ` (${formatPopulation(hq.population)})` : ''}: a warehouse, {s.vehicles.filter(v => v.owner === 'player').length} vehicles, a small crew of {s.people.length}, and {money(s.company.cash)} in the bank.
          </p>
          <p className="tt-open-note">
            In the racks: {kit.map(k => `${k.n} ${DEPT_LABELS[k.d].toLowerCase()}`).join(', ')}.
          </p>
        </>
      ),
    },
    {
      kicker: 'The competition',
      title: 'You’re not the only one',
      body: (
        <>
          <p>
            The market already has names: {rivals.map(r => r.name).join(', ')}
            {s.rivals.length > 3 ? ` and ${s.rivals.length - 3} more` : ''}. They have bigger rigs and better contacts — for now.
          </p>
          <p className="tt-open-note">Do the small jobs well, build your name, and the big acts will start taking your call.</p>
        </>
      ),
    },
    {
      kicker: `${diff.label}${s.goal && s.goal !== 'sandbox' ? ` · ${goal.label}` : ' · Sandbox'}`,
      title: s.goal && s.goal !== 'sandbox' ? 'Your goal' : 'No goal. Your rules.',
      body: (
        <>
          {s.goal && s.goal !== 'sandbox' ? (
            <p>
              {goal.blurb}
              {deadline ? ` (by ${deadline})` : ''}
            </p>
          ) : (
            <p>Build whatever you like — you can still chase the legacy score.</p>
          )}
          <ol className="tt-open-tips">
            {TIPS.map(t => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </>
      ),
    },
  ];
}

const SKIP_KEY = 'stage-tycoon:skip-intro';
export const introSkipped = () => {
  try {
    return localStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
};

/** A short, skippable opening for a new company. */
export function Intro({ state, onDone }: { state: TycoonState; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [never, setNever] = useState(false);
  const list = slides(state);
  const last = i === list.length - 1;
  const finish = () => {
    if (never) {
      try {
        localStorage.setItem(SKIP_KEY, '1');
      } catch {
        // ignore
      }
    }
    onDone();
  };
  const next = () => (last ? finish() : setI(n => n + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (last) finish();
        else setI(n => n + 1);
      } else if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowLeft') setI(n => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, never]);

  const slide = list[i];
  return (
    <div className="tt-open" role="dialog" aria-label="Introduction">
      <div className="tt-open-card" key={i}>
        <div className="tt-open-kicker">{slide.kicker}</div>
        <h2 className="tt-open-title">{slide.title}</h2>
        <div className="tt-open-body">{slide.body}</div>
        <div className="tt-open-dots" aria-hidden="true">
          {list.map((_, n) => (
            <i key={n} data-on={n === i} />
          ))}
        </div>
        <div className="tt-open-actions">
          <label className="tt-dim" style={{ fontSize: 11, display: 'flex', gap: 5, alignItems: 'center' }}>
            <input type="checkbox" checked={never} onChange={e => setNever(e.target.checked)} /> Skip this next time
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {i > 0 && (
              <button className="tt-btn" onClick={() => setI(n => n - 1)}>
                Back
              </button>
            )}
            {!last && (
              <button className="tt-btn" onClick={finish}>
                Skip
              </button>
            )}
            <button className="tt-btn primary" onClick={next} autoFocus>
              {last ? 'Load in ›' : 'Next ›'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
