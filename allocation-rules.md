# Squad allocation rules

Scope: how available players and coaches are split into squads for a single event. Everything else in the app (teams, events, availability, notifications) is out of scope for this file.

## Model

**Person** — a child or an adult. Has a full name. Children have a school and an ability rating. Adults may be linked to one or more children as parent.

**Account** — a login. Every adult has their own login, and can be signed in on several phones at once.

Person and account are separate on purpose. A child has no login: they are linked to one or more adults, any of whom can answer for them. Availability attaches to the child, so there is one answer per child per event, and a coach's own availability is separate from their child's.

**Squad** — what the allocation produces: a set of children and coaches who stay together for the session. At a match a squad is the side that plays together. On a parent's event card, and only there, a match squad is shown as "Team 4", because that is what the club calls it on the day. In this file and in every admin surface, "team" means the age group.

**Station** — a fixed spot on the pitch with a drill set up at it. Stations do not move and are not allocated.

Squads rotate around the stations on a whistle until every station has been visited, and coaches travel with their squad rather than staying at a station. The app allocates squads and shows the pitch layout. What happens at each station is the coaches' business.

## Inputs

- The list of people who accepted the event, players and coaches separately.
- Ability rating per child, 1 to 5, where 1 is strongest and 5 is weakest. Admin-only. A missing rating is treated as 3, and the admin is told which children are affected.
- School per child, chosen from the club's list. Entered by the child's own parent and visible only to the adults linked to that child and to admins. A child with no school recorded is treated as a singleton for that session.
- A school a parent typed into "other" is unconfirmed until a Club Admin maps it to the list or adds it. An unconfirmed school is not a school as far as this file is concerned: the child counts as a singleton, exactly as if none had been given. Two children who typed the same school by hand are not put together on the strength of it, because the spelling has not been checked.
- Parent-to-child links.
- The team's settings, below.

## Settings

These are set per team by an admin, and can be overridden on a single event. An event override applies to that event only and never changes the team's settings.

| Setting | Default | Meaning |
| --- | --- | --- |
| Maximum squads | 10 | Never exceeded. |
| Maximum squad size | 12 | A hard cap. Never exceeded, whatever else is under pressure. |
| Target squad size | 8 | What the allocation aims for. |
| Minimum squad size | 5 | Below this, use fewer squads. |
| Minimum coaches per squad | 1 | Never broken. |
| Coach-to-child ratio | 1:8 | A ceiling on children per coach, checked within each squad. |
| Coach with their own child | On | On, a coach only ever goes in their own child's squad. Off, coaches are spread wherever they are needed. |

The ratio is a ceiling, not a target. Fewer children per coach is always acceptable. The older age groups will run at 1:10, which is why it's a setting rather than a constant.

The ratio is checked squad by squad, not across the session. Twenty children in a squad with two coaches fails, even if the session as a whole has enough coaches to average out.

The maximum squad size is a cap, not an aim. It is here because the ratio on its own does not stop the allocation putting everybody together: seventy-five children and twelve coaches satisfies a 1:8 ratio in a single squad of seventy-five, which is not a session. The cap is what makes that impossible.

The minimum squad size is 5. Below that a session stops being a session: a squad of three or
four does not hold a drill, and the children in it get a thinner evening than the ones beside
them. Where the numbers would produce a squad that small, the allocation makes fewer squads
instead and lets the others carry the extra.

All three sizes — the maximum of 12, the target of 8 and the minimum of 5 — are working
defaults rather than club decisions. They are deliberately not left blank waiting for an
answer: the allocation cannot run without them, and a number that can be changed in a settings
screen is a cheaper thing to get wrong than a spec that stalls. The club moves them once they
have run a few weeks of sessions on the app, which is better evidence than an opinion formed
in a meeting about a season nobody has played yet. They are team settings with a per-event
override, so moving them is a change to a field and not to this document.

## Matches and blitzes

The allocation applies to matches and blitzes as well as training. At a match a squad plays together rather than rotating around stations, and a go-games side has a fixed size, set through the per-event settings override. All the same rules apply.

## Social events

No allocation runs on a social event. Everybody who says yes is coming to the same thing, so
there is nothing to divide them into, and none of the rules in this file apply: no squads, no
coach ratio, no sizes. Availability is still collected exactly as it is for training, and
coaches are still invited and still answer separately from their child — the event has people
to count, it just has no arrangement to work out.

Nothing about this is a failure state. The squads view says why there is nothing to allocate
rather than showing an empty allocation, and offers no publish action, because there is nothing
to publish.

## Deriving the number of squads

Worked out on the night from the turnout and the coaches present, not fixed in advance.

The coach count used here is the number of coaches who can actually coach, which is not always the number who accepted. See *Coaches who stand down*.

Find the number of squads that satisfies all of the following and lands closest to the target squad size:

- No more than the maximum number of squads.
- No squad over the maximum squad size.
- Every squad has at least the minimum number of coaches.
- Every squad meets the coach-to-child ratio.
- No squad falls below the minimum squad size.

An admin can override the number of squads on an event. Every rule still applies, but the app can no longer adjust the count to make things fit, so a count that can't satisfy the rules is reported rather than silently changed.

## When the rules can't all be met

Tell the admin in plain words which rule can't be met and why, and suggest the change that would fix it. For example, that two more coaches would allow eight squads instead of six, or that dropping to five squads would meet the ratio.

This is a normal outcome on a bad night, not an error. Say what's wrong and what would fix it, and let the admin proceed.

## Hard rules

These are never broken by the allocation.

1. Every squad has at least one coach. The children are young enough that a squad without an adult is not a session.
2. No squad is bigger than the maximum squad size.
3. Every squad meets the coach-to-child ratio.
4. When the coach-with-own-child setting is on, a coach is in the same squad as their own child. Where a coach has more than one child in the team, all of them go into that coach's squad, twins and same-age siblings included.

The target and the minimum squad size are aims rather than rules. They give way before any of the above, and a squad will go over its target if that's what it takes to keep every squad staffed. The maximum is not an aim and never gives way.

Where a child has two parents coaching, both go to that child's squad.

### The coach-with-own-child setting

**On**, and rule 4 applies as written. A coach is only ever placed in their own child's squad, and a coach whose child isn't attending stands down for the session.

**Off**, and rule 4 does not apply. Coaches are spread evenly wherever they are needed, nobody stands down, and a coach can take a session their own child misses. Nothing else in this file changes.

It is a team setting rather than a fixed rule because the answer differs by age group.

## Coaches who stand down

This applies only when the coach-with-own-child setting is on.

A coach goes in their own child's squad and nowhere else, so a coach who accepts on a night their own child isn't attending cannot be placed at all. They stand down for that session.

That changes the arithmetic. The squad count, the ratio and the minimum coaches per squad are all worked out from the coaches who can actually coach, not from the coaches who accepted. Twelve acceptances with one of their children declining is eleven coaches for every rule in this file.

Tell the admin plainly: name who stood down and why, and show both numbers, so the gap between what was accepted and what is available is never a surprise.

## Even spread of coaches and sizes

The minimums above are floors, not targets. Both of the following apply on every allocation, whichever mode is in use.

**Coaches are spread as evenly as the numbers allow.** Twelve coaches across four squads is 3/3/3/3, not 6/2/2/2, even though the second passes a minimum of one.

**Squad sizes are as even as the numbers allow.** Thirty children across four squads is 8/8/7/7, not 12/12/5/5.

Where the numbers don't divide cleanly, the remainder is spread one per squad rather than landing on one squad.

## Precedence

Where these pull against each other, the order is:

1. The hard rules.
2. Even squad sizes and even coach spread.
3. The mode, school affinity or balanced ability.

So coach placement beats school affinity: a coach's child may end up the only one from their school in their squad, and that is accepted rather than corrected. School cohorts are fitted inside the squad sizes the even spread has already set, not the other way round.

With the coach-with-own-child setting off, coaches are not anchored to a child and this particular tension does not arise.

## Order of placement

This section applies when the coach-with-own-child setting is on. With it off, coaches are spread as evenly as the numbers allow and the children are placed by the mode and the even size rule, with no ordering problem to solve.

The order matters, because a coach's squad is decided by their child's squad. If the children are placed freely first, the coaches fall wherever their children landed and the even coach spread becomes impossible.

So place people in this order:

1. The children who have a parent coaching, spread across the squads so that the coaches attached to them come out evenly spread.
2. Their coaching parents, into those same squads.
3. Any remaining coaches, filling the squads with fewest.
4. Everyone else, applying the mode below and the even size rule.

## Soft rule — one mode per event

Exactly one of the following applies, chosen by the admin. Never both, never neither. The younger age groups use school affinity, the older ones use balanced ability, but the mode is set on the event rather than hardcoded to an age.

### School affinity

No child is the only one from their school in their squad. If a child from school A is placed in squad 1, at least one other child from school A is also in squad 1.

On top of that floor, each school is spread as evenly as it can be across the squads rather than being left clustered in one. The two pull against each other, so the floor wins.

In practice: take the children attending from one school and split them into as many blocks as possible, where every block holds at least two children. Then place those blocks in different squads. Nine children from school A across four squads becomes 3/2/2/2, not 9/0/0/0. Three children from school A stay together as one block of three, because two-and-one would leave a child alone.

Children who are the only attendee from their school that night can't satisfy the floor at all. Pool all of them into a single squad together. A child with no school recorded counts as a singleton for that session.

That squad is a squad like any other. It is bound by the same sizes, the minimum coaches and the ratio. If there are more singletons than one squad can take, split them across two or more squads.

If only one child is a singleton on a given night there is no pool to place them in. Place them normally and tell the admin the rule couldn't be met for that child.

### Balanced ability

Ratings are spread evenly across squads, so each squad holds a mix of strong, average and weaker players. This is the opposite of banding: do not put the 1s together and the 5s together.

Spread them in this order: the 1s first, then the 5s, then the 2s, then the 4s, and the 3s fill the remaining places. No squad needs one of every rating.

A missing rating is treated as 3, and the admin is told which children it applied to.

## Banding, considered and parked

Banding, meaning deliberately grouping by ability, was considered and parked.

The reason is that banded squads make a child's rating readable by any parent who can see who else is in the squad. That conflicts with keeping ratings admin-only.

## Manual changes

The admin can move any player or coach between squads after allocation. A manual move is pinned.

Moving someone must work without a mouse. Dragging is welcome as the quick way, but it cannot be the only way: every name carries a control that moves that person to a named squad, reachable by keyboard. A squad sheet gets worked on at a pitch-side on whatever device is to hand, and a rule that can only be applied by dragging is a rule some admins cannot apply at all.

Re-running the allocation keeps pinned people where the admin put them and reallocates everyone else around them. The admin can clear all pins to get a clean allocation.

When the coach-with-own-child setting is on, moving one of a coach and child pair moves the other with it, and warns the admin: a manual move never splits the pair. With the setting off there is no pair to hold together, and a coach moves on their own.

A manual move can break the other hard rules. Allow it, and show the admin what it broke.

## Re-running the allocation

The allocation re-runs by itself whenever something changes it: a response, an admin override, a coach flag, a setting, the mode, the squad count, or an edit to a child's rating or school. There is no re-run button, because there is nothing left for it to do.

A re-run is never silent. Tell the admin that the squads were updated, what caused it, and what changed as a result — whether the squad count moved, and how many children changed squad. A change that moves nobody is still reported, because "nothing moved" is the useful answer.

A re-run keeps everyone where they are and makes the fewest moves that satisfy the rules, so a late change doesn't reshuffle the session. Pinned people stay put, and clearing all pins remains the way to get a clean allocation from scratch.

Re-publishing notifies only those whose squad has changed.

## Visibility

Parents see which squad their child is in, the coaches for it, and the names of the other children in it.

Ability ratings are admin-only. They must not appear anywhere a parent can reach, including squad listings, notifications, exports and anything shared outside the app.

The one export is an admin export of a session's squads, for printing or sharing. It carries names, squads and coaches only.

A parent sees their own child's school, because they entered it, but never another child's. Neither school nor rating is ever given as the reason a child is in a squad.

## Open questions

- The adult-to-child number for a social event. The coach ratio does not apply, because nobody is coaching, but a club day out still needs enough adults. Whether that is a ratio, a flat number or a judgement left to the organiser has not been decided.
- Whether a coach with children in two age groups can be allocated when those two sessions run at the same time. Probably an availability problem rather than an allocation one, but it hasn't been decided.
- What a pitch layout diagram has to show: where the stations are, the route squads take between them, whether it is drawn per event or per venue. Parents receive one alongside their squad, and none of it is specified.
