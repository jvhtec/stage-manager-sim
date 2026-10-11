import { kmoney } from './format';

/** How to play: loaded on demand, it's only opened now and then. */
export function HelpWindow() {
  return (
    <div style={{ maxWidth: 420, whiteSpace: 'normal' }}>
      <p style={{ marginTop: 0 }}>
        You run a touring production company. Shows pop up at venues all over the map — the bigger the town, the bigger the room.
        Your job is logistics: get the right gear and enough crew to each venue <b>before load-in at 10:00</b> on show day.
      </p>
      <ol style={{ paddingLeft: 18, margin: '6px 0' }}>
        <li>
          Click a <b>price tag</b> over a venue (or open <b>Shows</b>) and <b>Book</b> it.
        </li>
        <li>
          <b>Assign</b> one or more vehicles. Trucks load gear and crew from their depot and leave in time to make load-in.
        </li>
        <li>Late trucks, missing gear and short crews all cut the fee. A no-show costs a penalty.</li>
        <li>
          <b>Tours</b> (Shows → Tours) bundle a run of dates with a completion bonus — put a truck on the whole tour and it
          drives the route. <b>World tours</b> add legs abroad: get the rig to the international airport in time and it's
          flown out, plays Madrid, New York or Tokyo, and flies home.
        </li>
        <li>
          Gear is real kit — Martin, Meyer, L-Acoustics, Vari-Lite, MA… Crowds expect better every year, and artists' riders ask
          for brands. Yesterday's flagship becomes tomorrow's pub rig.
        </li>
        <li>
          Real acts tour at the size their career is at. Book a band in a pub, do them proud, and they'll ask for you when
          they're filling arenas.
        </li>
        <li>
          <b>Star techs</b> — real big names (FOH engineers, lighting and show designers, production managers) join in their era.
          Put one on a truck and the shows it plays get better, especially for the acts they're known for.
        </li>
        <li>
          <b>Who'll hire you</b> — venues need a reputation tier, and real acts' management sets its own bar: big names (and acts
          headed for the top) only hire established crews, even for a club date. Start with local bands; do an act proud and
          they'll lower the bar for you next time.
        </li>
        <li>
          <b>The market</b> moves: busy summers, dead Januaries, and real history — recessions, booms, interest rates that swing
          from 0.5% to 17%, even a pandemic. See <b>Market</b>.
        </li>
        <li>
          <b>Festivals</b> (Glastonbury, FIB, Rock am Ring…) tender their stages two months out — multi-day jobs that pay like a
          run of arena dates.
        </li>
        <li>
          <b>House contracts</b>: install a rig in a venue for a year for a monthly retainer; its shows run on your rig and rivals
          can't touch them.
        </li>
        <li>
          <b>Upkeep</b> (Policies): gear wears out and can die mid-set — run a workshop or refurbish. Crews tire on the road and
          quit if underpaid. Insure against theft, crashes and festival storms.
        </li>
        <li>
          <b>Bases</b>: open a <b>delegation</b> (branch office, vans only) or a <b>warehouse</b> in any town and grow it as
          your reputation does. Bases near the work cut fuel, hotel nights and freelance rates — and add rent and salaries.
          Full-time staff (prep, sales) stay at the base; gig technicians go on the road, topped up by local freelancers.
        </li>
        <li>
          <b>Special events</b> (Shows → Events) — Live Aid, Olympic ceremonies, Eurovision, the BRITs… — are tendered
          department by department: put in a sealed bid (sharp, standard or premium). On live TV nothing may be late or fail.
        </li>
        <li>
          <b>The trade</b>: short of kit, sub-hire it from a rival nearby (or rent your idle kit out); courier kit between your
          bases; and when a rival struggles, buy them out from the League.
        </li>
        <li>
          <b>Growing the firm</b>: lease trucks instead of buying them; the bank lends against what you own and your rating. Fund
          <b> R&D</b> to build your own kit (and earn royalties), sign <b>production deals</b> with acts who love you, and train
          your crews.
        </li>
        <li>
          <b>Crew</b> are people: sound, lighting, video and staging techs rated 1–5★, with traits (crew chief, perfectionist,
          road warrior…). Shows want the right specialists — a light-heavy arena needs LX techs — and everyone levels up by
          working. Hire from the market each month. <b>Pin</b> someone to a truck to make them its regular, or open a booked
          show and <b>Choose the crew</b> to name exactly who goes. Set a rest rota in Policies so tired people sit jobs out.
          If morale slips, rivals make offers to your stars — match them within two weeks or lose them.
        </li>
        <li>
          <b>Needs your call</b>: a breakdown with a show waiting, a rig held at customs, undersized power, a union call, an
          injured tech, a star demanding a raise mid-tour… The game pauses and asks. Ignore it and the cheap default happens at the deadline.
        </li>
        <li>
          <b>Planning a truck</b>: select it and its route is drawn on the map; its window lists each stop with the hours spare
          at load-in, and suggests the next jobs that fit, bookable in one tap. <b>Plan a run</b> (route icon) strings
          several offers onto one truck — check every load-in, then book them all; deliver every date well for a run bonus. Single-show offers can be <b>haggled</b> once
          for +12% — a refusal may make the promoter walk, so push when you hold the stronger hand.
        </li>
        <li>
          <b>Abroad</b>: the world map (globe button) shows each world tour's flights. Crossing a border costs <b>visas and
          carnets</b> (EU firms move freely inside the EU; the UK needs carnets for Europe from 2021), and rigs get held at
          customs now and then.
        </li>
        <li>
          <b>Getting your name about</b>: set a marketing budget in Policies for more offers and a slow climb in reputation, and
          decide each year whether to exhibit at the trade shows (PLASA, Prolight + Sound, LDI) — a stand brings a month of
          enquiries and cheaper kit. <b>Low-emission zones</b> (Market) start charging older trucks in big cities from the
          2000s on: check a vehicle's emission class, and retrofit a filter or replace it. A rival may start a{' '}
          <b>price war</b> in a town you work in (see Market) — ride it out, fight back or buy a truce.
        </li>
        <li>
          <b>Owning a venue</b> (open the venue): lease it out for steady rent or promote it yourself for more, with more
          swing. It wears out and asks for refurbishment now and then.
        </li>
        <li>
          <b>Your own festival</b> (Market): pay up front in spring for a field day, weekender or major, pick a headliner
          and ticket price, and hope the economy and the weather play along — a built brand sells out, a new one loses
          money.
        </li>
        <li>
          <b>Tax</b>: on 31 December the taxman takes 15% of the first {kmoney(250_000)} of the year's profit and 30% above it. Losses carry
          forward and half of what you spend on trucks and kit is deductible.
        </li>
        <li>
          <b>Briefing</b> (clipboard button): a sorted list of what needs doing — shows without a truck, rehearsals, thin cash,
          a sponsor you're about to miss — with a tap to go straight to each.
        </li>
        <li>
          <b>Disputes and audits</b>: a promoter unhappy with a poor night may hold back part of your fee, and an insurer may question a
          big claim — settle, argue or send in the lawyers. Every September the council audits each base (the Base tab shows
          your likely score); first aiders, a prep crew that keeps up and a tidy rack help.
        </li>
        <li>
          <b>Speciality</b>: the kind of work you do shapes your name (Finance). Specialists earn more on shows that lean on their
          department and a little less on others; generalists sit in the middle.
        </li>
        <li>
          <b>Getting paid</b>: small venues pay on the night, bigger promoters take 2-6 weeks and sometimes go under. Policies lets you
          sell invoices to a factor for cash now or insure them.
        </li>
        <li>
          <b>Merchandise</b>: on a booked tour you can stock the stands before the first date — a small order is safe, a big one
          only pays if the tour sells out.
        </li>
        <li>
          <b>Tickets</b>: arena and stadium shows are inspected — you need riggers and a first aider in the crew. Hire people who
          have them, or send your own on a course from the crew list (a training room or academy at a warehouse makes it
          cheaper).
        </li>
        <li>
          <b>Fuel</b> follows real history (Market): spikes in 1979-81, 2008 and 2022, a collapse in 1986. Lock the price for 6 or
          12 months if you see a spike coming.
        </li>
        <li>
          <b>The roads change with the years.</b> Real motorways open on their real dates (wider roads with a central
          reservation): quicker, and tolled in Spain, France and Italy (and for lorries in Germany from 2005). Sea crossings
          are ferries — a couple of hours to board plus the fare — until a fixed link opens (the Channel Tunnel in 1994).
        </li>
        <li>
          <b>Over the border</b> (towns with a flag) there are shows but no bases. Borders cost time and money as they did:
          customs and a carnet until the EU single market in 1993, passport queues until Schengen, the GDR's transit
          checks until 1990, Brexit from 2021, and North America's borders always. A show's window lists the ferries,
          borders and tolls on the way; tolls, fares and customs go in the ledger as their own line.
        </li>
        <li>
          <b>Winter</b> (December to March) puts snow on the high roads: mountain passes are slower and a truck crossing
          one needs chains. Plan long runs over the Alps, Pyrenees or Rockies with more slack.
        </li>
        <li>
          <b>Team drivers</b> (a truck's window): two drivers taking turns in a sleeper cab keep it rolling, about a third
          quicker, at a second driver's pay for every hour on the road. Worth it on long hauls — America especially — and
          a waste on short hops. Vans can't take them.
        </li>
        <li>
          <b>Drivers' hours</b> follow the rules of the day: loosely policed tachographs before 1986, the EU rules after,
          digital tachographs from 2007 (and in America, tighter hours of service in 2004 and 2013 and electronic logs from
          2017). Each tightening slows a solo driver; team drivers are unaffected.
        </li>
        <li>
          <b>History happens on the road</b>: strikes, blockades, storms and the 2010 ash cloud slow the roads they cover,
          push fuel up or ground air freight. The news warns a few days ahead and a show's window flags a disrupted road.
        </li>
        <li>
          <b>Every room has quirks</b> (venue and show windows): stairs to load in (one more crew), a curfew (run late into
          it and it's a fine and a cut show), a noise limit (an oversized PA gets limited) or a union house crew to pay.
        </li>
        <li>
          <b>Freight</b>: a booked show's kit can go by rail (cheap, slower; towns and up) or air (dear, quick; cities)
          from any base instead of a truck. Local freelancers crew it, and the kit comes home the same way.
        </li>
        <li>
          <b>Map views</b> (layers button or O): your reputation by town, your market share, and whose patch each town
          is — the company with the most shows there lately.
        </li>
        <li>
          <b>Each country has its own rules</b> (a show's "Local rules" line): in Spain the summer fiestas fill small towns with
          council-booked shows that pay 75 days late; France's intermittents keep freelance crew cheap and plentiful; Germany
          wants a certified Meister für Veranstaltungstechnik (one more rigger) on big shows from 1995; Britain's 1998
          working-time rules add relief crew to big or multi-day shows; and America's right-to-work states (Texas, Georgia,
          Florida…) have no union houses while the north-east and west coast do. Spain has no stagehand unions at all.
        </li>
        <li>
          <b>Tour bus hire</b> (Fleet window): touring acts want a bus and driver for weeks. Buy a coach (a Duple from 1975,
          a Setra sleeper from 1985, the Skyliner from 1994) and hire it out at a day rate — the driver comes out of it, the
          bus wears and can break down mid-tour, and contracts you leave on the table go to rivals.
        </li>
        <li>
          <b>Rehearsals are mandatory</b> for big jobs: arena shows, stadiums, broadcast events and tours can't be booked
          without a rehearsal stage of the right size (Base → Annexes), and an unrehearsed show suffers. Policies has an
          automatic option.
        </li>
        <li>
          <b>Upgrading a base</b>: a warehouse grows up to a production campus, and the Base tab adds annexes — a rehearsal
          stage (rehearse a show or tour for better quality, rent it to bands in between), a workshop bench and a crew lounge.
        </li>
        <li>
          <b>Rivalry</b>: provoke a rival (headhunting, price-war fights) or sit in an aggressive neighbour's patch and the heat
          rises — then come rumours, tampered kit and tip-offs. Pay for security, hit back, or hire an investigator in the League
          to watch them for a quarter.
        </li>
        <li>
          <b>Sponsors &amp; charity</b>: brands will pay a monthly retainer to be on your trucks if you keep a promised number of
          shows a month going (Finance lists them); say yes to a good cause now and then and they call more often.
        </li>
        <li>
          <b>Going public</b>: a big, reputable company can float 30% of itself for cash (Finance). Then shareholders
          want profits and dividends: losses drain their confidence, activists demand action, and a board with no confidence
          at all will throw you out. <b>Headhunting</b>: in the League table you can lure a rival's star tech away at triple
          the usual signing fee — it dents their finances and your reputation, and the star expects a rise.
        </li>
        <li>
          <b>Fleet</b>: the Fleet window is a dashboard — how busy each truck is, what needs attention in the next two
          weeks, and who's earning. Rivals plan runs too: a firm already working an area is likelier to take the next date
          there.
        </li>
        <li>
          <b>Second-hand</b>: when a rival goes under, its kit and trucks go to auction — the price slides daily, but others may
          snap lots up first. <b>Maker partnerships</b> (Policies) give a discount and sponsorship for committing a department
          to one brand. Venue <b>promoters</b> remember your nights: do them proud and they call more and pay more.
        </li>
        <li>
          The world moves: landmark rooms open and close in their real years (the O2 in 2007), towns grow, rivals expand,
          merge and start up. Your <b>annual report</b> lands every New Year, and the League tracks your career milestones.
        </li>
        <li>
          <b>Your goal</b>: you choose one (and a difficulty) when you start a company — see how you're doing in the League,
          along with your legacy score. Reach it and the game keeps going; the score is what you leave behind.
        </li>
        <li>
          <b>Cause and effect</b>: promoters sometimes pay late, so keep a cash cushion — when it runs thin, services and the
          workshop get put off, worn trucks and kit fail, and the next bad night is written up in the League (<i>Post-mortems</i>)
          with the chain that led to it. Clients ask for extras at load-in; give too many away and they expect them. The Money
          window forecasts the next eight weeks.
        </li>
        <li>
          <b>Technical riders</b>: bigger shows need a desk with enough inputs, sometimes a particular console family for the
          engineer's show file, and a PA from the approved list. The show window checks your kit and offers cross-hire from a
          rental house; break the rider and the client holds back part of the fee.
        </li>
        <li>
          <b>The room</b>: clubs and up have limited power, a roof that only takes so much weight and sometimes no dock for an
          artic. The offer warns you, and a booked show offers a generator, ground support or a van shuttle.
        </li>
        <li>
          <b>Crew are people</b>: pairs who work well together become trusted teams (🤝) and deliver more; pairs who clash feud
          (⚡) and cost the show, and past a point refuse to share a truck unless you name them both. Keep people exhausted on
          the road for too long and they burn out for good.
        </li>
        <li>
          <b>Kit is physical</b>: trucks have a payload as well as space, and a load-in has six hours before soundcheck — short
          crews, street load-ins and stairs make it slow. The show window estimates it and offers local loaders.
        </li>
        <li>
          <b>Terms</b>: easy-going clients pay a deposit and agree a cancellation fee; pushy ones don't. Ask for better terms
          before you book — but they may walk. Clients do cancel, and without a clause you get nothing.
        </li>
        <li>
          <b>Ecosystems</b>: old lines go legacy, then end-of-life, and repairs slow down as spares dry up. Standardise a
          department on one brand and the workshop gets cheaper — until that maker has a bad day.
        </li>
        <li>
          <b>Department heads</b> (Company policies): a production manager advances shows and answers change requests, a crew
          chief keeps feuds apart and burnout down, a finance director chases invoices. Hire them when the clicking gets
          too much.
        </li>
        <li>
          Buy bigger trucks and more gear, and win reputation to unlock arenas and stadiums. Every January the industry awards
          judge your year and the trade press prints its supplier table, the biggest tours and reviews of your best and worst
          shows. Or start from a <b>historic scenario</b> — Live Aid, Italia ’90, Barcelona ’92 — and win a lot of the night.
        </li>
      </ol>
      <p className="tt-dim" style={{ marginBottom: 0 }}>
        Drag to pan, scroll or pinch to zoom. Space pauses; 1–4 set the speed. Install it as an app: on iPhone/iPad use Share →
        Add to Home Screen; on Android use the browser's Install prompt. Vehicles break down more as they age — keep them
        serviced. Wages and running costs tick every day. Live in your overdraft too long and the bank cuts it; go over the limit and wages go late and suppliers want cash up front — stay over it past the bank's demand and the administrators come in. Grow faster than your office and the shows start to slip.
      </p>
    </div>
  );
}
