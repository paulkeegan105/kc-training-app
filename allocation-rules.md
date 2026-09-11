# Group allocation rules

Scope: how available players and coaches are split into groups for a single event. Everything else in the app (teams, events, availability, notifications) is out of scope for this file.

## Model

**Person** — a child or an adult. Has a full name. Children have a school and an ability rating. Adults may be linked to one or more children as parent.

**Account** — a login. One household uses one account. An account has one or more people attached to it, and can be signed in on several phones at once, all receiving the same notifications.

Person and account are separate on purpose. Availability is answered per person, not per account, so a household can say yes for the child and no for the coaching parent on the same night.

**Group** — one station at a training session, or one team at a match. Has players and coaches.

## Inputs

- The list of people who accepted the event, players and coaches separately.
- Ability rating per child, 1 to 5, where 1 is strongest and 5 is weakest. Admin-only.
- School per child. Admin-only.
- Parent-to-child links.
- Min and max players per group. *TBC.*
- Min coaches per group. *TBC.*

## Deriving the number of groups

Driven by both attendance and coach numbers on the night, not fixed in advance.

- The player count and the max per group set the floor on how many groups are needed.
- The player count and the min per group set the ceiling.
- The coach count and the min coaches per group set a second ceiling.

The real number of groups is the lowest of the ceilings, and must be at least the floor. If the coach ceiling falls below the floor there aren't enough coaches to run the session within the size limits. The app should say so plainly and let the admin proceed anyway.

## Hard rules

These are never broken by the allocation.

1. A coach is in the same group as their own child.
2. Every group is within the min and max player sizes.
3. Every group has at least the minimum number of coaches.

Where a child has two parents coaching, both go to that child's group if it stays within the coach limits. If it doesn't, the admin resolves it.

## Even spread of coaches and sizes

The minimums above are floors, not targets. Both of the following apply on every allocation, whichever mode is in use.

**Coaches are spread as evenly as the numbers allow.** Twelve coaches across four groups is 3/3/3/3, not 6/2/2/2, even though the second passes a minimum of two.

**Group sizes are as even as the numbers allow.** Thirty children across four groups is 8/8/7/7, not 12/12/5/5, even though the second sits inside a min of five and a max of twelve.

Where the numbers don't divide cleanly, the remainder is spread one per group rather than landing on one group.

## Order of placement

The order matters, because a coach's group is decided by their child's group. If the children are placed freely first, the coaches fall wherever their children landed and the even coach spread becomes impossible.

So place people in this order:

1. The children who have a parent coaching, spread across the groups so that the coaches attached to them come out evenly spread.
2. Their coaching parents, into those same groups.
3. Any remaining coaches, filling the groups with fewest.
4. Everyone else, applying the mode below and the even size rule.

## Soft rule — one mode per event

Exactly one of the following applies, chosen by the admin. Never both, never neither. The younger age groups use school affinity, the older ones use balanced ability, but the mode is set on the event rather than hardcoded to an age.

### School affinity

No child is the only one from their school in their group. If a child from school A is placed in group 1, at least one other child from school A is also in group 1.

On top of that floor, each school is spread as evenly as it can be across the groups rather than being left clustered in one. The two pull against each other, so the floor wins.

In practice: take the children attending from one school and split them into as many blocks as possible, where every block holds at least two children. Then place those blocks in different groups. Nine children from school A across four groups becomes 3/2/2/2, not 9/0/0/0. Three children from school A stay together as one block of three, because two-and-one would leave a child alone.

Children who are the only attendee from their school that night can't satisfy the floor at all. Pool all of them into a single group together.

That group is a group like any other. It is bound by the same min and max sizes and needs the same minimum number of coaches. If there are more singletons than the maximum group size allows, split them across two or more groups.

### Balanced ability

Ratings are spread evenly across groups, so each group holds a mix of strong, average and weaker players. This is the opposite of banding: do not put the 1s together and the 5s together.

## Manual changes

The admin can move any player or coach between groups after allocation. A manual move is pinned.

Re-running the allocation keeps pinned people where the admin put them and reallocates everyone else around them. The admin can clear all pins to get a clean allocation.

A manual move can break a hard rule. Allow it, and show the admin what it broke.

## Visibility

Parents see which group their child is in and who is coaching it.

Ability ratings and schools are admin-only. They must not appear anywhere a parent can reach, including group listings, notifications, exports and anything shared outside the app. Neither is ever given as the reason a child is in a group.

## Open questions

- Min and max players per group.
- Min coaches per group.
- Whether a coach with children in two age groups can be allocated when those two sessions run at the same time. Probably an availability problem rather than an allocation one, but it hasn't been decided.
