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
- The team's settings, below.

## Settings

These are set per team by an admin, and can be overridden on a single event. An event override applies to that event only and never changes the team's settings.

| Setting | Default | Meaning |
| --- | --- | --- |
| Maximum groups | 10 | Never exceeded. |
| Minimum coaches per group | 1 | Never broken. |
| Coach-to-child ratio | 1:8 | A ceiling on children per coach, checked within each group. |
| Target group size | *TBC* | What the allocation aims for. |
| Minimum group size | *TBC* | Below this, use fewer groups. |

The ratio is a ceiling, not a target. Fewer children per coach is always acceptable. The older age groups will run at 1:10, which is why it's a setting rather than a constant.

The ratio is checked group by group, not across the session. Twenty children in a group with two coaches fails, even if the session as a whole has enough coaches to average out.

## Deriving the number of groups

Worked out on the night from the turnout and the coaches present, not fixed in advance.

Find the number of groups that satisfies all of the following and lands closest to the target group size:

- No more than the maximum number of groups.
- Every group has at least the minimum number of coaches.
- Every group meets the coach-to-child ratio.
- No group falls below the minimum group size.

An admin can override the number of groups on an event. Every rule still applies, but the app can no longer adjust the count to make things fit, so a count that can't satisfy the rules is reported rather than silently changed.

## When the rules can't all be met

Tell the admin in plain words which rule can't be met and why, and suggest the change that would fix it. For example, that two more coaches would allow eight groups instead of six, or that dropping to five groups would meet the ratio.

This is a normal outcome on a bad night, not an error. Say what's wrong and what would fix it, and let the admin proceed.

## Hard rules

These are never broken by the allocation.

1. Every group has at least one coach. The children are young enough that a group without an adult is not a session.
2. A coach is in the same group as their own child.
3. Every group meets the coach-to-child ratio.

Group sizes give way before any of these. The target and minimum sizes are aims, and a group will go over its target if that's what it takes to keep every group staffed.

Where a child has two parents coaching, both go to that child's group.

## Even spread of coaches and sizes

The minimums above are floors, not targets. Both of the following apply on every allocation, whichever mode is in use.

**Coaches are spread as evenly as the numbers allow.** Twelve coaches across four groups is 3/3/3/3, not 6/2/2/2, even though the second passes a minimum of one.

**Group sizes are as even as the numbers allow.** Thirty children across four groups is 8/8/7/7, not 12/12/5/5.

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

That group is a group like any other. It is bound by the same sizes, the minimum coaches and the ratio. If there are more singletons than one group can take, split them across two or more groups.

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

- Target and minimum group size. Everything else now has a default, so these are the last two numbers outstanding, and they need the club.
- Whether a coach with children in two age groups can be allocated when those two sessions run at the same time. Probably an availability problem rather than an allocation one, but it hasn't been decided.
