/* Sample data for the Kilcarrig GAA Under 9 prototype.
   Deterministic: the same seed gives the same team on every load,
   so the numbers on screen match what the allocation reports. */

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

const SCHOOLS = [
  { name: "Scoil Mhuire, Kilcarrig", count: 24 },
  { name: "St Brigid's NS", count: 20 },
  { name: "Scoil Naomh Pádraig", count: 16 },
  { name: "Holy Family NS", count: 13 },
  { name: "Gaelscoil Chnoc na Sí", count: 10 },
  { name: "Kilcarrig Educate Together", count: 7 }
];

const DECLINE_REASONS = [
  "Away with family this week", "Birthday party", "Not well", "Swimming lessons clash",
  "Working late", "Communion practice", "Back from holidays late", "Minding younger brother"
];

/* ---- build the team ---------------------------------------------------- */

function buildTeam() {
  const people = [];
  let nextId = 1;

  // 88 households: two with two children, eighty-six with one. 90 children in total.
  const householdSizes = [2, 2].concat(new Array(86).fill(1));

  const schoolPool = shuffle(SCHOOLS.flatMap((s) => new Array(s.count).fill(s.name)));
  const ratingPool = shuffle(
    new Array(11).fill(1).concat(
      new Array(20).fill(2), new Array(28).fill(3), new Array(20).fill(4), new Array(11).fill(5)
    )
  );

  const usedNames = new Set();
  let schoolIdx = 0, ratingIdx = 0;

  const households = householdSizes.map((size) => {
    const surname = pick(SURNAMES);
    const adult = {
      id: nextId++, type: "adult", firstName: pick(ADULT_NAMES), lastName: surname,
      childIds: [], isCoach: false, registered: rand() < 0.82
    };
    adult.name = adult.firstName + " " + adult.lastName;
    adult.email = (adult.firstName + "." + adult.lastName)
      .toLowerCase().replace(/[^a-z.]/g, "") + "@example.ie";
    adult.phone = "08" + (6 + randInt(4)) + " " + (100 + randInt(900)) + " " + (1000 + randInt(9000));
    people.push(adult);

    const kids = [];
    for (let i = 0; i < size; i++) {
      let firstName = pick(CHILD_NAMES), guard = 0;
      while (usedNames.has(firstName + " " + surname) && guard++ < 40) firstName = pick(CHILD_NAMES);
      usedNames.add(firstName + " " + surname);
      const child = {
        id: nextId++, type: "child", firstName, lastName: surname,
        name: firstName + " " + surname,
        school: schoolPool[schoolIdx++], rating: ratingPool[ratingIdx++],
        parentIds: [adult.id]
      };
      adult.childIds.push(child.id);
      people.push(child);
      kids.push(child);
    }
    return { adult, kids };
  });

  // 15 coaches. The two households with two children are always among them,
  // so the "all of a coach's children go into their group" rule is visible.
  const twoChild = households.slice(0, 2);
  const rest = shuffle(households.slice(2)).slice(0, 13);
  const coachHouseholds = twoChild.concat(rest);
  coachHouseholds.forEach((h) => { h.adult.isCoach = true; h.adult.registered = true; });

  return { people, households, coachHouseholds };
}

/* ---- the Wednesday session -------------------------------------------- */

function buildEvent(team) {
  const { people, coachHouseholds } = team;
  const byId = new Map(people.map((p) => [p.id, p]));
  const children = people.filter((p) => p.type === "child");

  // 12 of the 15 coaches accept, including both of the two-child households.
  const acceptedCoachHh = coachHouseholds.slice(0, 2)
    .concat(shuffle(coachHouseholds.slice(2)).slice(0, 10));
  const acceptedCoachIds = new Set(acceptedCoachHh.map((h) => h.adult.id));
  const otherCoaches = shuffle(coachHouseholds.filter((h) => !acceptedCoachIds.has(h.adult.id)));

  const status = new Map();
  const reason = new Map();

  coachHouseholds.forEach((h) => status.set(h.adult.id, "accepted"));
  otherCoaches.slice(0, 2).forEach((h) => {
    status.set(h.adult.id, "declined");
    reason.set(h.adult.id, pick(DECLINE_REASONS));
  });
  otherCoaches.slice(2).forEach((h) => status.set(h.adult.id, "none"));

  // Children of accepting coaches accept too: a coach can only be placed with their own child.
  const mustAccept = new Set();
  acceptedCoachHh.forEach((h) => h.kids.forEach((k) => mustAccept.add(k.id)));

  const others = shuffle(children.filter((c) => !mustAccept.has(c.id)));
  const acceptedChildIds = new Set(mustAccept);
  const wanted = 75 - mustAccept.size;
  others.slice(0, wanted).forEach((c) => acceptedChildIds.add(c.id));
  const notAccepted = others.slice(wanted);

  children.forEach((c) => status.set(c.id, acceptedChildIds.has(c.id) ? "accepted" : "none"));
  notAccepted.slice(0, 9).forEach((c) => {
    status.set(c.id, "declined");
    reason.set(c.id, pick(DECLINE_REASONS));
  });

  const invited = children.map((c) => c.id)
    .concat(coachHouseholds.map((h) => h.adult.id)); // every child and every flagged coach

  return {
    id: "evt-1",
    type: "Training",
    date: "Wednesday 16 September 2026",
    time: "18:30",
    endTime: "19:45",
    duration: "1 hr 15",
    meetTime: "18:15",
    venue: "Kilcarrig GAA — Pitch 2",
    mode: "Balanced ability",
    published: true,
    invited, status, reason, byId
  };
}

const TEAM = buildTeam();
const EVENT = buildEvent(TEAM);
const CLUB = { name: "Kilcarrig GAA", team: "Under 9" };
