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
const TODAY = "2026-09-12";
const NOW = new Date(2026, 8, 12, 10, 30);   // the prototype's "now"

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
    { date: "2026-10-03", type: "Blitz", venue: "Glenalbyn, Pitch 1", time: "10:00", duration: 150,
      title: "Cuala, Naomh Olaf and Ballinteer" },
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
      meetTime: (spec.type === "Game" || spec.type === "Blitz")
        ? addMinutes(spec.time, -30) : addMinutes(spec.time, -15),
      venue: spec.venue, opposition: spec.opposition || null, away: !!spec.away,
      published: !spec.draft, draft: !!spec.draft,
      cancelled: spec.cancelled || null,
      mode: team.mode,
      past: spec.date < TODAY,
      status: new Map(), answeredBy: new Map(), answeredAt: new Map()
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

function nextEventFor(team) {
  return team.events.find((e) => !e.past && e.published && !e.cancelled)
    || team.events.find((e) => !e.past) || team.events[team.events.length - 1];
}

/* ---- seeded states ------------------------------------------------------
   Three parent-facing states the generator never produces on its own, seeded
   onto one persona so a tester meets them in the app rather than only on the
   banners page. Consumes no randomness, so persona selection is unchanged. */

const SEEDED = (function () {
  const parent = BY_ID.get(PERSONAS[2].id);          // the non-coaching parent
  const kids = parent.childIds.map((id) => BY_ID.get(id)).filter(Boolean);
  const u9Kid = kids.find((k) => k.teamId === "u9");
  const u11Kid = kids.find((k) => k.teamId === "u11");

  /* 1. a school this parent typed into "other", waiting on a Club Admin.
        school stays empty, so the allocation keeps counting them a singleton. */
  u9Kid.school = "";
  u9Kid.schoolPending = "St Malachy's NS";

  /* 2. no school at all — what every child looks like before a parent fills
        anything in, which is the state the club sees on day one. */
  u11Kid.school = "";
  u11Kid.schoolPending = null;

  const unanswer = (e, person) => {
    if (!e) return null;
    e.status.set(person.id, "none");
    e.answeredBy.delete(person.id);
    e.answeredAt.delete(person.id);
    return e;
  };

  /* 3. past its response deadline, not yet started, never answered. That state
        lives in the window between the deadline passing and the throw-in. */
  const closedUnanswered = unanswer(TEAM_BY_ID.get("u11").events.find((e) =>
    e.published && !e.cancelled && eventStart(e) > NOW && deadlineState(e).closed), u11Kid);

  /* and a finished session nobody answered, so the "answers still to give"
     count can be seen leaving it out */
  const pastUnanswered = unanswer([...TEAM_BY_ID.get("u9").events].reverse().find((e) =>
    e.published && !e.cancelled && eventStart(e) <= NOW), u9Kid);

  /* 4. the squad card, which this persona could not reach at all. Squads are only
        published for each team's next event, and on that event this child was down
        as not coming, so no squad panel, no player list, no own-child marker. With
        the answer the other way the two parent personas land on the same event with
        the same card, and the only thing that differs on it is the coach numbers. */
  const squadEvent = nextEventFor(TEAM_BY_ID.get("u9"));
  if (squadEvent) {
    squadEvent.status.set(u9Kid.id, "accepted");
    squadEvent.answeredBy.set(u9Kid.id, parent.id);
    squadEvent.answeredAt.set(u9Kid.id, new Date(NOW.getTime() - 6 * 86400000));
  }

  /* 5. and the mirror of it on the coaching persona: something owed inside the week,
        so the outstanding-answers banner is reachable there too. Her only unanswered
        event was eleven days out. It has to be an event whose squads are not
        published, or she would be listed as a coach on a squad for a session she
        has not answered. */
  const coach = BY_ID.get(PERSONAS[1].id);
  const coachKid = coach.childIds.map((id) => BY_ID.get(id)).filter(Boolean)[0];
  const weekEnd = new Date(NOW.getTime() + 7 * 86400000);
  const bannerEvent = unanswer(TEAM_BY_ID.get(coachKid.teamId).events.find((e) =>
    e.published && !e.cancelled && !e.squadsPublished && e !== squadEvent
    && eventStart(e) > NOW && eventStart(e) <= weekEnd), coachKid);

  return { parent, u9Kid, u11Kid, closedUnanswered, pastUnanswered, squadEvent, bannerEvent };
})();
