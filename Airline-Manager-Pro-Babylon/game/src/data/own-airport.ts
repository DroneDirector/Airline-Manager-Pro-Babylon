// Your own airports (made up, not in the world's lists): Mýrdalssandur, BIAP / VTX, on the black sands of south Iceland
// where your terminal stands. They are in every airport list (found by ICAO, IATA, name or place), with their runway,
// and their layout is built from their own plan (own-airport-layout.ts), never fetched from a map or the simulator:
// the airport view, the world map's drawing at airport level, the taxiing and the 3D viewer all use it.
(function ownAirportsInit() {
  for (const r of OWN_AIRPORT_LIST) {
    const [icao, iata, name, city, country, lon, lat, elev] = r;
    const a: any = { icao, name, city, country, pos: [lon, lat], iata, elev, size: 2, sched: true, own: true };
    AIRPORTS[icao] = a;
    try { if (!World.by[icao]) { World.by[icao] = a; World.list.push(a); } } catch (e) { /* the curated list has it */ }
  }
})();
/** Is this one of your own airports? */
function isOwnAirport(icao: string): boolean { return !!OWN_AIRPORT_LAYOUTS[String(icao || '').toUpperCase()]; }
/** Your own airport's layout (a fresh copy), or null. */
function ownAirportLayout(icao: string): any { const L = OWN_AIRPORT_LAYOUTS[String(icao || '').toUpperCase()]; return L ? JSON.parse(JSON.stringify(L)) : null; }
/** Your own airports' runways, added to the world's runway list: [id1, id2, length ft, width ft, surface, ends, heading]. */
function ownAirportRunways(rw: { [ident: string]: any[] }) {
  for (const r of OWN_AIRPORT_LIST) { const x = r[8]; rw[r[0]] = [[x.id1, x.id2, x.lenFt, x.widFt, 'ASP', x.e1[0], x.e1[1], x.e2[0], x.e2[1], x.hdg]]; }
  return rw;
}
