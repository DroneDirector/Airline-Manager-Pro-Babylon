// Link to the Airline Manager Pro PC app over the local network: the same Wi-Fi, or the PC joined
// to this phone's hotspot (the PC then uses the phone's mobile data).
// Finds the PC (UDP discovery through the native LanLink plugin), pairs with the 6-digit code
// shown on the PC, remembers it, and reconnects automatically.

const LINK_PORT = 47610;

/** Weather at your aircraft, as Flight Simulator has it. */
interface SimWeather {
  windDir: number; windKt: number; visM: number; tempC: number; qnhHpa: number;
  precip: 'none' | 'rain' | 'snow'; precipMm: number; inCloud: boolean;
  turb: 'none' | 'light' | 'moderate' | 'severe';
}

interface SimSnapshot {
  t: number; connected: boolean; sim: string; inFlight: boolean; paused: boolean; title: string; atcId: string; atcModel: string; atcType: string;
  lat: number; lon: number; altFt: number; aglFt: number; hdg: number; ias: number; gs: number; vsFpm: number; g: number; pitch: number;
  onGround: boolean; parkingBrake: boolean; enginesRunning: number; engines: number; flapsIndex: number; gearDown: boolean;
  fuelKg: number; emptyKg: number; totalKg: number; mtowKg: number; stations: { name: string; kg: number }[];
  // GSX Pro: passengers, and the state of each ground service (0 unknown, 1 available, 2 not available,
  // 3 bypassed, 4 requested, 5 being done, 6 completed)
  gsx: { running: boolean; boardingState: number; paxBoarded: number; paxTotal: number; cargoPct: number;
    deboarding?: number; catering?: number; refueling?: number; departure?: number; deicing?: number; fuelHose?: boolean };
  approachAirport: string; phase: string; from: string;
  wx?: SimWeather;              // weather at the aircraft from the simulator (PC app 0.5.1 and later)
  simTime?: number;             // the simulator's date and time (ms since 1970, UTC), PC app 0.9.38 and later
  simTz?: number;               // the local time's offset from UTC where the aircraft is, in minutes, PC app 0.9.44 and later
  fires?: boolean[];            // engines on fire in the simulator, PC app 0.9.44 and later
  engFailed?: boolean[];        // engines failed in the simulator, PC app 0.9.44 and later
}
interface FlightEvent {
  type: string; t: number; lat: number; lon: number; airport?: string; fpm?: number; g?: number; pitch?: number; bounces?: number;
  code?: string; severity?: 'minor' | 'major' | 'grounding'; detail?: string;
  summary?: { from: string; to: string; blockMin: number; airMin: number; distanceNm: number; fuelUsedKg: number; landingFpm: number; landingG: number; pax: number; cargoKg: number; aircraftTitle: string; atcId: string };
}
interface FoundPc { pcName: string; ip: string; version: string; port: number; addresses?: string[] }

function lanPlugin(): any { const c = (window as any).Capacitor; return c && c.Plugins && c.Plugins.LanLink; }

const Link = {
  ws: null as WebSocket,
  status: 'unpaired' as 'unpaired' | 'connecting' | 'pairing' | 'connected' | 'offline',
  sim: null as SimSnapshot,
  retry: 0 as any,
  pending: null as { resolve: (r: any) => void } ,
  lastMsg: 0,
  latency: 0,
  via: 'wifi' as 'wifi' | 'hotspot' | 'usb',
  net: null as any,

  get pc(): { ip: string; name: string; token: string } { return (State as any).linkPc || null; },

  init() {
    // the app on the PC talks to the PC app on the same computer, no pairing needed
    if (DESKTOP) { (State as any).linkPc = { ip: '127.0.0.1', name: 'This PC', token: 'local' }; (State as any).linkedOnce = true; this.connect('127.0.0.1'); }
    else if (this.pc) this.connect(this.pc.ip);
    setInterval(() => this.heartbeat(), 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.pc && this.status !== 'connected') this.connect(this.pc.ip); });
  },

  /** Network details from the phone: Wi-Fi (its name needs the location permission on Android) and the phone's hotspot. */
  async wifiInfo(ask?: boolean): Promise<{ ssid: string; ip: string; level: number; wifi: boolean; cellular: boolean; hotspot?: boolean; hotspotIp?: string; hotspotKind?: string }> {
    const p = lanPlugin();
    if (p) { try { const r = await p.wifiInfo({ askLocation: !!ask }); this.net = r; return r; } catch (e) { /* fall through */ } }
    return { ssid: '', ip: '', level: 0, wifi: navigator.onLine, cellular: false, hotspot: false };
  },

  /** Whether a PC address is on the phone's hotspot (or USB tethering) rather than Wi-Fi. */
  viaFor(ip: string): 'wifi' | 'hotspot' | 'usb' {
    const n = this.net;
    if (n && n.hotspot && n.hotspotIp && ip && n.hotspotIp.split('.').slice(0, 3).join('.') === ip.split('.').slice(0, 3).join('.')) return n.hotspotKind === 'usb' ? 'usb' : 'hotspot';
    return 'wifi';
  },

  /** Look for PC apps on the local network. */
  async discover(): Promise<FoundPc[]> {
    const p = lanPlugin();
    const out: FoundPc[] = [];
    if (p) { try { const r = await p.discover({ timeout: 1800 }); (r.pcs || []).forEach((x: any) => out.push(x)); } catch (e) { /* no Wi-Fi */ } }
    // browser preview or no reply: try this computer and the last known PC directly
    const tryHosts = ['127.0.0.1'].concat(this.pc ? [this.pc.ip] : []);
    for (const h of tryHosts) {
      if (out.some(x => x.ip === h)) continue;
      try {
        const ctl = new AbortController(); setTimeout(() => ctl.abort(), 900);
        const r = await fetch(`http://${h}:${LINK_PORT}/info`, { signal: ctl.signal });
        const j = await r.json(); out.push(Object.assign(j, { ip: h }));
      } catch (e) { /* not there */ }
    }
    return out;
  },

  connect(ip: string, code?: string): Promise<{ ok: boolean; reason?: string }> {
    clearTimeout(this.retry);
    if (this.ws) { try { this.ws.onclose = null; this.ws.close(); } catch (e) { /* closed */ } }
    this.status = code ? 'pairing' : 'connecting';
    this.via = this.viaFor(ip);
    if (!this.net) this.wifiInfo(false).then(() => { this.via = this.viaFor(ip); linkChanged(); });
    linkChanged();
    return new Promise(resolve => {
      let done = false;
      const finish = (r: { ok: boolean; reason?: string }) => { if (!done) { done = true; resolve(r); } };
      let ws: WebSocket;
      try { ws = new WebSocket(`ws://${ip}:${LINK_PORT}`); } catch (e) { this.status = 'offline'; linkChanged(); finish({ ok: false, reason: 'Can\'t reach that address.' }); return; }
      this.ws = ws;
      const timer = setTimeout(() => { if (ws.readyState !== 1) { try { ws.close(); } catch (e) { /* closed */ } finish({ ok: false, reason: 'The PC didn\'t answer. Check that the PC app is running and that the PC is on the same Wi-Fi or your phone\'s hotspot.' }); } }, 5000);
      ws.onopen = () => {
        clearTimeout(timer);
        const device = DESKTOP ? 'This PC' : 'Android phone';
        if (DESKTOP) ws.send(JSON.stringify({ type: 'hello', device, local: true }));
        else if (code) ws.send(JSON.stringify({ type: 'pair', code, device }));
        else ws.send(JSON.stringify({ type: 'hello', device, token: this.pc ? this.pc.token : undefined }));
      };
      ws.onmessage = ev => {
        let m: any; try { m = JSON.parse(ev.data); } catch (e) { return; }
        this.lastMsg = Date.now();
        if (m.type === 'welcome') { (ws as any)._pcName = m.pcName; (ws as any)._version = m.version; }
        else if (m.type === 'pair-result') {
          if (m.ok) {
            (State as any).linkPc = { ip, name: DESKTOP ? 'This PC' : (ws as any)._pcName || ip, token: m.token };
            (State as any).linkedOnce = true;
            this.status = 'connected'; Store.save(); linkChanged();
            onLinked();
            finish({ ok: true });
          } else { this.status = this.pc ? 'offline' : 'unpaired'; linkChanged(); finish({ ok: false, reason: m.reason || 'Pairing failed.' }); }
        }
        else if (m.type === 'state') onSimState(m.s);
        else if (m.type === 'event') onSimEvent(m.e);
        else if (m.type === 'airports') onAirports(m.list);
        else if (m.type === 'layout') { try { AirportLayouts.received(m.icao, m.layout, m.error); } catch (e) { /* ignore */ } }
        else if (m.type === 'awy') { try { AirwayRoutes.received(m.from, m.to, m.cls, m.route, m.error); } catch (e) { /* ignore */ } }
        else if (m.type === 'procs') { try { SimProcedures.received(m.icao, m.procs, m.error); } catch (e) { /* ignore */ } }
        else if (m.type === 'flightplan-saved') { try { plnSaved(m.path, m.error); } catch (e) { /* ignore */ } }
        else if (m.type === 'aircraft-list') { try { InstalledAircraft.received(m.list || [], m.error); } catch (e) { /* ignore */ } }
        else if (m.type === 'all-airports') { try { onSimAirportList(m); } catch (e) { /* ignore */ } }
        else if (m.type === 'pong') this.latency = Date.now() - m.t;
      };
      ws.onclose = () => {
        clearTimeout(timer);
        if (this.ws !== ws) return;
        const was = this.status;
        this.status = this.pc ? 'offline' : 'unpaired';
        this.sim = null; onSimState(null);
        linkChanged();
        finish({ ok: false, reason: 'The PC didn\'t answer. Check that the PC app is running and that the PC is on the same Wi-Fi or your phone\'s hotspot.' });
        if (this.pc) this.retry = setTimeout(() => this.reconnect(), was === 'connected' ? 2000 : 6000);
      };
      ws.onerror = () => { /* onclose follows */ };
    });
  },

  /** Reconnect to the paired PC, finding it again if its address changed. */
  async reconnect() {
    if (!this.pc || this.status === 'connected' || document.hidden) { if (this.pc && this.status !== 'connected') this.retry = setTimeout(() => this.reconnect(), 8000); return; }
    const found = await this.discover();
    const same = found.filter(x => x.pcName === this.pc.name)[0];
    if (same && same.ip !== this.pc.ip) { (State as any).linkPc.ip = same.ip; Store.save(); }
    this.connect(this.pc.ip);
  },

  heartbeat() {
    if (this.ws && this.status === 'connected' && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
  },

  forget() {
    (State as any).linkPc = null; Store.save();
    if (this.ws) { try { this.ws.onclose = null; this.ws.close(); } catch (e) { /* closed */ } }
    this.status = 'unpaired'; this.sim = null; onSimState(null); linkChanged();
  },
};

/** Refresh everything that shows the link status. */
function linkChanged() {
  const b: any = State.bridge;
  b.pc = Link.status === 'connected' ? 'connected' : Link.status === 'unpaired' ? 'offline' : 'searching';
  b.link = Link.status === 'connected' ? Link.via : 'none';
  if (Link.pc) { b.pcName = Link.pc.name; b.pcIp = Link.pc.ip; }
  b.latencyMs = Link.latency || b.latencyMs;
  renderTopbar();
  const set = $('#set-body'); if (set && _setSection === 'sync') rerenderSettingsBody();
}
