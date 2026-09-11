# Open questions — spec review

Review of `app-spec.md` and `allocation-rules.md`. Split into: contradictions (the two documents or a single document disagrees with itself), gaps that block a build, and things I'd have to invent outright.

## Contradictions

**1. There is no Coach role.** `app-spec.md` defines exactly three roles — Player (default), Event Manager, Team Admin. `allocation-rules.md` is built entirely on a coach/player distinction: coaches are a separate input list, there's a minimum coaches per group, and hard rule 1 pins a coach to their child's group. Is "coach" the same thing as Team Admin/Event Manager, a fourth role, or a per-event flag (someone is coaching *this* session)? Nothing else in the allocation can be built until this is settled.

**2. Hard rules are "never broken by the allocation", but the spec instructs breaking them.** When the coach ceiling falls below the floor, the app should "say so plainly and let the admin proceed anyway". Proceeding necessarily violates either rule 2 (group sizes) or rule 3 (min coaches). Which one gives way — do you make the floor number of groups with too few coaches in some, or fewer groups that exceed max size?

**3. Unregistered members "receive notifications straight away", but notifications are push and email only.** An admin adds a member with "a name and a contact detail". If that detail is a phone number, they have no push (no app) and no email, so they receive nothing — and no SMS is allowed. Should the contact detail be mandatorily an email?

**4. Registration can only happen by email match, so phone-only members are permanently unregistered.** "When that person signs up using the same email address, they become registered." Is there any other path — an invite link, an admin manually linking a signup to an existing member?

**5. Parents never see a child's school or rating, but registered members "manage their own details".** Who enters a child's school and ability rating, and can a registered parent see or edit their *own* child's record? As written, "never sees any child's... school, anywhere in the app" includes their own child — which means the admin must source school data some other way.

**6. "One household has one account" vs "every parent gets a login" vs "their own account".** If both parents and a grandparent share one login, whose account is it, and what does "a parent does from their own account" mean? Compounding this: "members can set their own notification preferences", but all phones on an account get the same notifications. If Mum wants email only and Dad wants push, one shared account can't express that.

**7. Blackout dates auto-decline, but declining requires a reason.** "A member who declines is asked for a reason" — nobody is present to be asked when the decline is automatic. Does an auto-decline carry a system-generated reason, skip the reason, and can the member override it later for a specific event?

**8. Delete may be a dead feature.** Deleting is allowed only before notifications have gone out. If the invitation notification fires automatically when an event is created, there is never a window to delete. Is there an explicit publish/invite step separate from creation?

**9. Venue is required and location is optional, with no stated difference.** What is each for?

**10. A max coaches per group is referenced but never defined.** Two coaching parents of one child both go to that child's group "if it stays within the coach limits" — the Inputs list only a *minimum*. Is there a maximum, and is it a hard rule?

**11. The singleton pool can't always be a legal group.** Singletons are pooled into one group, which is "bound by the same min and max sizes". With three singletons and a minimum of five, you must top it up with non-singletons — is that intended? And a *single* singleton on the night can't satisfy the school floor anywhere; the spec doesn't say what to do or what to show.

## Gaps that block a build

**12. Min/max players per group and min coaches per group are all TBC** — the entire group-count derivation depends on them. Are they set per team, per event, or per event type, and who sets them?

**13. Does allocation apply to matches at all?** A group is "one station at a training session, or one team at a match". Those aren't the same constraint: a match squad size is fixed by the code (e.g. Go Games sides), not by an admin's min/max. Does an admin set the group count directly for games?

**14. The derivation always produces the maximum permitted number of groups.** Taking the lowest ceiling and clamping up to the floor means 30 players with min 5 / max 12 and 12 coaches gives six groups of five, not three of ten. Is "as many small groups as the coaches allow" the intent, and can the admin override the number?

**15. Tiny or lopsided turnouts are undefined.** Four players with a minimum of five gives a ceiling of zero groups and a floor of one. Zero coaches, or one player, likewise. What should happen?

**16. A coach with two children in the same age group can't be in both their groups.** Twins and same-age siblings are common. Which child wins, or does the admin resolve it?

**17. Precedence between step 1 and the school-affinity floor is undefined.** Coaches' children are placed first, before the mode is applied, so a coach's child can land as the only one from their school in that group. Does the affinity floor get to move them afterwards, or does the coach spread win?

**18. Precedence between "sizes as even as possible" and "schools spread as evenly as possible" is undefined.** Both are stated as applying to every allocation and they routinely conflict. Which yields, or is there a weighting?

**19. Missing ability ratings and missing schools.** New child, or a rating nobody has set yet — does balanced ability refuse to run, treat it as a 3, or exclude them from balancing?

**20. School needs to be a controlled list.** If it's free text, "St Mary's" and "St. Marys" are two schools and the singleton logic silently misfires. Is there a club-level list of schools?

**21. Who is invited to an event?** Always the whole team, or can an admin invite a subset? Are adults invited to every event, or only those flagged as coaching?

**22. Availability changes after groups are published.** Someone accepts late or drops out on the morning. Does the app re-run, warn the admin, or do nothing? Does re-publishing re-notify everyone?

**23. Does moving a child move their coaching parent?** Manual moves are pinned; moving one half of a coach/child pair breaks hard rule 1. Does the app move both, or break the rule and report it?

**24. Recurring event edits.** Does editing or cancelling one occurrence affect the series? What happens to a series when a member is added mid-way?

**25. Event end time or duration is never specified** — the calendar subscription needs one.

**26. Exports are referenced in the visibility rules but no export feature is defined anywhere.** What exports exist, and for whom?

**27. Club-level administration doesn't exist in the role model.** The crest is "set once at club level", but there's no club admin. Who creates teams, and who appoints the first Team Admin of a new team?

**28. Last-admin protection.** A team must always have at least one admin — what stops the only admin from removing themselves or deleting their account?

**29. Removing a member.** What happens to their past availability responses and historical group placements?

**30. Member CSV import is in Notes, not scope.** Given Teamer has no export and closes 5 October 2026, is it in?

## Things I'd have to invent to build it

These aren't underspecified so much as absent — if you don't answer them I will pick something and it will be a guess:

**31. Platform and stack.** Push notifications imply native apps or web push; nothing states iOS/Android/web, or whether this is one deployment for one club or multi-tenant.

**32. Authentication.** Email and password, magic link, social sign-in? Password reset, and how a signup gets matched to an existing unregistered member.

**33. The balanced-ability objective function.** "Ratings spread evenly" has several reasonable implementations — equalise each group's mean, snake-draft by rating, or equalise the count of each rating value per group. They give different answers.

**34. Player of the Game entirely.** Who votes (parents, children, coaches), one vote per person or per account, whether you can vote for your own child, when voting opens and closes, whether results are public, and what happens on a tie.

**35. CSV schemas** for both the event template and any member import, plus validation and partial-failure behaviour on a bad row.

**36. Chaser and reminder scope.** Is the 24-hour reminder toggle per event or per team? Does it go to everyone or only non-responders? Is there a limit on manual chasers?

**37. Whether an admin override of someone's status is visible to that person,** and whether an overridden "accepted" feeds the allocation identically to a real one.

**38. What parents see of a group beyond their own child** — the other children's names, or only the coaches.

**39. Data protection.** Nothing addresses consent, retention, or subject access for children's records — including an ability rating that is explicitly hidden from the child's own parents. For a club handling young children's data this needs a decision before launch, not after.

**40. Timeline.** Teamer closes 5 October 2026, which is under four weeks away. The scope above is considerably more than that allows, so I'd assume a cut-down first release — which of these is genuinely needed by 5 October versus later?

---

The three I'd want answered before anything else are **1** (no Coach role), **2** (hard rules vs proceed anyway) and **12** (the TBC numbers) — the allocation engine can't be specified, let alone written, without them.
