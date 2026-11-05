// More stories for the newspaper: airlines and divisions founded, deliveries, milestones, money, strikes,
// crew records, whistleblowers, incidents, diversions, fines, famous passengers, bans, kind deeds,
// reviews and co-op players. Each one once (or not again for a while), so the paper stays news.
// How they appear is up to you (Settings → News): opened as a newspaper, or only in the inbox.

function newsS(): any { const S: any = State; S.newsSeen = S.newsSeen || {}; return S; }
/** A story once per key; with cool, not again for that long per kind. */
function newsOnce(key: string, kind: string, coolMs: number): boolean {
  const S = newsS(), now = Date.now();
  if (S.newsSeen[key]) return false;
  S.newsCool = S.newsCool || {};
  if (coolMs && S.newsCool[kind] && now - S.newsCool[kind] < coolMs) return false;
  S.newsSeen[key] = now; S.newsCool[kind] = now; return true;
}
function newsCountry(icao: string): string { const a = apt(icao); return a ? a.country : ''; }
function newsCity(icao: string): string { const a = apt(icao); return a ? a.city : icao; }
function newsSpokes(c: Company): string { try { return (makePerson('sp-' + c.id, 'fa', '', c.hub) as any).name; } catch (e) { return 'A spokesperson'; } }
function newsPlaneArt(c: Company, typeId?: string, reg?: string): any {
  const a = typeId ? null : fleetOf(c.id)[0];
  return { kind: 'aircraft', typeId: typeId || (a ? a.typeId : 'a320neo'), color: c.color, color2: c.color2, reg: reg || (a ? a.reg : '') };
}
function newsPick<T>(seed: string, l: T[]): T { return l[_hashStr(seed) % l.length]; }
function newsPost(c: Company, place: string, o: { section: string; headline: string; standfirst: string; body: string[]; quote?: [string, string]; quote2?: [string, string]; art?: any }) {
  try { newsPublish({ paper: newsPaper(newsCountry(place)), place: newsCity(place), companyId: c.id, art: o.art || newsPlaneArt(c), ...o } as any); } catch (e) { /* not ready */ }
}

/* ---------- airlines and divisions ---------- */
function newsFounded(cid: string, how: 'first' | 'new' | 'coop') {
  const c = company(cid); if (!c || !newsOnce('found:' + cid, 'found', 0)) return;
  const me: any = myPilot(), city = newsCity(c.hub), kind = (c as any).kind === 'bush' ? 'bush and floatplane' : (c as any).kind === 'regional' ? 'regional' : 'passenger';
  newsPost(c, c.hub, {
    section: 'Business', headline: how === 'coop' ? `${c.name}: an airline flown by its own pilots` : newsPick(c.id, [`A new airline takes off in ${city}`, `${c.name} is born`, `${city} gets its own airline: ${c.name}`]),
    standfirst: how === 'coop' ? `${c.name} opens in ${city} as a co-operative: pilots from around the world fly for it together and share in what it earns.`
      : `${me.name} has founded ${c.name}, a new ${kind} airline based at ${apt(c.hub) ? apt(c.hub).name : c.hub}${how === 'new' ? ', the latest in a growing group' : ''}.`,
    body: [
      `${c.name} (${c.icao}, callsign “${c.callsign}”) was registered this week with ${city} as its home base. ${how === 'first' ? 'It is the founder\'s first airline.' : how === 'new' ? `It joins ${State.companies.length - 1} other airline${State.companies.length > 2 ? 's' : ''} under the same owner.` : 'Pilots join with an invite code and fly from their own homes.'}`,
      `The company starts with ${money(c.balance, { compact: true })} in the bank. Aircraft, crew and the first routes come next.`,
      `Local business leaders welcomed the news, saying a home-grown airline brings jobs at the airport and more choice for travellers.`,
    ],
    quote: [how === 'coop' ? 'Every one of our pilots flies for the same airline. That is the whole idea.' : 'We start small and we start properly: safe, on time and friendly.', `${me.name}, founder of ${c.name}`],
  });
}
function newsDivision(c: Company, name: string) {
  if (!newsOnce('div:' + c.id + ':' + name + ':' + c.divisions.length, 'div', 0)) return;
  newsPost(c, c.hub, { section: 'Business', headline: `${c.name} launches ${name}`, standfirst: `A new division, ${name}, will fly under the ${c.name} name from ${newsCity(c.hub)}.`,
    body: [`${c.name} is splitting part of its flying into a new division, ${name}. It gets its own aircraft and schedule but shares the airline's crews, base and booking.`, `Industry watchers see it as a sign the young airline is growing.`],
    quote: [`${name} lets us try new routes and new aircraft without changing what works.`, `${newsSpokes(c)}, ${c.name}`] });
}

/* ---------- aircraft ---------- */
function newsDelivery(c: Company, typeId: string, regs: string[], firstEver: boolean, newType: boolean) {
  const t = acType(typeId); if (!t) return;
  if (t.cls === 'helicopter') { newsHeliDelivery(c, t, regs, firstEver); return; }
  if (!(firstEver || newType)) return;
  if (!newsOnce('dlv:' + c.id + ':' + typeId, 'dlv', 0)) return;
  newsPost(c, c.hub, { section: 'Aviation', art: newsPlaneArt(c, typeId, regs[0]),
    headline: firstEver ? `${c.name}'s first aircraft arrives` : `First ${t.model} arrives in ${newsCity(c.hub)}`,
    standfirst: `${regs[0]}, a ${t.maker} ${t.model}, touched down at ${newsCity(c.hub)} in ${c.name} colours${regs.length > 1 ? `, with ${regs.length - 1} more to follow` : ''}.`,
    body: [`The ${t.model} seats about ${t.seats} passengers and flies up to ${num(t.rangeNm)} nautical miles. ${firstEver ? 'It is the first aircraft in the airline\'s fleet.' : `It is the first of its type for ${c.name}.`}`,
      `Spotters lined the fence to see it arrive, and the airport's fire crews gave it a water-cannon welcome.`],
    quote: [`A new aircraft is always a big day for the whole team.`, `${newsSpokes(c)}, ${c.name}`] });
}

/** A helicopter joins the fleet: news when it is the airline's first helicopter ever, or its first from that maker. */
function newsHeliDelivery(c: Company, t: AircraftType, regs: string[], firstEver: boolean) {
  const others = fleetOf(c.id).filter(a => regs.indexOf(a.reg) < 0 && acType(a.typeId) && acType(a.typeId).cls === 'helicopter');
  const firstHeli = !others.length, firstBrand = !others.some(a => acType(a.typeId).maker === t.maker);
  if (!firstHeli && !firstBrand) return;
  if (!newsOnce('heli:' + c.id + ':' + (firstHeli ? 'first' : t.maker), 'dlv', 0)) return;
  const roles: string[] = (t as any).roles || [], job = roles.indexOf('hems') >= 0 ? 'air ambulance and medical flights' : roles.indexOf('offshore') >= 0 ? 'offshore crew changes' : roles.indexOf('sar') >= 0 ? 'search and rescue' : 'charter and sightseeing flights';
  const where = newsCity(c.hub);
  newsPost(c, c.hub, { section: 'Aviation', art: newsPlaneArt(c, t.id, regs[0]),
    headline: firstHeli ? (firstEver ? `${c.name} starts out with a helicopter` : `${c.name} takes to the air with its first helicopter`) : `${c.name}'s first ${t.maker} helicopter arrives`,
    standfirst: `${regs[0]}, a ${t.maker} ${t.model}, landed at ${where} in ${c.name} colours${regs.length > 1 ? `, with ${regs.length - 1} more to follow` : ''}.`,
    body: [firstHeli ? `It is the first helicopter in the company's history, and it opens a new kind of work for it: ${job}, landing on hospital pads, helidecks and heliports as well as at airports.` : `The company already flies helicopters, but this is its first from ${t.maker}. It will be used for ${job}.`,
      `The ${t.model} seats up to ${t.seats} and cruises at about ${t.cruiseKt} knots. Its pilots hold helicopter licences, and ${hoistHeli(t) ? 'fitted with a rescue hoist, it flies with a winch operator as a third crew member' : 'it flies with two pilots'}.`,
      `A small crowd watched it hover over the apron before it set down.`],
    quote: [firstHeli ? 'Helicopters take us places no runway reaches. It is a proud day for everyone here.' : `We have wanted the ${t.model} for a long time. It suits the work we do.`, `${newsSpokes(c)}, ${c.name}`] });
}

/* ---------- strikes ---------- */
function newsStrike(cid: string, g: PayGroup, why: string, stage: 'start' | 'end' | 'fired', text?: string, n?: number) {
  const c = company(cid); if (!c) return;
  const who = PAY_GROUPS.filter(x => x[0] === g)[0][2];
  if (!newsOnce(`strike:${cid}:${g}:${stage}:${Math.floor(Date.now() / 864e5)}`, 'strike-' + stage, 0)) return;
  const union = `${newsPick(cid + g, ['United', 'National', 'Northern', 'Independent'])} ${g === 'pilots' ? 'Pilots' : g === 'fa' ? 'Cabin Crew' : g === 'mech' ? 'Aircraft Engineers' : 'Ramp Workers'} Union`;
  const h = stage === 'start' ? `${c.name} ${who} walk out` : stage === 'end' ? `Strike over at ${c.name}` : `${c.name} sacks striking ${who}`;
  newsPost(c, c.hub, { section: 'Business', art: { kind: 'court' }, headline: h,
    standfirst: stage === 'start' ? `Flights are disrupted after ${who} at ${c.name} stopped work over ${why}.` : stage === 'end' ? `${c.name}'s ${who} are back at work. ${text || ''}` : `${c.name} has dismissed ${n || 'its'} striking ${who} and is hiring replacements.`,
    body: stage === 'start' ? [`The ${union} says its members have been paid below the going rate. Talks broke down after two warnings.`, `Passengers are advised to check their flight before going to the airport.`]
      : stage === 'end' ? [`The dispute with the ${union} is over and the schedule is returning to normal.`] : [`The ${union} called the move “a disgrace” and warned that cheaper, less experienced replacements put service at risk.`, `Bookings at ${c.name} dipped after the news.`],
    quote: stage === 'fired' ? ['They gave years to this airline. This is how they are thanked.', `Spokesperson, ${union}`] : [stage === 'start' ? 'We did not want this. We asked for fair pay and were ignored.' : 'We are glad it is settled.', `Spokesperson, ${union}`] });
}

/* ---------- flights ---------- */
/** A crash in the papers: any of the airline's aircraft, your own flight or a hired pilot's. */
function newsCrash(o: { key: string; c: Company; typeId: string; reg: string; callsign?: string; from?: string; to: string; pax?: number; dead?: boolean; cause?: string }) {
  try { crashSiteAdd(o); } catch (e) { /* no crash site */ }
  if (!o.c || !newsOnce('crash:' + o.key, 'crash', 0)) return;
  const t = acType(o.typeId), heli = !!t && t.cls === 'helicopter', model = t ? (heli ? `${t.model} helicopter` : t.model) : 'aircraft', at = newsCity(o.to), fl = o.callsign ? `flight ${o.callsign}` : o.reg;
  const onBoard = o.pax ? `On board were ${num(o.pax)} passengers and the crew.` : '';
  const art = newsPlaneArt(o.c, o.typeId, o.reg); art.crash = true;
  newsPost(o.c, o.to, { section: 'News', art,
    headline: o.dead ? `Deaths as ${o.c.name} ${model} crashes at ${at}` : `${o.c.name} ${model} crashes at ${at}: everyone survives`,
    standfirst: `${o.c.name} ${fl}, a ${model} (${o.reg})${o.from ? ` from ${newsCity(o.from)}` : ''}, ${heli ? `came down as it approached ${at}` : `crashed on arrival at ${at}`}. ${o.dead ? 'There are fatalities.' : 'Everyone on board got out, some with injuries.'}`,
    body: [
      `${onBoard} Emergency services were at the scene within minutes${o.dead ? ', and hospitals in the area were put on alert' : ' and took the injured to hospital'}.`,
      o.cause ? `Investigators say: ${o.cause}` : `The accident investigation board has opened an inquiry. The flight recorders have been recovered and will be read out in the coming days.`,
      `The airport was closed for several hours. ${o.c.name} has set up a help line for families and friends of those on board.`,
    ],
    quote: [o.dead ? 'This is the darkest day in our history. Our thoughts are with the families, and we will help the investigators in every way.' : 'We are thankful everyone survived. We will help the investigators find out what happened.', `${newsSpokes(o.c)}, ${o.c.name}`] });
}
/** Your own flight, from its logbook entry (once you have registered the crash). */
function newsIncident(logId: string) {
  const l: any = State.logbook.filter(x => x.id === logId)[0]; if (!l) return; const a = plane(l.reg); if (!a) return;
  newsCrash({ key: logId, c: company(a.companyId), typeId: a.typeId, reg: a.reg, callsign: l.callsign, from: l.from, to: l.to, pax: l.pax, dead: Math.abs(l.landingFpm || 0) > 1500 || (l.g || 0) > 4 });
}
function newsMedical(f: any) {
  const a = plane(f.reg), c = a ? company(a.companyId) : company(), m = f.medical; if (!m || !newsOnce('med:' + f.id, 'med', 2 * 864e5)) return;
  newsPost(c, f.to, { section: 'News', art: newsPlaneArt(c, a ? a.typeId : undefined, f.reg),
    headline: `Passenger rushed to hospital after flight diverts to ${newsCity(f.to)}`, standfirst: `${f.callsign} turned towards ${newsCity(f.to)} when a passenger fell ill on board. Cabin crew cared for them until paramedics met the aircraft.`,
    body: [`The crew of ${c.name} flight ${f.callsign} declared a medical emergency and landed at the nearest suitable airport.`, `The flight continued later with the rest of the passengers.`],
    quote: ['The crew were calm and kind the whole time. You could see they knew exactly what to do.', 'A fellow passenger'] });
}
function newsWxDiverted(f: any) {
  const S = newsS(), day = new Date().toDateString(); S.newsWx = S.newsWx && S.newsWx.day === day ? S.newsWx : { day, n: 0, at: [] as string[] };
  S.newsWx.n++; S.newsWx.at.push(f.wxDivert ? f.wxDivert.orig : f.to);
  if (S.newsWx.n < 3) return; const a = plane(f.reg), c = a ? company(a.companyId) : company();
  if (!newsOnce('wx:' + day, 'wx', 0)) return;
  const where = S.newsWx.at.filter((x: string, i: number, l: string[]) => l.indexOf(x) === i).slice(0, 3).map(newsCity).join(', ');
  newsPost(c, f.to, { section: 'Weather', art: newsPlaneArt(c), headline: `Storms send flights elsewhere`, standfirst: `Bad weather at ${where} forced several ${c.name} flights to divert today.`,
    body: [`Low cloud, strong crosswinds and storms closed in on ${where}. Crews held or went to their alternates rather than risk a landing outside the limits.`, `Passengers were taken on by bus or on later flights.`],
    quote: ['Safety first. A diversion is annoying, but it is the right call.', `${newsSpokes(c)}, ${c.name}`] });
}
function newsFuelDump(f: any, typeId: string, kg: number, dump: boolean) {
  const a = plane(f.reg), c = a ? company(a.companyId) : company(), t = acType(typeId);
  if (!newsOnce('dump:' + f.id, 'dump', 3 * 864e5)) return;
  newsPost(c, f.to, { section: 'Aviation', art: newsPlaneArt(c, typeId, f.reg),
    headline: dump ? `${t.model} dumps fuel before returning to land` : `${t.model} circles for an hour before landing`, standfirst: `${c.name} flight ${f.callsign} had to lose about ${num(Math.round(kg / 1000))} tonnes before it could land at ${newsCity(f.to)}.`,
    body: [`Landing too heavy can damage an aircraft, so after its diversion the crew ${dump ? 'released fuel high above the sea, where it vaporises before reaching the ground' : 'flew a holding pattern to burn fuel off'}.`, `People on the ground watched it circle overhead.`],
    quote: ['It looks dramatic, but it is a routine, safe procedure.', 'A retired airline captain'] });
}
function newsCeleb(f: any, star: any) {
  if (Math.random() > 0.5) return; const a = plane(f.reg), c = a ? company(a.companyId) : company();
  if (!newsOnce('celeb:' + f.id, 'celeb', 864e5)) return;
  newsPost(c, f.to, { section: 'People', art: star.look ? { kind: 'person', look: star.look, role: 'pax', color: c.color } : newsPlaneArt(c),
    headline: `${star.famous} spotted on ${c.name} flight`, standfirst: `${star.name} flew from ${newsCity(f.from)} to ${newsCity(f.to)} on ${f.callsign} and posed for selfies at the gate.`,
    body: [`Fellow passengers said the ${star.famous.toLowerCase()} was friendly and chatted with the cabin crew.`, `${c.name} would not comment on its passengers.`],
    quote: ['Just a normal flight, really. The crew were lovely.', star.name] });
}
function newsBan(rec: any, until: number | null) {
  const c = company(); if (!newsOnce('ban:' + rec.key + ':' + (until || 'life'), 'ban', 864e5)) return;
  newsPost(c, c.hub, { section: 'News', art: { kind: 'court' }, headline: until ? `Unruly passenger banned by ${c.name}` : `${c.name} bans passenger for life`,
    standfirst: `A passenger has been barred from ${c.name} flights ${until ? 'until ' + dateStr(new Date(until)).slice(0, 10) : 'for good'} after trouble on board.`,
    body: [`Cabin crew reported the passenger after the incident. The airline's decision follows its zero-tolerance policy on abuse of staff.`],
    quote: ['Our crew have the right to do their job safely.', `${newsSpokes(c)}, ${c.name}`] });
}
function newsKind(p: any, cid: string, what: string) {
  if (Math.random() > 0.25) return; const c = company(p.companyId || cid) || company();
  if (!newsOnce('kind:' + p.id + ':' + Math.floor(Date.now() / 864e5), 'kind', 3 * 864e5)) return;
  newsPost(c, p.base || c.hub, { section: 'People', art: p.look ? { kind: 'person', look: p.look, role: personRole(p) || 'fa', color: c.color } : newsPlaneArt(c),
    headline: newsPick(p.id, [`${p.name.split(' ').slice(-1)[0]} goes the extra mile`, `The ${levelTitle(p).toLowerCase()} passengers can't stop talking about`]),
    standfirst: `${p.name} of ${c.name} has been praised by the airline${what ? ' for ' + what : ''}.`,
    body: [`Passengers wrote to the airline about the care they were shown. The airline passed on its thanks.`],
    quote: ['It is just the job. But it is nice to hear.', p.name] });
}
function newsPet(f: any, petName: string, kind: string) {
  if (Math.random() > 0.15) return; const a = plane(f.reg), c = a ? company(a.companyId) : company();
  if (!newsOnce('pet:' + f.id, 'pet', 7 * 864e5)) return;
  newsPost(c, f.to, { section: 'Pets', art: newsPlaneArt(c), headline: `${petName} the ${kind} wins over the crew`, standfirst: `A ${kind} travelling on ${f.callsign} got a visit from the flight deck mid-flight.`,
    body: [`Crew at ${c.name} sometimes check on pets travelling with passengers or in the hold. This one got a scratch behind the ears and a lot of attention.`],
    quote: ['Best part of my week.', 'A member of the crew'] });
}
function newsLoan(cid: string, amount: number, lender: string) {
  const c = company(cid); if (!c || amount < 1e6 || !newsOnce('loan:' + cid + ':' + Math.floor(Date.now() / 864e5), 'loan', 7 * 864e5)) return;
  newsPost(c, c.hub, { section: 'Business', headline: `${c.name} borrows ${money(amount, { compact: true })}`, standfirst: `${lender} is lending ${c.name} ${money(amount, { compact: true })} to grow its fleet and network.`,
    body: [`The money is to be paid back in monthly instalments. Analysts say borrowing is normal for a growing airline, as long as the routes pay.`],
    quote: ['We are investing in growth.', `${newsSpokes(c)}, ${c.name}`] });
}
function newsWhistle(c: Company, p: any, what: string) {
  if (!newsOnce('wb:' + c.id + ':' + Math.floor(Date.now() / 864e5), 'wb', 0)) return;
  newsPost(c, c.hub, { section: 'Investigation', art: { kind: 'court' }, headline: `Insider speaks out about ${c.name}`, standfirst: `A member of staff says management ignored their warnings about ${what}.`,
    body: [`The employee went to the press after raising the matter inside the airline. The aviation authority says it is looking into the claims.`, `${c.name} says it takes safety seriously.`],
    quote: ['I raised it properly. Nothing happened. Passengers deserve to know.', p ? `${p.name}, ${levelTitle(p).toLowerCase()}` : 'The whistleblower'] });
}

/* ---------- co-op ---------- */
function newsCoopJoin(m: any) {
  const c = company(); if (!newsOnce('cj:' + m.id, 'cj', 6 * 3600e3)) return;
  newsPost(c, c.hub, { section: 'People', art: m.look ? { kind: 'person', look: m.look, role: 'captain', color: c.color } : newsPlaneArt(c),
    headline: `${m.nat ? countryName(m.nat) + ' pilot' : 'New pilot'} ${m.name} joins ${c.name}`, standfirst: `${m.name} is the latest pilot to fly for the co-operative airline.`,
    body: [`${c.name}'s pilots fly together from their own homes. ${m.name} brings the team to ${coopState() ? coopState().members.length : 'several'} pilots.`],
    quote: ['Looking forward to my first flight with the team.', m.name] });
}
function newsCoopMilestone(m: any) {
  if ([10, 50, 100, 250, 500].indexOf(m.flights) < 0) return; const c = company();
  if (!newsOnce('cm:' + m.id + ':' + m.flights, 'cm', 0)) return;
  newsPost(c, m.base || c.hub, { section: 'People', art: m.look ? { kind: 'person', look: m.look, role: 'captain', color: c.color } : newsPlaneArt(c),
    headline: `${m.flights} flights for ${m.name}`, standfirst: `${m.name} has flown ${m.flights} flights for ${c.name}.`, body: [`${hours(m.hoursMin)} in the air and ${money(m.revenue, { compact: true })} earned for the airline.`],
    quote: ['Here is to the next ones.', m.name] });
}

/* ---------- the watch: milestones, anniversaries, money, fines, crew records, reviews ---------- */
function newsWatch(quiet?: boolean) {
  const S = newsS(), now = Date.now(), firstRun = !S.newsWatchV1;
  for (const c of State.companies) {
    if ((c as any).real) continue;
    const regs: any = {}; fleetOf(c.id).forEach(a => regs[a.reg] = 1);
    const log = State.logbook.filter(l => regs[l.reg] || ((l as any).coopBy && c.id === State.companyId));
    const flights = log.length, pax = log.reduce((s, l: any) => s + (l.pax || 0), 0);
    const mark = (key: string) => { if (firstRun || quiet) { S.newsSeen[key] = now; return false; } return !S.newsSeen[key]; };
    for (const n of [100, 500, 1000, 2500, 5000, 10000]) if (flights >= n && mark(`mf:${c.id}:${n}`) && newsOnce(`mf:${c.id}:${n}`, 'mile', 0))
      newsPost(c, c.hub, { section: 'Business', headline: `${num(n)} flights for ${c.name}`, standfirst: `${c.name} has flown its ${num(n)}th flight since it was founded.`, body: [`The airline has carried ${num(pax)} passengers so far.`], quote: ['A big thank you to our crews and every passenger.', `${newsSpokes(c)}, ${c.name}`] });
    for (const n of [10000, 100000, 500000, 1000000]) if (pax >= n && mark(`mp:${c.id}:${n}`) && newsOnce(`mp:${c.id}:${n}`, 'mile', 0))
      newsPost(c, c.hub, { section: 'Business', headline: `${c.name} welcomes passenger number ${num(n)}`, standfirst: `The lucky traveller was met at the gate with flowers and a free return ticket.`, body: [`${num(n)} people have now flown ${c.name}, on ${num(flights)} flights.`], quote: ['I had no idea! What a lovely surprise.', 'The passenger'] });
    const yrs = c.founded ? Math.floor((now - new Date(c.founded).getTime()) / (365.25 * 864e5)) : 0;
    if (yrs >= 1 && mark(`ann:${c.id}:${yrs}`) && newsOnce(`ann:${c.id}:${yrs}`, 'ann', 0))
      newsPost(c, c.hub, { section: 'Business', headline: `${c.name} turns ${yrs}`, standfirst: `${yrs} year${yrs > 1 ? 's' : ''} after its first flight, ${c.name} flies ${fleetOf(c.id).length} aircraft.`, body: [`Staff celebrated with cake in the hangar.`], quote: ['Thank you for flying with us.', `${myPilot().name}, founder`] });
    const mon = new Date().toISOString().slice(0, 7);
    if (c.balance < 0 && mark(`neg:${c.id}:${mon}`) && newsOnce(`neg:${c.id}:${mon}`, 'neg', 20 * 864e5))
      newsPost(c, c.hub, { section: 'Business', headline: `${c.name} in the red`, standfirst: `${c.name}'s account is overdrawn by ${money(-c.balance, { compact: true })}. Suppliers are said to be worried.`, body: [`The airline says it has a plan to return to profit.`], quote: ['We are confident in our future.', `${newsSpokes(c)}, ${c.name}`] });
    // reviews over the last 40 flights
    const rv = paxReviews().filter(r => regs[r.reg]).slice(0, 40);
    if (rv.length >= 20) {
      const avg = rv.reduce((s, r) => s + r.avg, 0) / rv.length;
      if (avg >= 4.5 && !firstRun && newsOnce(`rvg:${c.id}:${mon}`, 'rv', 30 * 864e5)) newsPost(c, c.hub, { section: 'Travel', headline: `Passengers rate ${c.name} among the best`, standfirst: `An average of ${avg.toFixed(1)} stars from its passengers puts ${c.name} near the top in the region.`, body: [`Travellers praise the crews, the punctuality and the service.`], quote: ['Friendly, on time, clean. What more do you want?', 'A frequent flyer'] });
      if (avg <= 2.6 && !firstRun && newsOnce(`rvb:${c.id}:${mon}`, 'rv', 30 * 864e5)) newsPost(c, c.hub, { section: 'Travel', headline: `Passengers unhappy with ${c.name}`, standfirst: `Reviews averaging ${avg.toFixed(1)} stars show travellers are losing patience.`, body: [`Complaints mention delays, service and comfort.`], quote: ['Never again.', 'A passenger'] });
    }
  }
  // fines from the authority
  for (const ref of Object.keys(State.fines || {})) {
    const f: any = (State.fines as any)[ref], key = 'fine:' + ref;
    if (firstRun || quiet) { S.newsSeen[key] = now; continue; }
    if (S.newsSeen[key] || !f || !newsOnce(key, 'fine', 864e5)) continue;
    const c = company(f.companyId || State.companyId) || company();
    newsPost(c, f.airport || c.hub, { section: 'News', art: { kind: 'court' }, headline: `${c.name} fined by the authority`, standfirst: `${f.authority || 'The aviation authority'} has fined ${c.name}${f.amount ? ' ' + money(f.amount) : ''}: ${String(f.title || 'a rule broken').toLowerCase()}.`, body: [`The airline can pay or appeal.`], quote: ['Rules are there for everyone\'s safety.', f.authority || 'The authority'] });
  }
  // crew records
  const people = State.pilots.concat((S.staff || []) as any[]);
  for (const p of people as any[]) {
    for (const h of [10000, 20000]) { const key = `hrs:${p.id}:${h}`; if ((p.hoursMin || 0) >= h * 60 && !S.newsSeen[key]) {
      if (firstRun || quiet) { S.newsSeen[key] = now; continue; }
      const c = company(p.companyId) || company(); if (!newsOnce(key, 'crew', 2 * 864e5)) continue;
      newsPost(c, p.base || c.hub, { section: 'People', art: p.look ? { kind: 'person', look: p.look, role: personRole(p) || 'captain', color: c.color } : newsPlaneArt(c), headline: `${num(h)} hours in the air for ${p.name}`, standfirst: `${p.name} of ${c.name} has passed ${num(h)} flying hours.`, body: [`That is more than ${Math.round(h / 24 / 365 * 10) / 10} years spent in the air.`], quote: ['I still love every take-off.', p.name] }); } }
  }
  S.newsWatchV1 = true;
  // a new airline founded before the app restarted
  try { const k = localStorage.getItem('amp-news-first'); if (k) { localStorage.removeItem('amp-news-first'); newsFounded(State.companyId, k as any); } } catch (e) { /* ignore */ }
}
function startNewsWatch() { setTimeout(() => newsWatch(), 20000); setInterval(() => { if (!document.hidden) newsWatch(); }, 60000); }

/* ---------- the Newspaper section ---------- */
let _npSec = 'all';
SCREENS.news = {
  title: 'Newspaper', icon: 'news',
  render() {
    const all = newsList().filter(a => !a.companyId || State.companies.some(c => c.id === a.companyId));
    // pet stories printed before the Pets section existed move there
    all.forEach((a: any) => { if (a.section === 'People' && / wins over the crew$/.test(a.headline || '')) { a.section = 'Pets'; Store.soon(); } });
    const secs = ['all'].concat(all.map(a => a.section).filter((s, i, l) => l.indexOf(s) === i));
    const list = all.filter(a => _npSec === 'all' || a.section === _npSec);
    const when = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<div class="screen-head"><div><h1>Newspaper</h1><p class="sub">Everything written about your airlines</p></div></div>
      <div class="filter-row">${secs.map(s => `<button class="fchip ${_npSec === s ? 'on' : ''}" data-act="np-sec" data-s="${esc(s)}">${s === 'all' ? 'All' : esc(s)}</button>`).join('')}</div>
      <div class="np-grid">${list.map((a, i) => `<button class="np-card ${i === 0 && _npSec === 'all' ? 'lead' : ''}" data-act="news-open" data-id="${esc(a.id)}">
        <small class="np-cp">${esc(a.paper)} · ${esc(a.section)} · ${when(a.at)}</small><b>${esc(a.headline)}</b><span>${esc(a.standfirst)}</span>
        <small class="np-cc">${esc(company(a.companyId) ? company(a.companyId).name : '')}</small></button>`).join('') || emptyState('No news yet', 'When your airline makes the papers, the articles are kept here.', '', '')}</div>`;
  },
};
ACTIONS['np-sec'] = el => { _npSec = el.getAttribute('data-s'); Sound.tick(); refresh(); };
