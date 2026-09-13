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
const CLUB = { name: "Kilmacud Crokes", irish: "Cill Mochuda na Crócaigh", crest: "Kilmacud_crokes_logo.png" };
/* The real clock. The season below is generated around it, so the prototype is never
   looking at a stale calendar however long it sits between demos. */
const NOW = new Date();
const isoOf = (d) => d.getFullYear() + "-"
  + String(d.getMonth() + 1).padStart(2, "0") + "-"
  + String(d.getDate()).padStart(2, "0");
const hhmmOf = (d) => String(d.getHours()).padStart(2, "0") + ":"
  + String(d.getMinutes()).padStart(2, "0");
const TODAY = isoOf(NOW);
const midnightToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

/* a date some whole number of days from today, at a given clock time */
function dayAt(offset, hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(midnightToday.getFullYear(), midnightToday.getMonth(),
    midnightToday.getDate() + offset, hh, mm);
}

/* Slots that are still to come but whose response deadline has already gone: later
   today or tomorrow, inside the 24 hours the deadline is set at. Picked from sensible
   times of day rather than "now plus five hours", so a session generated at 21:40 is
   not at 02:40. Whatever the hour, there is always at least one candidate. */
function deadlinePassedSlots() {
  const out = [];
  for (let d = 0; d <= 1; d++) {
    [10, 11, 12, 15, 18, 19].forEach((hh) => {
      const c = dayAt(d, String(hh).padStart(2, "0") + ":00");
      const gap = (c - NOW) / 3600000;
      if (gap >= 2.5 && gap <= 23) out.push(c);
    });
  }
  out.sort((a, b) => a - b);
  if (!out.length) out.push(new Date(NOW.getTime() + 6 * 3600000));
  return out;
}
const CLOSE_SLOTS = deadlinePassedSlots();
const closeSlot = (i) => CLOSE_SLOTS[Math.min(i, CLOSE_SLOTS.length - 1)];

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

  const stillMissing = shuffle(people.filter((p) => p.type === "child")).slice(0, cfg.noSchool || 0);
  stillMissing.forEach((c) => { c.school = ""; c.schoolUnconfirmed = false; });

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
    children: 90, coaches: 15, twoChild: 2, noSchool: 4,
    ratings: [11, 20, 28, 20, 11],
    settings: { maxGroups: 10, minCoachesPerGroup: 1, ratio: 8, targetGroupSize: 8, minGroupSize: 6, deadlineHours: 24 },
    schools: [
      { name: "Our Lady's Grove", count: 24 }, { name: "St Laurence's NS", count: 20 },
      { name: "Mount Anville NS", count: 16 }, { name: "Taney NS", count: 13 },
      { name: "Gaelscoil Thaobh na Coille", count: 10 }, { name: "Kilmacud Educate Together", count: 7 }
    ]
  }),
  buildTeam({
    id: "u11", name: "Under 11", shortName: "U11", mode: "ability",
    children: 64, coaches: 11, twoChild: 1, noSchool: 3,
    ratings: [8, 14, 20, 14, 8],
    settings: { maxGroups: 10, minCoachesPerGroup: 1, ratio: 10, targetGroupSize: 10, minGroupSize: 7, deadlineHours: 24 },
    schools: [
      { name: "Our Lady's Grove", count: 17 }, { name: "St Laurence's NS", count: 15 },
      { name: "Mount Anville NS", count: 12 }, { name: "Taney NS", count: 9 },
      { name: "Gaelscoil Thaobh na Coille", count: 7 }, { name: "Kilmacud Educate Together", count: 4 }
    ]
  })
];

const TEAM_BY_ID = new Map(TEAMS.map((t) => [t.id, t]));

/* Sign-in personas. Three distinct people, because a Team Admin, a coaching parent and a
   plain parent are three different views of the app.

   An adult linked to a child in two age groups is put together by replacing the U11
   household's own adult, so the child reads as part of the same family. */

function linkAcrossTeams(parent, u11Household) {
  const child = u11Household.kids[0];
  const oldAdult = u11Household.adult;
  const u11 = TEAMS[1];

  child.lastName = parent.lastName;
  child.name = child.firstName + " " + parent.lastName;
  child.parentIds = [parent.id];
  parent.childIds.push(child.id);
  parent.teams.push("u11");

  u11.people.splice(u11.people.indexOf(oldAdult), 1);
  BY_ID.delete(oldAdult.id);
  u11.people.push(parent);
  u11Household.adult = parent;
  return child;
}

const PERSONAS = (function () {
  const u9 = TEAMS[0], u11 = TEAMS[1];
  const freeU11 = u11.households.filter((h) => h.kids.length === 1 && !h.adult.coachIn.u11 && !h.adult.roleIn.u11);

  /* A Team Admin. Admins are parents too, so they have a child of their own — in both
     age groups here, which is what lets them administer both. Not a coach. */
  const admin = u9.households.find((h) => h.adult.roleIn.u9 === "admin" && h.kids.length === 1).adult;
  admin.coachIn.u9 = false;
  admin.roleIn.u11 = "admin";
  admin.registered = true;
  linkAcrossTeams(admin, freeU11[0]);

  /* A coaching parent with no admin rights at all. */
  const coach = u9.coachHouseholds.find((h) => h.adult !== admin && !h.adult.roleIn.u9 && h.kids.length === 1).adult;
  coach.registered = true;

  /* A plain parent: no role, no coach flag, a child in each age group. */
  const plain = u9.households.find((h) =>
    h.kids.length === 1 && !h.adult.coachIn.u9 && !h.adult.roleIn.u9 && h.adult !== admin).adult;
  plain.registered = true;
  linkAcrossTeams(plain, freeU11[1]);

  return [
    { id: admin.id, blurb: "Runs both age groups. Sees the admin side, and their own children like any parent." },
    { id: coach.id, blurb: "Coaches Under 9. No admin rights — they see the app as a parent does." },
    { id: plain.id, blurb: "No role, no coaching. A child in each age group, both in one place." }
  ];
})();

const SHARED_PARENT = { parent: BY_ID.get(PERSONAS[2].id) };

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

/* ---- venues -------------------------------------------------------------
   A venue carries its own eircode, map link and access note. They belong to the
   place, not the session, so every event at a venue shows the same ones.

   SAMPLE TEXT. The parking notes below are invented for the prototype and the
   eircodes are examples. None of it is real club information: replace the whole
   table before this goes anywhere near a parent. */

const VENUES = {
  "Glenalbyn, Pitch 1": {
    eircode: "A94 E7K8",
    note: "Main gate on Glenalbyn Road; the car park fills by 10am on match mornings, overflow parking on the Stillorgan Grove side."
  },
  "Silverpark": {
    // no eircode recorded for this one, so the card simply does not show a line for it
    note: "Entrance off Sandyford Road; park along the top of the green and leave the residents' gate clear."
  },
  "Oatlands College": {
    eircode: "A94 HX38",
    note: "Use the Mount Merrion Avenue gate; the school yard is open for parking after 6pm on weekdays."
  },
  "Clubhouse, Function Room": {
    eircode: "A94 E7K8",
    note: "Clubhouse door beside the main car park; step-free access and a lift from the far end."
  },
  "Marlay Park": {
    eircode: "D16 X310",
    note: "Grange Road entrance; pay-and-display car park, about five minutes' walk to the pitches."
  },
  "Páirc Uí Mhurchú": {
    eircode: "D18 K279",
    note: "Parking on site inside the club gate; the far pitch is signposted from the car park."
  }
};

const venueFor = (name) => VENUES[name] || null;
/* The eircode is the better search term where there is one; the name still finds the
   place where there is not, so the map link does not depend on having an eircode. */
const mapLinkFor = (name, v) => {
  const q = (v && v.eircode) || name;
  return q ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q) : null;
};

/* ---- the season ---------------------------------------------------------
   Hand-authored rather than generated, because the parent-facing states are the
   point: every event state the two parent personas need to meet is somewhere in
   these two lists. `squads: true` means squads were published for that event.

   "Social" covers club social events. It takes invitations, answers, a deadline
   and a reminder exactly as training does — coaches included — but no squad
   allocation ever runs on one. */

const SEASONS = {
  u9: [
    { key: "t1",        day: -24, type: "Training", venue: "Oatlands College", time: "18:30" },
    { key: "t2",        day: -17, type: "Training", venue: "Oatlands College", time: "18:30" },
    { key: "m1",        day: -14, type: "Game", venue: "Glenalbyn, Pitch 1", time: "10:30",
      opposition: "Ballinteer St John's", duration: 60, squads: true },
    { key: "m2-late",   day:  -7, type: "Game", venue: "Marlay Park", time: "10:00",
      opposition: "Cuala", duration: 60, away: true, squads: true },
    { key: "t3",        day:  -3, type: "Training", venue: "Oatlands College", time: "18:30" },
    { key: "social-soon", slot: 0, type: "Social", venue: "Clubhouse, Function Room",
      title: "Club family day", duration: 150 },
    { key: "t-squads",  day:  +4, type: "Training", venue: "Oatlands College", time: "18:30", squads: true },
    { key: "m3",        day:  +7, type: "Game", venue: "Marlay Park", time: "10:00",
      opposition: "Cuala", duration: 60, away: true },
    { key: "t4",        day: +11, type: "Training", venue: "Oatlands College", time: "18:30" },
    { key: "m4-off",    day: +14, type: "Game", venue: "Glenalbyn, Pitch 1", time: "10:30",
      opposition: "Naomh Olaf", duration: 60,
      cancelled: "Pitch waterlogged after Friday's rain." },
    { key: "blitz",     day: +21, type: "Blitz", venue: "Glenalbyn, Pitch 1", time: "10:00",
      duration: 150, title: "Cuala, Naomh Olaf and Ballinteer" },
    { key: "t-draft",   day: +32, type: "Training", venue: "Oatlands College", time: "18:30", draft: true },
    { key: "social-far", day: +49, type: "Social", venue: "Clubhouse, Function Room",
      time: "15:00", title: "Halloween party", duration: 120 }
  ],
  u11: [
    { key: "t1",       day: -18, type: "Training", venue: "Silverpark", time: "18:45" },
    { key: "t2",       day: -11, type: "Training", venue: "Silverpark", time: "18:45" },
    { key: "t3",       day:  -4, type: "Training", venue: "Silverpark", time: "18:45" },
    { key: "m-soon",   slot: 1, type: "Game", venue: "Glenalbyn, Pitch 1",
      opposition: "Templeogue Synge Street", duration: 70, squads: true },
    { key: "t4",       day:  +3, type: "Training", venue: "Silverpark", time: "18:45" },
    { key: "t5",       day: +10, type: "Training", venue: "Silverpark", time: "18:45" },
    { key: "m2",       day: +14, type: "Game", venue: "Páirc Uí Mhurchú", time: "12:00",
      opposition: "Kilmacud Crokes B", duration: 70, away: true },
    { key: "t6",       day: +17, type: "Training", venue: "Silverpark", time: "18:45" },
    { key: "t-draft",  day: +24, type: "Training", venue: "Silverpark", time: "18:45", draft: true },
    { key: "social",   day: +91, type: "Social", venue: "Clubhouse, Function Room",
      time: "11:00", title: "Santa visit", duration: 120 }
  ]
};

/* Where a spec sits on the calendar. `day` is a whole number of days from today at a
   fixed clock time; `slot` picks one of the still-to-come-but-past-the-deadline slots,
   which is the only placement that cannot be expressed in whole days. */
function startOf(spec) {
  return spec.slot !== undefined ? closeSlot(spec.slot) : dayAt(spec.day, spec.time);
}

const isSocialType = (type) => type === "Social";

function buildEvents(team) {
  return SEASONS[team.id].map((spec, i) => {
    const dur = spec.duration || 75;
    const start = startOf(spec);
    const date = isoOf(start), time = hhmmOf(start);
    const ev = {
      id: team.id + "-" + i, teamId: team.id, key: spec.key,
      type: spec.type, title: spec.title || null,
      date: date, time: time, duration: dur,
      endTime: addMinutes(time, dur),
      meetTime: (spec.type === "Game" || spec.type === "Blitz")
        ? addMinutes(time, -30) : addMinutes(time, -15),
      venue: spec.venue, opposition: spec.opposition || null, away: !!spec.away,
      published: !spec.draft, draft: !!spec.draft,
      cancelled: spec.cancelled || null,
      mode: team.mode,
      past: date < TODAY,
      /* no allocation ever runs on a social, so it can never be waiting on squads */
      social: isSocialType(spec.type),
      squadsPlanned: !!spec.squads && !isSocialType(spec.type),
      status: new Map(), answeredBy: new Map(), answeredAt: new Map()
    };
    ev.longDate = longDate(ev.date);
    ev.shortDate = shortDate(ev.date);
    ev.dayName = DAYS[parseDate(ev.date).getDay()];
    if (ev.published) fillResponses(team, ev);
    return ev;
  });
}

/* Responses for one published event, for the crowd. The two parent personas have
   their own answers set explicitly further down; this fills in everybody else, and
   is what the squad allocation reads. A coach's own child has to be there for the
   coach to be placed, so accepting coaches get their children accepted too. */
function fillResponses(team, ev) {
  const children = team.people.filter((p) => p.type === "child");
  const coachHh = team.coachHouseholds;
  const headline = ev.key === "t-squads";          // the one the brief describes

  const coachTake = headline ? 12 : Math.round(coachHh.length * (0.6 + rand() * 0.3));
  const acceptedCoachHh = coachHh.slice(0, team.id === "u9" ? 2 : 1)
    .concat(shuffle(coachHh.slice(team.id === "u9" ? 2 : 1)).slice(0, Math.max(0, coachTake - (team.id === "u9" ? 2 : 1))));
  const acceptedCoachIds = new Set(acceptedCoachHh.map((h) => h.adult.id));

  /* a plausible moment in the week before the answer was due */
  const answeredWhen = () => {
    const anchor = Math.min(eventStart(ev).getTime(), NOW.getTime());
    return new Date(anchor - (1 + Math.floor(rand() * 9)) * 86400000);
  };
  const setAnswer = (person, value, by) => {
    ev.status.set(person.id, value);
    if (value === "none") { ev.answeredBy.delete(person.id); ev.answeredAt.delete(person.id); return; }
    ev.answeredBy.set(person.id, by);
    ev.answeredAt.set(person.id, answeredWhen());
  };

  coachHh.forEach((h) => {
    if (acceptedCoachIds.has(h.adult.id)) { setAnswer(h.adult, "accepted", h.adult.id); return; }
    if (rand() < 0.6) setAnswer(h.adult, "declined", h.adult.id);
    else setAnswer(h.adult, "none", null);
  });

  const mustAccept = new Set();
  acceptedCoachHh.forEach((h) => h.kids.forEach((k) => mustAccept.add(k.id)));

  const target = headline ? 75 : Math.round(children.length * (0.68 + rand() * 0.2));
  const others = shuffle(children.filter((c) => !mustAccept.has(c.id)));
  const accepted = new Set(mustAccept);
  others.slice(0, Math.max(0, target - mustAccept.size)).forEach((c) => accepted.add(c.id));
  const rest = others.slice(Math.max(0, target - mustAccept.size));

  const answerer = (c) => {
    const adults = c.parentIds.map((id) => BY_ID.get(id)).filter(Boolean);
    return adults.length ? adults[Math.floor(rand() * adults.length)].id : null;
  };
  children.forEach((c) => {
    if (accepted.has(c.id)) setAnswer(c, "accepted", answerer(c));
    else setAnswer(c, "none", null);
  });
  rest.slice(0, Math.ceil(rest.length * 0.6)).forEach((c) => setAnswer(c, "declined", answerer(c)));
}

TEAMS.forEach((t) => { t.events = buildEvents(t); });

const ROLE_LABEL = { admin: "Team Admin", manager: "Event Manager" };

/* what a signed-in person can do */
function teamsFor(person) {
  const ids = new Set();
  Object.keys(person.roleIn || {}).forEach((t) => { if (person.roleIn[t]) ids.add(t); });
  (person.childIds || []).forEach((id) => { const c = BY_ID.get(id); if (c) ids.add(c.teamId); });
  return TEAMS.filter((t) => ids.has(t.id));
}
function adminTeamsFor(person) {
  return TEAMS.filter((t) => person.roleIn && person.roleIn[t.id]);
}
function isAdmin(person) { return adminTeamsFor(person).length > 0; }

/* ---- the response deadline -------------------------------------------
   A team setting in hours before the start, overridable on a single event.
   Nothing locks when it passes: a parent can still change their answer. */

function eventStart(e) {
  const [y, m, d] = e.date.split("-").map(Number);
  const [hh, mm] = e.time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}
function deadlineHoursFor(e) {
  const t = TEAM_BY_ID.get(e.teamId);
  return e.deadlineHours != null ? e.deadlineHours : t.settings.deadlineHours;
}
function deadlineFor(e) { return new Date(eventStart(e).getTime() - deadlineHoursFor(e) * 3600000); }

/* the reminder hangs off the deadline, so it lands a day before answers are due */
function reminderFor(e) { return new Date(deadlineFor(e).getTime() - 24 * 3600000); }

/* "today", "tomorrow", or the day name. Inside a week a day name is unambiguous,
   so it needs no date attached. */
function relativeDay(d) {
  const midnight = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((midnight(d) - midnight(NOW)) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return DAYS[d.getDay()];
}

function fmtDay(d) {
  return DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3);
}
function fmtWhen(d) {
  return DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3)
    + ", " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function humanGap(ms) {
  const hrs = ms / 3600000;
  if (hrs < 1) return Math.max(1, Math.round(ms / 60000)) + " min";
  if (hrs < 48) { const h = Math.round(hrs); return h + (h === 1 ? " hour" : " hours"); }
  const d = Math.round(hrs / 24);
  return d + (d === 1 ? " day" : " days");
}
function deadlineState(e) {
  const at = deadlineFor(e);
  const ms = at - NOW;
  if (ms <= 0) return { closed: true, at, label: "Responses closed", chip: "Responses closed" };
  return { closed: false, at, label: "Answers due in " + humanGap(ms), chip: "Closes in " + humanGap(ms) };
}

/* The next upcoming event, whatever its type. It opens by default because it is the
   one being asked about, and a social with an answer outstanding is being asked about
   exactly as much as a training session is. */
function nextEventFor(team) {
  return team.events.find((e) => !e.past && e.published && !e.cancelled)
    || team.events.find((e) => !e.past) || team.events[team.events.length - 1];
}

/* ---- the parent-facing scenarios ----------------------------------------
   The crowd's answers are generated; these are not. Every event state the brief
   asks the two parent personas to cover is written out here by hand, so the
   coverage can be read off the table rather than inferred from a random seed.

   Applied before squads are published. The answers that have to land AFTER
   publication — the child who accepted once the squads had gone out — are in
   LATE_ANSWERS below, and app.js applies them once it has published.           */

const SCENARIO = (function () {
  const coach = BY_ID.get(PERSONAS[1].id);            // Aileen: coaches U9, one child
  const plain = BY_ID.get(PERSONAS[2].id);            // Helena: no role, a child in each group
  const kidsOf = (a) => a.childIds.map((id) => BY_ID.get(id)).filter(Boolean);
  const coachKid = kidsOf(coach)[0];                                  // U9
  const u9Kid = kidsOf(plain).find((k) => k.teamId === "u9");
  const u11Kid = kidsOf(plain).find((k) => k.teamId === "u11");

  const evByKey = (teamId, key) => TEAM_BY_ID.get(teamId).events.find((e) => e.key === key);

  /* When the answer was given, as a number of days before the session. Clamped to the
     past: an answer given later today would read as having been given in the future. */
  const answeredAtFor = (e, daysBefore) => new Date(Math.min(
    eventStart(e).getTime() - daysBefore * 86400000, NOW.getTime() - 3600000));

  /* one answer, said plainly: who, what they said, who said it and how long before.
     `by` is an adult, or the string "admin" for an office override. */
  function say(teamId, key, person, status, by, daysBefore) {
    const e = evByKey(teamId, key);
    if (!e || !person) return;
    if (status === "none") {
      e.status.set(person.id, "none");
      e.answeredBy.delete(person.id);
      e.answeredAt.delete(person.id);
      return;
    }
    e.status.set(person.id, status);
    e.answeredBy.set(person.id, by === "admin" ? "admin" : by.id);
    e.answeredAt.set(person.id, answeredAtFor(e, daysBefore));
  }

  const parentOf = (kid) => BY_ID.get(kid.parentIds[0]);

  /* --- Aileen (coaches U9) and her daughter. Two answers on every U9 row. --- */
  say("u9", "t1", coachKid, "accepted", coach, 5);
  say("u9", "t1", coach, "accepted", coach, 5);

  say("u9", "t2", coachKid, "declined", coach, 5);
  say("u9", "t2", coach, "declined", coach, 5);

  // past, squads published, both in a squad
  say("u9", "m1", coachKid, "accepted", coach, 5);
  say("u9", "m1", coach, "accepted", coach, 5);

  // past, squads published — her answer lands late, see LATE_ANSWERS
  say("u9", "m2-late", coachKid, "none");
  say("u9", "m2-late", coach, "accepted", coach, 5);

  // past and answered, and the child's answer was put in by the office
  say("u9", "t3", coachKid, "accepted", "admin", 2);
  say("u9", "t3", coach, "accepted", coach, 6);

  /* still to come but the deadline has gone: the child answered, the coach has not,
     which is what puts the outstanding-answers banner on her view */
  say("u9", "social-soon", coachKid, "accepted", coach, 4);
  say("u9", "social-soon", coach, "none");

  // upcoming, deadline open, squads out: the card both personas can compare
  say("u9", "t-squads", coachKid, "accepted", coach, 9);
  say("u9", "t-squads", coach, "accepted", coach, 9);

  say("u9", "m3", coachKid, "none");
  say("u9", "m3", coach, "accepted", coach, 8);

  // the two answers on the row disagree: her daughter is going, she is not
  say("u9", "t4", coachKid, "accepted", coach, 12);
  say("u9", "t4", coach, "declined", coach, 12);

  say("u9", "m4-off", coachKid, "accepted", coach, 16);
  say("u9", "m4-off", coach, "accepted", coach, 16);

  say("u9", "blitz", coachKid, "accepted", coach, 24);
  say("u9", "blitz", coach, "accepted", coach, 24);

  say("u9", "social-far", coachKid, "accepted", coach, 52);
  say("u9", "social-far", coach, "none");

  /* --- Helena: no role, a child in each age group --- */
  const pa = parentOf(u9Kid);

  say("u9", "t1", u9Kid, "none");                    // past, never answered
  say("u9", "t2", u9Kid, "accepted", pa, 4);
  say("u9", "m1", u9Kid, "accepted", pa, 6);
  say("u9", "m2-late", u9Kid, "declined", pa, 4);
  say("u9", "t3", u9Kid, "accepted", pa, 3);
  say("u9", "social-soon", u9Kid, "accepted", pa, 3);
  say("u9", "t-squads", u9Kid, "accepted", pa, 8);   // squad card
  say("u9", "m3", u9Kid, "accepted", pa, 9);
  say("u9", "t4", u9Kid, "declined", pa, 12);
  say("u9", "m4-off", u9Kid, "declined", pa, 15);
  say("u9", "blitz", u9Kid, "accepted", pa, 23);
  say("u9", "social-far", u9Kid, "accepted", "admin", 51);

  say("u11", "t1", u11Kid, "accepted", pa, 5);
  say("u11", "t2", u11Kid, "accepted", pa, 4);
  say("u11", "t3", u11Kid, "none");                  // past, never answered
  say("u11", "m-soon", u11Kid, "none");              // deadline gone, still to come, never answered
  say("u11", "t4", u11Kid, "declined", pa, 5);
  say("u11", "t5", u11Kid, "accepted", pa, 11);
  say("u11", "m2", u11Kid, "accepted", pa, 15);
  say("u11", "t6", u11Kid, "accepted", pa, 18);
  say("u11", "social", u11Kid, "none");

  /* two school states a parent can be shown: one typed into "other" and waiting on
     the club to map it, and one never filled in at all */
  u9Kid.school = "";
  u9Kid.schoolPending = "St Malachy's NS";
  u11Kid.school = "";
  u11Kid.schoolPending = null;

  return { coach, coachKid, plain, u9Kid, u11Kid, answeredAtFor, evByKey };
})();

/* The answer that arrived after the squads had gone out, so the child is in none of
   them. app.js applies this once it has published, and the app then tells the parent
   that the squads went out before their answer came in. */
const LATE_ANSWERS = [
  { teamId: "u9", key: "m2-late", personId: SCENARIO.coachKid.id, byId: SCENARIO.coach.id, daysBefore: 2 }
];
