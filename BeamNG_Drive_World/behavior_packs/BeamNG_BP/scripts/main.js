// BeamNG Drive – menu, vehicle driving assist and crash damage.
// Uses only @minecraft/server and @minecraft/server-ui (stable APIs).
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const VEHICLES = [{"id": "apex_gt", "name": "Apex GT", "cat": "sports", "top": 190, "t60": 3.8, "mass": 1450, "engine": "super", "pitch": 1.0}, {"id": "falcon_rs", "name": "Falcon RS", "cat": "sports", "top": 170, "t60": 4.4, "mass": 1500, "engine": "super", "pitch": 1.0}, {"id": "kaze_86", "name": "Kaze Drift 86", "cat": "jdm", "top": 155, "t60": 6.0, "mass": 1150, "engine": "i4", "pitch": 1.0}, {"id": "rotor_rx", "name": "Rotor RX Turbo", "cat": "jdm", "top": 175, "t60": 4.9, "mass": 1300, "engine": "rotary", "pitch": 1.0}, {"id": "zenith_gt", "name": "Zenith GT-R", "cat": "jdm", "top": 185, "t60": 3.9, "mass": 1700, "engine": "i4", "pitch": 1.0}, {"id": "metro_sedan", "name": "Metro Sedan", "cat": "family", "top": 140, "t60": 9.5, "mass": 1400, "engine": "i4", "pitch": 1.0}, {"id": "summit_suv", "name": "Summit SUV", "cat": "family", "top": 130, "t60": 9.0, "mass": 2100, "engine": "v6", "pitch": 1.0}, {"id": "ranger_pickup", "name": "Ranger Pickup", "cat": "pickup", "top": 125, "t60": 9.8, "mass": 2000, "engine": "v6", "pitch": 1.0}, {"id": "titan_hd", "name": "Titan HD 3500", "cat": "pickup", "top": 115, "t60": 11.5, "mass": 3200, "engine": "diesel", "pitch": 1.0}, {"id": "dune_buggy", "name": "Dune Runner", "cat": "offroad", "top": 110, "t60": 5.0, "mass": 700, "engine": "buggy", "pitch": 1.0}, {"id": "rock_crawler", "name": "Rock Crawler 4x4", "cat": "offroad", "top": 75, "t60": 8.0, "mass": 2500, "engine": "v8", "pitch": 1.0}, {"id": "trail_jeep", "name": "Trail Boss 4x4", "cat": "offroad", "top": 105, "t60": 8.5, "mass": 1700, "engine": "v6", "pitch": 1.0}, {"id": "bulldog_muscle", "name": "Bulldog Muscle", "cat": "muscle", "top": 165, "t60": 5.0, "mass": 1650, "engine": "v8", "pitch": 1.0}, {"id": "stallion_gt", "name": "Stallion GT", "cat": "muscle", "top": 160, "t60": 5.4, "mass": 1600, "engine": "v8", "pitch": 1.0}, {"id": "police_cruiser", "name": "Metro Police Cruiser", "cat": "police", "top": 165, "t60": 6.5, "mass": 1800, "engine": "v8", "pitch": 1.0}, {"id": "police_suv", "name": "Police Interceptor SUV", "cat": "police", "top": 155, "t60": 6.8, "mass": 2300, "engine": "v8", "pitch": 1.0}, {"id": "box_truck", "name": "Hauler Box Truck", "cat": "heavy", "top": 100, "t60": 15, "mass": 6500, "engine": "diesel", "pitch": 1.0}, {"id": "semi_tractor", "name": "Titan Semi Tractor", "cat": "heavy", "top": 95, "t60": 19, "mass": 8500, "engine": "diesel", "pitch": 1.0}, {"id": "dump_truck", "name": "Quarry Dump Truck", "cat": "heavy", "top": 80, "t60": 17, "mass": 9000, "engine": "diesel", "pitch": 1.0}];
const CATS = [["sports", "Sports & Supercars"], ["jdm", "Japanese Tuners"], ["family", "Sedans & SUVs"], ["pickup", "Pickup Trucks"], ["offroad", "Off-Road"], ["muscle", "Muscle Cars"], ["police", "Police"], ["heavy", "Heavy Trucks"]];
const MAPS = {"utah": {"name": "Utah – Kaiparowits", "label": "🏜️ Utah — Kaiparowits", "x": 322, "y": 57, "z": 3016, "yaw": 0}, "canada": {"name": "Canada – Lapiz Point", "label": "🇨🇦 Canada — Lapiz Point", "x": 8388, "y": 69, "z": -1854, "yaw": 0}, "sunshine": {"name": "Sunshine Coast – Maroochydore", "label": "🌊 Sunshine Coast — Maroochydore", "x": 1058, "y": -51, "z": 6416, "yaw": 0}, "outback": {"name": "Australian Outback – Perkins County", "label": "🇦🇺 Australian Outback — Perkins County", "x": 4131, "y": -48, "z": 6066, "yaw": 0}};
const MAP_ORDER = ["utah", "canada", "sunshine", "outback"];


const LEVELS = 20;
const VEH = {};
for (const v of VEHICLES) VEH["beam:" + v.id] = v;
const state = new Map();            // vehicle entity id -> runtime state
const OVERWORLD = () => world.getDimension("overworld");
const sleep = (t) => new Promise((res) => system.runTimeout(res, t));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const safe = (fn, dflt) => { try { return fn(); } catch (e) { return dflt; } };

// ---------------------------------------------------------------- settings
const DEFAULTS = { units: "kmh", damage: "real", lights: "auto", sound: 2, hud: 1, siren: 0, nv: 1 };
function getSet(player, key) {
  const v = safe(() => player.getDynamicProperty("beam:set_" + key), undefined);
  return v === undefined ? DEFAULTS[key] : v;
}
function setSet(player, key, value) { safe(() => player.setDynamicProperty("beam:set_" + key, value)); }
const DAMAGE_MULT = { off: 0, arcade: 0.5, real: 1.0 };
const SOUND_VOL = [0, 0.35, 0.7, 1.0];

// ---------------------------------------------------------------- helpers
function getVehicle(player) {
  return safe(() => {
    const e = player.getComponent("minecraft:riding")?.entityRidingOn;
    return e && VEH[e.typeId] ? e : undefined;
  }, undefined);
}
function isDriver(player, vehicle) {
  return safe(() => {
    const riders = vehicle.getComponent("minecraft:rideable").getRiders();
    return riders.length === 0 || riders[0].id === player.id;
  }, true);
}
function ownedVehicles(player) {
  return safe(() => OVERWORLD().getEntities({ families: ["beam_vehicle"] })
    .filter((e) => safe(() => e.getDynamicProperty("beam:owner"), "") === player.id), []);
}
function hpFraction(v) {
  return safe(() => {
    const h = v.getComponent("minecraft:health");
    return h.currentValue / h.effectiveMax;
  }, 1);
}
function stateForHp(f) { return f > 0.75 ? 0 : f > 0.45 ? 1 : f > 0.2 ? 2 : 3; }
function playSnd(dim, player, id, loc, volume, pitch) {
  if (volume <= 0) return;
  const opt = { volume, pitch };
  if (!safe(() => { dim.playSound(id, loc, opt); return true; }, false)) safe(() => player.playSound(id, opt));
}
function particle(dim, id, loc) { safe(() => dim.spawnParticle(id, loc)); }
function isNight() { const t = safe(() => world.getTimeOfDay(), 0); return t > 12500 && t < 23500; }
function fwd(yawDeg) { const r = yawDeg * Math.PI / 180; return { x: -Math.sin(r), z: Math.cos(r) }; }

// ---------------------------------------------------------------- vehicles
function spawnVehicle(player, vid, loc, yaw, seat) {
  for (const old of ownedVehicles(player)) safe(() => old.remove());
  const dim = OVERWORLD();
  const v = dim.spawnEntity("beam:" + vid, loc);
  safe(() => v.setDynamicProperty("beam:owner", player.id));
  safe(() => v.teleport(loc, { dimension: dim, rotation: { x: 0, y: yaw } }));
  safe(() => v.setRotation({ x: 0, y: yaw }));
  state.set(v.id, newState());
  player.setDynamicProperty("beam:vehicle", vid);
  if (seat) system.runTimeout(() => safe(() => v.getComponent("minecraft:rideable").addRider(player)), 4);
  return v;
}
function newState() {
  return { lvl: 0, applied: 0, prevHs: 0, prevVy: 0, dmg: 0, lights: false, tick: 0, lastCrash: -100, brake: false };
}
function repair(v) {
  safe(() => v.getComponent("minecraft:health").resetToMaxValue());
  safe(() => v.triggerEvent("beam:dmg_0"));
  const s = state.get(v.id); if (s) { s.dmg = 0; s.lvl = 0; }
}
function say(player, msg) { safe(() => player.onScreenDisplay.setActionBar(msg)); }

// ---------------------------------------------------------------- driving + crash tick
function driveTick(player, v) {
  const info = VEH[v.typeId];
  let s = state.get(v.id); if (!s) { s = newState(); state.set(v.id, s); }
  s.tick++;
  const driver = isDriver(player, v);
  const vel = safe(() => v.getVelocity(), { x: 0, y: 0, z: 0 });
  const hs = Math.hypot(vel.x, vel.z);
  const frac = hpFraction(v);
  const dmgState = stateForHp(frac);
  if (dmgState !== s.dmg) { s.dmg = dmgState; safe(() => v.triggerEvent("beam:dmg_" + dmgState)); if (dmgState === 3) wreckFx(v, player, true); }
  const wrecked = dmgState === 3;

  // --- input -> speed level
  if (driver) {
    const inp = safe(() => player.inputInfo.getMovementVector(), { x: 0, y: 0 });
    const f = inp.y;
    const accelPerTick = (LEVELS / Math.max(1.5, info.t60 * 1.35)) / 20 * 1.0 * 1.0;
    s.brake = false;
    if (wrecked) s.lvl = Math.max(0, s.lvl - 1);
    else if (f > 0.25) s.lvl = Math.min(LEVELS, s.lvl + accelPerTick * 3.2 * f);
    else if (f < -0.25) {
      if (s.lvl > 3.5) { s.lvl = Math.max(0, s.lvl - 1.1); s.brake = true; }   // braking
      else s.lvl = 3;                                                          // reverse crawl
    } else s.lvl = Math.max(0, s.lvl - 0.18);                                  // coasting
  } else {
    s.lvl = Math.max(0, s.lvl - 0.5);
  }

  // --- crash detection (sudden loss of speed or hard landing)
  const dh = Math.max(0, s.prevHs - hs);
  const dvert = s.prevVy < -0.35 ? Math.max(0, vel.y - s.prevVy) : 0;
  const impactKmh = Math.hypot(dh, dvert) * 72;
  if (impactKmh > 22 && s.tick - s.lastCrash > 6 && (s.applied >= 2 || dvert > 0.3) && driver) {
    s.lastCrash = s.tick;
    crash(player, v, info, s, impactKmh);
  }
  s.prevHs = hs; s.prevVy = vel.y;

  const lvl = Math.round(s.lvl);
  if (lvl !== s.applied) { s.applied = lvl; safe(() => v.triggerEvent("beam:spd_" + lvl)); }

  // --- lights
  if (s.tick % 10 === 1) {
    const mode = getSet(player, "lights");
    const want = wrecked ? false : mode === "on" ? true : mode === "off" ? false : (isNight() || info.cat === "police");
    if (want !== s.lights) { s.lights = want; safe(() => v.triggerEvent(want ? "beam:lights_on" : "beam:lights_off")); }
    if (s.lights && isNight() && getSet(player, "nv") && !wrecked) safe(() => player.addEffect("night_vision", 260, { amplifier: 0, showParticles: false }));
  }

  // --- sound
  if (s.tick % 7 === 0 && !wrecked) {
    const vol = SOUND_VOL[getSet(player, "sound")] ?? 0.7;
    const sp = clamp(hs * 72 / info.top, 0, 1.2);
    const pitch = 0.55 + 1.15 * Math.pow(clamp(s.lvl / LEVELS, 0, 1.2), 0.8);
    playSnd(v.dimension, player, "beam.engine." + info.engine, v.location, vol * (0.3 + 0.7 * Math.min(1, sp + (s.lvl > 0 ? 0.3 : 0))), clamp(pitch * info.pitch, 0.5, 2.0));
  }
  if (s.brake && hs * 72 > 35 && s.tick % 12 === 0) playSnd(v.dimension, player, "beam.skid", v.location, 0.6 * (SOUND_VOL[getSet(player, "sound")] ?? 0.7), 1.0 + Math.random() * 0.2);
  if (info.cat === "police" && s.lights && getSet(player, "siren") && s.tick % 40 === 0) playSnd(v.dimension, player, "beam.siren", v.location, 0.8 * (SOUND_VOL[getSet(player, "sound")] ?? 0.7), 1);

  // --- HUD
  if (driver && getSet(player, "hud") && s.tick % 4 === 0) {
    const kmh = hs * 72;
    const spd = getSet(player, "units") === "mph" ? Math.round(kmh * 0.621371) + " mph" : Math.round(kmh) + " km/h";
    const gear = s.lvl <= 0.5 ? "N" : s.brake ? "B" : String(clamp(Math.ceil(s.lvl / (LEVELS / 6)), 1, 6));
    const bars = Math.round(frac * 10);
    const col = dmgState === 0 ? "§a" : dmgState === 1 ? "§e" : dmgState === 2 ? "§6" : "§c";
    say(player, `§l${spd}§r  Gear ${gear}  ${col}${"|".repeat(bars)}§8${"|".repeat(10 - bars)}§r  ${info.name}` + (wrecked ? "  §c§lWRECKED – open BeamNG Menu > Repair" : ""));
  }
}

function crash(player, v, info, s, impactKmh) {
  const mult = DAMAGE_MULT[getSet(player, "damage")] ?? 1;
  const dim = v.dimension;
  const hp = safe(() => v.getComponent("minecraft:health"), undefined);
  if (hp && mult > 0) {
    const share = clamp((impactKmh - 18) / 105, 0.02, 1.0) * mult * (1800 / clamp(info.mass, 900, 6000)) ** 0.25;
    const nv = Math.max(1, hp.currentValue - share * hp.effectiveMax);
    safe(() => hp.setCurrentValue(nv));
  }
  s.lvl = Math.min(s.lvl, 2);                       // car loses momentum
  const vol = SOUND_VOL[getSet(player, "sound")] ?? 0.7;
  const loc = v.location; const up = { x: loc.x, y: loc.y + 0.8, z: loc.z };
  if (impactKmh > 55) {
    playSnd(dim, player, "beam.crash_heavy", loc, 1.2 * Math.max(vol, 0.4), 0.9 + Math.random() * 0.2);
    playSnd(dim, player, "beam.glass", loc, 0.9 * Math.max(vol, 0.3), 1);
    particle(dim, "minecraft:large_explosion", up);
    for (let i = 0; i < 4; i++) particle(dim, "minecraft:basic_smoke_particle", { x: up.x + Math.random() - 0.5, y: up.y + Math.random(), z: up.z + Math.random() - 0.5 });
    safe(() => player.runCommand("camerashake add @s 0.5 0.6 positional"));
  } else {
    playSnd(dim, player, "beam.crash_light", loc, 1.0 * Math.max(vol, 0.3), 0.9 + Math.random() * 0.3);
    for (let i = 0; i < 3; i++) particle(dim, "minecraft:critical_hit_emitter", { x: up.x + Math.random() - 0.5, y: up.y, z: up.z + Math.random() - 0.5 });
    safe(() => player.runCommand("camerashake add @s 0.2 0.3 positional"));
  }
}
function wreckFx(v, player, first) {
  const dim = v.dimension; const l = v.location;
  if (first) { playSnd(dim, player, "beam.wreck", l, 1.0, 1.0); particle(dim, "minecraft:huge_explosion_emitter", { x: l.x, y: l.y + 1, z: l.z }); }
}

// smoke / fire from damaged vehicles near any player
function damageFx() {
  for (const player of world.getAllPlayers()) {
    const dim = player.dimension;
    const near = safe(() => dim.getEntities({ families: ["beam_vehicle"], location: player.location, maxDistance: 64 }), []);
    for (const v of near) {
      const f = hpFraction(v); const st = stateForHp(f);
      if (st < 2) continue;
      const l = v.location;
      particle(dim, "minecraft:campfire_smoke_particle", { x: l.x, y: l.y + 1.3, z: l.z });
      if (st === 3) { particle(dim, "minecraft:basic_flame_particle", { x: l.x + (Math.random() - 0.5), y: l.y + 1.0, z: l.z + (Math.random() - 0.5) }); }
    }
  }
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const v = getVehicle(player);
    if (v) safe(() => driveTick(player, v));
  }
  if (system.currentTick % 12 === 0) safe(damageFx);
  if (system.currentTick % 600 === 0) {                      // cleanup state of removed vehicles
    const alive = new Set(safe(() => OVERWORLD().getEntities({ families: ["beam_vehicle"] }).map((e) => e.id), []));
    for (const k of state.keys()) if (!alive.has(k)) state.delete(k);
  }
}, 1);

// ---------------------------------------------------------------- menus
async function show(form, player) {
  for (let i = 0; i < 60; i++) {
    const r = await form.show(player);
    if (r.canceled && r.cancelationReason === "UserBusy") { await sleep(10); continue; }
    return r;
  }
  return { canceled: true };
}
function statLine(v) {
  return `${v.top} km/h top • 0-100 in ~${v.t60} s • ${v.mass} kg`;
}
async function chooseVehicle(player) {
  while (true) {
    const f = new ActionFormData().title("Choose Car").body("Pick a category");
    for (const c of CATS) f.button(c[1]);
    f.button("Cancel");
    const r = await show(f, player);
    if (r.canceled || r.selection === CATS.length) return undefined;
    const cat = CATS[r.selection][0];
    const list = VEHICLES.filter((v) => v.cat === cat);
    const g = new ActionFormData().title(CATS[r.selection][1]).body("Pick a vehicle");
    for (const v of list) g.button(`${v.name}\n§8${statLine(v)}`);
    g.button("« Back");
    const r2 = await show(g, player);
    if (r2.canceled) return undefined;
    if (r2.selection === list.length) continue;
    return list[r2.selection].id;
  }
}
async function chooseMap(player) {
  const f = new ActionFormData().title("Choose Map").body("Teleport to the real map and spawn your car");
  for (const k of MAP_ORDER) f.button(MAPS[k].label);
  f.button("Cancel");
  const r = await show(f, player);
  if (r.canceled || r.selection === MAP_ORDER.length) return undefined;
  return MAP_ORDER[r.selection];
}
async function setupFlow(player) {
  const vid = await chooseVehicle(player); if (!vid) return;
  const map = await chooseMap(player); if (!map) return;
  player.setDynamicProperty("beam:setup_done", true);
  await goToMap(player, map, vid);
}
async function goToMap(player, mapKey, vid) {
  const m = MAPS[mapKey]; const dim = OVERWORLD();
  safe(() => getVehicle(player)?.getComponent("minecraft:rideable")?.ejectRiders());
  for (const old of ownedVehicles(player)) safe(() => old.remove());
  safe(() => player.addEffect("resistance", 400, { amplifier: 255, showParticles: false }));
  safe(() => player.addEffect("slow_falling", 400, { amplifier: 0, showParticles: false }));
  const target = { x: m.x + 0.5, y: m.y + 0.2, z: m.z + 0.5 };
  say(player, `Loading ${m.name}…`);
  const ok = safe(() => { player.teleport(target, { dimension: dim, rotation: { x: 0, y: m.yaw } }); return true; }, false);
  if (!ok) safe(() => player.runCommand(`tp @s ${target.x} ${target.y} ${target.z}`));
  player.setDynamicProperty("beam:map", mapKey);
  // wait until the destination chunk is loaded and has solid ground below
  let loaded = false;
  for (let i = 0; i < 120 && !loaded; i++) {
    await sleep(5);
    loaded = safe(() => {
      const b = dim.getBlock({ x: Math.floor(m.x), y: Math.floor(m.y), z: Math.floor(m.z) });
      const g = dim.getBlock({ x: Math.floor(m.x), y: Math.floor(m.y) - 1, z: Math.floor(m.z) });
      return !!b && !!g && !g.isAir;
    }, false);
  }
  if (!loaded) say(player, "§eMap is still loading – spawning anyway");
  const f = fwd(m.yaw);
  const loc = { x: m.x + 0.5 + f.x * 3, y: m.y + 0.1, z: m.z + 0.5 + f.z * 3 };
  try { spawnVehicle(player, vid, loc, m.yaw, true); }
  catch (e) { say(player, "§cCould not spawn vehicle yet – use the BeamNG Menu > Respawn"); }
  say(player, `${m.label}  ·  ${VEH["beam:" + vid].name}`);
}
async function openMain(player) {
  const f = new ActionFormData().title("BeamNG Menu").body("What would you like to do?")
    .button("Choose Vehicle").button("Choose Map").button("Reset Vehicle").button("Repair Vehicle")
    .button("Respawn Vehicle").button("Vehicle Settings").button("Close");
  const r = await show(f, player);
  if (r.canceled) return;
  switch (r.selection) {
    case 0: { const vid = await chooseVehicle(player); if (vid) swapVehicle(player, vid); break; }
    case 1: { const map = await chooseMap(player); if (map) await goToMap(player, map, player.getDynamicProperty("beam:vehicle") ?? VEHICLES[0].id); break; }
    case 2: resetVehicle(player); break;
    case 3: repairVehicle(player); break;
    case 4: respawnVehicle(player); break;
    case 5: await openSettings(player); break;
  }
}
function currentOrOwned(player) { return getVehicle(player) ?? ownedVehicles(player)[0]; }
function swapVehicle(player, vid) {
  const cur = currentOrOwned(player);
  const loc = cur ? cur.location : player.location; const yaw = cur ? cur.getRotation().y : player.getRotation().y;
  const f = fwd(yaw);
  safe(() => getVehicle(player)?.getComponent("minecraft:rideable")?.ejectRiders());
  const at = cur ? { x: loc.x, y: loc.y + 0.1, z: loc.z } : { x: loc.x + f.x * 3, y: loc.y + 0.1, z: loc.z + f.z * 3 };
  try { spawnVehicle(player, vid, at, yaw, true); } catch (e) { say(player, "§cCould not spawn vehicle"); }
}
function resetVehicle(player) {
  const v = currentOrOwned(player); if (!v) return say(player, "No vehicle to reset – choose one first");
  const riding = getVehicle(player) === v;
  const yaw = player.getRotation().y; const f = fwd(yaw); const p = player.location;
  const at = riding ? { x: p.x, y: p.y + 0.3, z: p.z } : { x: p.x + f.x * 4, y: p.y + 0.2, z: p.z + f.z * 4 };
  safe(() => v.teleport(at, { dimension: v.dimension, rotation: { x: 0, y: yaw } }));
  safe(() => v.clearVelocity());
  const s = state.get(v.id); if (s) { s.lvl = 0; s.applied = 0; }
  safe(() => v.triggerEvent("beam:spd_0"));
  if (!riding) system.runTimeout(() => safe(() => v.getComponent("minecraft:rideable").addRider(player)), 6);
  say(player, "Vehicle reset");
}
function repairVehicle(player) {
  const v = currentOrOwned(player); if (!v) return say(player, "No vehicle to repair");
  repair(v); safe(() => player.playSound("random.anvil_use", { volume: 0.6 })); say(player, "§aVehicle repaired");
}
function respawnVehicle(player) {
  const vid = player.getDynamicProperty("beam:vehicle"); const map = player.getDynamicProperty("beam:map");
  if (!vid) return say(player, "Choose a vehicle first");
  if (map && MAPS[map]) goToMap(player, map, vid); else swapVehicle(player, vid);
}
async function openSettings(player) {
  while (true) {
    const names = ["Off", "Low", "Medium", "High"];
    const f = new ActionFormData().title("Vehicle Settings").body("Tap a setting to change it")
      .button(`Speed units: ${getSet(player, "units") === "kmh" ? "km/h" : "mph"}`)
      .button(`Crash damage: ${{ off: "Off", arcade: "Arcade", real: "Realistic" }[getSet(player, "damage")]}`)
      .button(`Headlights: ${{ auto: "Auto (night)", on: "Always on", off: "Off" }[getSet(player, "lights")]}`)
      .button(`Engine volume: ${names[getSet(player, "sound")]}`)
      .button(`Speedometer HUD: ${getSet(player, "hud") ? "On" : "Off"}`)
      .button(`Night assist with lights: ${getSet(player, "nv") ? "On" : "Off"}`)
      .button(`Police siren sound: ${getSet(player, "siren") ? "On" : "Off"}`)
      .button("« Back");
    const r = await show(f, player);
    if (r.canceled || r.selection === 7) return;
    switch (r.selection) {
      case 0: setSet(player, "units", getSet(player, "units") === "kmh" ? "mph" : "kmh"); break;
      case 1: { const o = ["off", "arcade", "real"]; setSet(player, "damage", o[(o.indexOf(getSet(player, "damage")) + 1) % 3]); break; }
      case 2: { const o = ["auto", "on", "off"]; setSet(player, "lights", o[(o.indexOf(getSet(player, "lights")) + 1) % 3]); break; }
      case 3: setSet(player, "sound", (getSet(player, "sound") + 1) % 4); break;
      case 4: setSet(player, "hud", getSet(player, "hud") ? 0 : 1); break;
      case 5: setSet(player, "nv", getSet(player, "nv") ? 0 : 1); break;
      case 6: setSet(player, "siren", getSet(player, "siren") ? 0 : 1); break;
    }
  }
}

// ---------------------------------------------------------------- entry points
function giveMenuItem(player) {
  safe(() => {
    const c = player.getComponent("minecraft:inventory").container;
    for (let i = 0; i < c.size; i++) { const it = c.getItem(i); if (it && it.typeId === "beam:menu") return; }
    c.addItem(new ItemStack("beam:menu", 1));
  });
}
world.afterEvents.playerSpawn.subscribe((e) => {
  const player = e.player;
  system.runTimeout(() => {
    giveMenuItem(player);
    if (e.initialSpawn && !player.getDynamicProperty("beam:setup_done")) setupFlow(player);
  }, 60);
});
world.afterEvents.itemUse.subscribe((e) => {
  if (e.itemStack && e.itemStack.typeId === "beam:menu") openMain(e.source);
});
system.afterEvents.scriptEventReceive.subscribe((e) => {
  const p = e.sourceEntity;
  if (!p || p.typeId !== "minecraft:player") return;
  if (e.id === "beam:menu") openMain(p);
  else if (e.id === "beam:setup") setupFlow(p);
  else if (e.id === "beam:repair") repairVehicle(p);
  else if (e.id === "beam:reset") resetVehicle(p);
  else if (e.id === "beam:respawn") respawnVehicle(p);
});
system.run(() => {
  safe(() => { world.gameRules.doMobSpawning = false; });
  safe(() => { world.gameRules.showCoordinates = true; });
});
