/* Sample data for the Kilmacud Crokes prototype.
   Deterministic: the same seed gives the same club on every load. */

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260916);
const randInt = (n) => Math.floor(rand() * n);
const pick = (arr) => arr[randInt(arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const CHILD_NAMES = [
  "Aoife", "Cian", "Niamh", "Oisín", "Ciara", "Darragh", "Saoirse", "Cormac", "Róisín", "Eoin",
  "Caoimhe", "Fionn", "Sinéad", "Tadhg", "Méabh", "Ruairí", "Clodagh", "Seán", "Orla", "Conor",
  "Eimear", "Liam", "Aisling", "Pádraig", "Fiadh", "Donnacha", "Laoise", "Rian", "Ailbhe", "Odhrán",
  "Siobhán", "Diarmuid", "Bríd", "Colm", "Gráinne", "Rónán", "Deirdre", "Cathal", "Cara", "Aidan",
  "Éabha", "Senan", "Muireann", "Daithí", "Tara", "Lorcan", "Sadhbh", "Fiachra", "Nuala", "Killian",
  "Áine", "Shane", "Emer", "Niall", "Doireann", "Peadar", "Realtín", "Ultan", "Blathnaid", "Oran"
];
const ADULT_NAMES = [
  "Máire", "Seamus", "Bríd", "Declan", "Nuala", "Gerry", "Fiona", "Brendan", "Sorcha", "Kevin",
  "Aileen", "Martin", "Carmel", "Tomás", "Helena", "Micheál", "Bernie", "Alan", "Geraldine", "Pat",
  "Teresa", "Barry", "Anne-Marie", "Eamon", "Mairéad", "Dermot", "Sharon", "Joe", "Olive", "Ciarán",
  "Yvonne", "Frank", "Marian", "Noel", "Trish", "Vincent", "Grace", "Donal", "Laura", "Stephen"
];
const SURNAMES = [
  "Murphy", "Kelly", "O'Sullivan", "Walsh", "O'Brien", "Byrne", "Ryan", "O'Connor", "O'Neill",
  "Reilly", "Doyle", "McCarthy", "Gallagher", "Doherty", "Kennedy", "Lynch", "Murray", "Quinn",
  "Moore", "McLoughlin", "Carroll", "Connolly", "Daly", "O'Connell", "Dunne", "Brennan", "Burke",
  "Collins", "Clarke", "Hughes", "Farrell", "Fitzgerald", "Maguire", "Nolan", "Flynn", "Cullen",
  "O'Callaghan", "O'Donnell", "Duffy", "Mahony", "Boyle", "Healy", "Hayes", "Casey", "Foley",
  "Barry", "Keane", "Moran", "Power", "Whelan", "Sheehan", "Coleman", "Hanley", "Devlin", "Tobin",
  "Kavanagh", "Redmond", "Slattery", "Donovan", "Fahey", "Meaney", "Considine", "Lenihan", "Ahearne"
];
const DECLINE_REASONS = [
  "Away with family this week", "Birthday party", "Not well", "Swimming lessons clash",
  "Working late", "Communion practice", "Back from holidays late", "Minding younger brother"
];

const CLUB = { name: "Kilmacud Crokes", irish: "Cill Mochuda na Crócaigh", crest: "Kilmacud_crokes_logo.png" };
const TODAY = "2026-09-12";

let nextId = 1;
const BY_ID = new Map();

/* ---- one team --------------------------------------------------------- */

function buildTeam(cfg) {
  const people = [];
  const householdSizes = new Array(cfg.twoChild).fill(2)
    .concat(new Array(cfg.children - cfg.twoChild * 2).fill(1));

  const schoolPool = shuffle(cfg.schools.flatMap((s) => new Array(s.count).fill(s.name)));
  const ratingPool = shuffle(cfg.ratings.flatMap((n, i) => new Array(n).fill(i + 1)));
  const usedNames = new Set();
  let si = 0, ri = 0;

  const households = householdSizes.map((size) => {
    const surname = pick(SURNAMES);
    const adult = {
      id: nextId++, type: "adult", firstName: pick(ADULT_NAMES), lastName: surname,
      childIds: [], teams: [cfg.id], coachIn: {}, roleIn: {}, registered: rand() < 0.82
    };
    adult.name = adult.firstName + " " + adult.lastName;
    adult.email = (adult.firstName + "." + adult.lastName).toLowerCase().replace(/[^a-z.]/g, "") + "@example.ie";
    adult.phone = "08" + (6 + randInt(4)) + " " + (100 + randInt(900)) + " " + (1000 + randInt(9000));
    people.push(adult); BY_ID.set(adult.id, adult);

    const kids = [];
    for (let i = 0; i < size; i++) {
      let firstName = pick(CHILD_NAMES), guard = 0;
      while (usedNames.has(firstName + " " + surname) && guard++ < 40) firstName = pick(CHILD_NAMES);
      usedNames.add(firstName + " " + surname);
      const child = {
        id: nextId++, type: "child", firstName, lastName: surname, name: firstName + " " + surname,
        school: schoolPool[si++], rating: ratingPool[ri++], parentIds: [adult.id], teamId: cfg.id
      };
      adult.childIds.push(child.id);
      people.push(child); BY_ID.set(child.id, child);
      kids.push(child);
    }
    return { adult, kids };
  });

  const coachHouseholds = households.slice(0, cfg.twoChild)
    .concat(shuffle(households.slice(cfg.twoChild)).slice(0, cfg.coaches - cfg.twoChild));
  coachHouseholds.forEach((h) => { h.adult.coachIn[cfg.id] = true; h.adult.registered = true; });

  /* roles are about what someone can do in the app, and are separate from coaching.
     A team must always have at least one Team Admin. */
  const forRoles = shuffle(coachHouseholds.map((h) => h.adult));
  forRoles.slice(0, 2).forEach((a) => { a.roleIn[cfg.id] = "admin"; a.registered = true; });
  forRoles.slice(2, 4).forEach((a) => { a.roleIn[cfg.id] = "manager"; a.registered = true; });

  return {
    id: cfg.id, name: cfg.name, shortName: cfg.shortName, mode: cfg.mode,
    people, households, coachHouseholds, schools: cfg.schools.map((s) => s.name),
    settings: cfg.settings
  };
}

const TEAMS = [
  buildTeam({
    id: "u9", name: "Under 9", shortName: "U9", mode: "school",
    children: 90, coaches: 15, twoChild: 2,
    ratings: [11, 20, 28, 20, 11],
    settings: { maxGroups: 10, minCoachesPerGroup: 1, ratio: 8, targetGroupSize: 8, minGroupSize: 6 },
    schools: [
      { name: "Our Lady's Grove", count: 24 }, { name: "St Laurence's NS", count: 20 },
      { name: "Mount Anville NS", count: 16 }, { name: "Taney NS", count: 13 },
      { name: "Gaelscoil Thaobh na Coille", count: 10 }, { name: "Kilmacud Educate Together", count: 7 }
    ]
  }),
  buildTeam({
    id: "u11", name: "Under 11", shortName: "U11", mode: "ability",
    children: 64, coaches: 11, twoChild: 1,
    ratings: [8, 14, 20, 14, 8],
    settings: { maxGroups: 10, minCoachesPerGroup: 1, ratio: 10, targetGroupSize: 10, minGroupSize: 7 },
    schools: [
      { name: "Our Lady's Grove", count: 17 }, { name: "St Laurence's NS", count: 15 },
      { name: "Mount Anville NS", count: 12 }, { name: "Taney NS", count: 9 },
      { name: "Gaelscoil Thaobh na Coille", count: 7 }, { name: "Kilmacud Educate Together", count: 4 }
    ]
  })
];

const TEAM_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

/* one parent with a child in each age group, so the switcher has something to show.
   The U11 household's own adult is replaced, so the child reads as the same family. */
const SHARED_PARENT = (function () {
  const u9 = TEAMS[0], u11 = TEAMS[1];
  const parent = u9.coachHouseholds[3].adult;                 // a U9 coach
  const hh = u11.households.find((h) => h.kids.length === 1 && !h.adult.coachIn.u11);
  const child = hh.kids[0];
  const oldAdult = hh.adult;

  // the child takes the family surname and the shared parent's account
  child.lastName = parent.lastName;
  child.name = child.firstName + " " + parent.lastName;
  child.parentIds = [parent.id];
  parent.childIds.push(child.id);
  parent.teams.push("u11");

  u11.people.splice(u11.people.indexOf(oldAdult), 1);
  BY_ID.delete(oldAdult.id);
  u11.people.push(parent);
  hh.adult = parent;

  // the signed-in admin: one person with a child in each age group, admin of both
  parent.roleIn.u9 = "admin";
  parent.roleIn.u11 = "admin";
  parent.registered = true;
  return { parent, u9Child: BY_ID.get(parent.childIds[0]), u11Child: child };
})();

/* ---- the season ------------------------------------------------------- */

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseDate(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
function longDate(iso) {
  const d = parseDate(iso);
  return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}
function shortDate(iso) { const d = parseDate(iso); return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); }
function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + mins;
  return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

const SEASONS = {
  u9: [
    { date: "2026-08-26", type: "Training", venue: "Glenalbyn, Pitch 2", time: "18:30" },
    { date: "2026-09-02", type: "Training", venue: "Glenalbyn, Pitch 2", time: "18:30" },
    { date: "2026-09-05", type: "Game", venue: "Glenalbyn, Pitch 1", time: "10:30", opposition: "Ballinteer St John's", duration: 60 },
    { date: "2026-09-09", type: "Training", venue: "Glenalbyn, Pitch 2", time: "18:30" },
    { date: "2026-09-16", type: "Training", venue: "Glenalbyn, Pitch 2", time: "18:30" },
    { date: "2026-09-19", type: "Game", venue: "Marlay Park", time: "10:00", opposition: "Cuala", duration: 60, away: true },
    { date: "2026-09-23", type: "Training", venue: "Glenalbyn, Pitch 2", time: "18:30" },
    { date: "2026-09-26", type: "Game", venue: "Glenalbyn, Pitch 1", time: "10:30", opposition: "Naomh Olaf", duration: 60,
      cancelled: "Pitch waterlogged after Friday's rain." },
    { date: "2026-09-30", type: "Training", venue: "Glenalbyn, Pitch 2", time: "18:30" },
    { date: "2026-10-07", type: "Training", venue: "Glenalbyn, Pitch 2", time: "18:30" },
    { date: "2026-10-14", type: "Training", venue: "Glenalbyn, Pitch 2", time: "18:30", draft: true },
    { date: "2026-10-24", type: "Other", venue: "Glenalbyn Clubhouse", time: "15:00", title: "Halloween party", duration: 120, draft: true }
  ],
  u11: [
    { date: "2026-09-01", type: "Training", venue: "Silverpark", time: "18:45" },
    { date: "2026-09-08", type: "Training", venue: "Silverpark", time: "18:45" },
    { date: "2026-09-12", type: "Game", venue: "Glenalbyn, Pitch 1", time: "11:30", opposition: "Templeogue Synge Street", duration: 70 },
    { date: "2026-09-15", type: "Training", venue: "Silverpark", time: "18:45" },
    { date: "2026-09-22", type: "Training", venue: "Silverpark", time: "18:45" },
    { date: "2026-09-26", type: "Game", venue: "Pairc Uí Mhurchú", time: "12:00", opposition: "Kilmacud Crokes B", duration: 70, away: true },
    { date: "2026-09-29", type: "Training", venue: "Silverpark", time: "18:45" },
    { date: "2026-10-06", type: "Training", venue: "Silverpark", time: "18:45", draft: true }
  ]
};

function buildEvents(team) {
  return SEASONS[team.id].map((spec, i) => {
    const dur = spec.duration || 75;
    const ev = {
      id: team.id + "-" + i, teamId: team.id,
      type: spec.type, title: spec.title || null,
      date: spec.date, time: spec.time, duration: dur,
      endTime: addMinutes(spec.time, dur),
      meetTime: spec.type === "Game" ? addMinutes(spec.time, -30) : addMinutes(spec.time, -15),
      venue: spec.venue, opposition: spec.opposition || null, away: !!spec.away,
      published: !spec.draft, draft: !!spec.draft,
      cancelled: spec.cancelled || null,
      mode: team.mode,
      past: spec.date < TODAY,
      status: new Map(), reason: new Map()
    };
    ev.longDate = longDate(ev.date);
    ev.shortDate = shortDate(ev.date);
    ev.dayName = DAYS[parseDate(ev.date).getDay()];
    if (ev.published) fillResponses(team, ev);
    return ev;
  });
}

/* Responses for one published event. The coach's own child has to be there for the
   coach to be placed, so accepting coaches get their children accepted too. */
function fillResponses(team, ev) {
  const children = team.people.filter((p) => p.type === "child");
  const coachHh = team.coachHouseholds;
  const headline = ev.date === "2026-09-16";       // the one the brief describes

  const coachTake = headline ? 12 : Math.round(coachHh.length * (0.6 + rand() * 0.3));
  const acceptedCoachHh = coachHh.slice(0, team.id === "u9" ? 2 : 1)
    .concat(shuffle(coachHh.slice(team.id === "u9" ? 2 : 1)).slice(0, Math.max(0, coachTake - (team.id === "u9" ? 2 : 1))));
  const acceptedCoachIds = new Set(acceptedCoachHh.map((h) => h.adult.id));

  coachHh.forEach((h) => {
    if (acceptedCoachIds.has(h.adult.id)) { ev.status.set(h.adult.id, "accepted"); return; }
    if (rand() < 0.6) {
      ev.status.set(h.adult.id, "declined");
      ev.reason.set(h.adult.id, pick(DECLINE_REASONS));
    } else ev.status.set(h.adult.id, "none");
  });

  const mustAccept = new Set();
  acceptedCoachHh.forEach((h) => h.kids.forEach((k) => mustAccept.add(k.id)));

  const target = headline ? 75 : Math.round(children.length * (0.68 + rand() * 0.2));
  const others = shuffle(children.filter((c) => !mustAccept.has(c.id)));
  const accepted = new Set(mustAccept);
  others.slice(0, Math.max(0, target - mustAccept.size)).forEach((c) => accepted.add(c.id));
  const rest = others.slice(Math.max(0, target - mustAccept.size));

  children.forEach((c) => ev.status.set(c.id, accepted.has(c.id) ? "accepted" : "none"));
  rest.slice(0, Math.ceil(rest.length * 0.6)).forEach((c) => {
    ev.status.set(c.id, "declined");
    ev.reason.set(c.id, pick(DECLINE_REASONS));
  });
}

TEAMS.forEach((t) => { t.events = buildEvents(t); });

const CURRENT_USER = SHARED_PARENT.parent;
const ROLE_LABEL = { admin: "Team Admin", manager: "Event Manager" };

function nextEventFor(team) {
  return team.events.find((e) => !e.past && e.published && !e.cancelled)
    || team.events.find((e) => !e.past) || team.events[team.events.length - 1];
}
