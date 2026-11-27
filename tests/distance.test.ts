/** The distance check ("Where I am"): the scoring rules, the plain proof check, the written situations and the AI readers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { widestGap, closest, disagreement, blindSpot, writtenReport, movement, movementNote, middle, joinNames, partnersSplit, partnerMessageWritten, partnerQuestion, PARTNER_WORDS, evidenceHeuristic, shuffled, positionWord, POSITIONS, PRESSURE_TYPES, RULE_ORDER, type RuleResult } from "../src/lib/distance";
import { DISTANCE_SCENARIOS, SEATS, seatFor } from "../src/content/distanceScenarios";
import { parseDistanceScenario, parseEvidenceCheck, parseDistanceReport, parsePartnerMessage, inventsLife } from "../src/lib/ai";

const r = (pillar: RuleResult["pillar"], position: number, pressure: RuleResult["pressure"] = "future_self", evidence: RuleResult["evidence"] = "concrete", partnerRating?: number): RuleResult => ({ pillar, position, pressure, evidence, partnerRating });

test("positions are words, never numbers", () => {
  assert.equal(POSITIONS.length, 5);
  assert.equal(positionWord(1), "Still parked");
  assert.equal(positionWord(5), "Driving like them");
  assert.equal(positionWord(0), "");
  assert.equal(positionWord(null), "");
});

test("widest gap: lowest position first, then the worse pressure answer, then the weaker proof", () => {
  assert.equal(widestGap([r("F", 4), r("O", 2), r("R", 3), r("G", 5), r("E", 3)]), "O");
  assert.equal(widestGap([r("F", 2, "white_knuckle"), r("O", 2, "autopilot"), r("R", 4), r("G", 4), r("E", 4)]), "O");
  assert.equal(widestGap([r("F", 2, "avoidance", "concrete"), r("O", 2, "avoidance", "missing"), r("R", 4), r("G", 4), r("E", 4)]), "O");
  assert.equal(widestGap([]), null);
});

test("closest: where all three agree, and never the widest gap", () => {
  assert.equal(closest([r("F", 5, "white_knuckle"), r("O", 3, "future_self", "concrete"), r("R", 2), r("G", 4, "avoidance"), r("E", 3, "autopilot")]), "O");
  // nobody agrees fully: the highest position
  assert.equal(closest([r("F", 5, "avoidance"), r("O", 3, "autopilot"), r("R", 1, "autopilot"), r("G", 4, "avoidance"), r("E", 3, "autopilot")]), "F");
  const same = [r("F", 3), r("O", 3), r("R", 3), r("G", 3), r("E", 3)];
  assert.notEqual(closest(same), widestGap(same));
});

test("disagreement: placed close, but the pressure test or the proof says otherwise", () => {
  assert.equal(disagreement([r("F", 5, "autopilot"), r("O", 4, "future_self", "vague"), r("R", 2, "autopilot")]), "F");
  assert.equal(disagreement([r("F", 3, "autopilot"), r("O", 4), r("R", 5)]), null);
  assert.equal(disagreement([r("F", 4, "future_self", "missing")]), "F");
});

test("blind spot: only when the partner sees it clearly differently", () => {
  assert.equal(blindSpot([r("F", 5, "future_self", "concrete", 1), r("O", 3, "future_self", "concrete", 2)]), "F");
  assert.equal(blindSpot([r("F", 5, "future_self", "concrete", 4), r("O", 1, "future_self", "concrete", 1)]), null);
  assert.equal(blindSpot([r("F", 3), r("O", 3)]), null, "no partner answers, no blind spot");
});

test("the plain proof check finds a real moment", () => {
  assert.equal(evidenceHeuristic("On Tuesday at the 9 am meeting I asked a question first."), "concrete");
  assert.equal(evidenceHeuristic("When my boss pushed back I said I'd look at it again."), "concrete");
  assert.equal(evidenceHeuristic("I try my best most days."), "vague");
  assert.equal(evidenceHeuristic("I usually stay calm."), "vague");
  assert.equal(evidenceHeuristic("I don't know"), "missing");
  assert.equal(evidenceHeuristic(""), "missing");
});

test("seats come from the role they wrote", () => {
  assert.equal(seatFor("project lead"), "project lead");
  assert.equal(seatFor("Operations Manager"), "manager");
  assert.equal(seatFor("Founder"), "owner");
  assert.equal(seatFor("Associate minister"), "pastor");
  assert.equal(seatFor("mom of three"), "parent");
  assert.equal(seatFor("youth basketball coach"), "coach");
  assert.equal(seatFor(""), "general");
  assert.equal(seatFor("nurse"), "general");
});

const STYLE = /\b(steady|steadi\w*|drift\w*|rhythm\w*|navigat\w*|resonat\w*|lean into|under pressure|accumulat\w*|compound\w*|holds?|held)\b/i;

test("a written situation for every seat and every rule, four short options, in the house style", () => {
  for (const seat of SEATS) {
    for (const k of RULE_ORDER) {
      const s = DISTANCE_SCENARIOS[seat][k];
      assert.ok(s?.scenario, `${seat} ${k}`);
      for (const t of PRESSURE_TYPES) {
        const o = s.options[t];
        assert.ok(o, `${seat} ${k} ${t}`);
        assert.ok(o.split(/\s+/).length <= 24, `too long: ${o}`);
      }
      const all = [s.scenario, ...Object.values(s.options)].join(" ");
      assert.ok(!/[—–]/.test(all), `dash in ${seat} ${k}`);
      assert.ok(!STYLE.test(all), `banned word in ${seat} ${k}: ${all}`);
      assert.ok(!/, not /.test(all), `", not" in ${seat} ${k}`);
      assert.ok(!/\bFORGE\b|white.?knuckle|autopilot|future.?self/i.test(Object.values(s.options).join(" ")), `label in options ${seat} ${k}`);
    }
  }
});

test("the options are shuffled for display and nothing is lost", () => {
  const a = shuffled([1, 2, 3, 4], () => 0);
  assert.deepEqual([...a].sort(), [1, 2, 3, 4]);
  assert.notDeepEqual(a, [1, 2, 3, 4]);
});

const good = JSON.stringify({ scenario: "Your top client calls at 4 pm on Friday with a fire.", options: [
  { type: "autopilot", text: "Drop everything and handle it yourself." },
  { type: "white_knuckle", text: "Say no through clenched teeth and stew all weekend." },
  { type: "avoidance", text: "Let it go to voicemail and hope it sorts itself out." },
  { type: "future_self", text: "Hand it to Sam with a clear ask and go home." },
] });

test("the AI situation is checked before it is shown", () => {
  const s = parseDistanceScenario("Here you go: " + good);
  assert.ok(s);
  assert.equal(s!.options.length, 4);
  assert.equal(parseDistanceScenario(good.replace("autopilot", "other")), null, "every type is needed");
  assert.equal(parseDistanceScenario(good.replace("with a fire", "and breaks your rhythm")), null, "no rhythm");
  assert.equal(parseDistanceScenario(good.replace("Drop everything", "On autopilot, drop everything")), null, "no labels in options");
  assert.equal(parseDistanceScenario(good.replace("and go home", "and go home ".repeat(10))), null, "options stay short");
  assert.equal(parseDistanceScenario(good, "Hand it to Sam with a clear ask"), null, "no copy of their line");
  assert.equal(parseDistanceScenario("not json"), null);
});

test("the AI proof check: a note only for a close position with thin proof", () => {
  assert.deepEqual(parseEvidenceCheck('{"evidence":"concrete","note":"x"}', 5), { evidence: "concrete", note: "" });
  assert.deepEqual(parseEvidenceCheck('{"evidence":"vague","note":"Add one."}', 2), { evidence: "vague", note: "" });
  assert.equal(parseEvidenceCheck('{"evidence":"vague","note":"You placed yourself close. Add a moment."}', 4)!.note, "You placed yourself close. Add a moment.");
  assert.ok(parseEvidenceCheck('{"evidence":"missing","note":""}', 5)!.note.length > 0, "an empty note falls back to the written one");
  assert.equal(parseEvidenceCheck('{"evidence":"maybe"}', 5), null);
});

const named = (rs: RuleResult[], line = "a leader who stays calm when decisions get challenged") => rs.map((x) => ({ ...x, name: { F: "Future Focused", O: "Outcome Aware", R: "Reason Rooted", G: "Growth Oriented", E: "Emotionally Anchored" }[x.pillar], line }));

test("the written report: four plain sections, no numbers, no labels", () => {
  const rules = named([r("F", 5, "autopilot", "vague"), r("O", 4, "future_self", "concrete"), r("R", 3), r("G", 3, "avoidance"), r("E", 2, "white_knuckle", "missing")]);
  const rep = writtenReport(rules);
  assert.deepEqual(rep.keys, { closest: "O", widest: "E", disagree: "F", blind: null });
  assert.match(rep.closest, /^Outcome Aware: "a leader who stays calm when decisions get\.\.\."/);
  assert.match(rep.widest_gap, /^Emotionally Anchored\. You placed yourself at Pulling out\./);
  assert.match(rep.widest_gap, /couldn't name a real moment/);
  assert.match(rep.disagreement, /^On Future Focused, you placed yourself at Driving like them, but/);
  assert.equal(rep.partner, "");
  assert.equal(writtenReport(rules, [{ name: "Sam", answered: false }]).partner, "Waiting on Sam.");
  assert.equal(writtenReport(rules, [{ name: "Sam", answered: false }, { name: "Lee", answered: false }]).partner, "Waiting on Sam and Lee.");
  const withPartner = named([r("F", 5, "future_self", "concrete", 1), r("O", 3, "future_self", "concrete", 2), r("R", 3), r("G", 3), r("E", 2)]).map((x) => ({ ...x, partnerViews: x.partnerRating ? [{ name: "Sam", rating: x.partnerRating, example: "" }] : [] }));
  assert.match(writtenReport(withPartner, [{ name: "Sam", answered: true }]).partner, /^Sam sees Future Focused differently than you do\. You placed yourself at Driving like them; Sam said rarely\.$/);
  const all = [rep, writtenReport(withPartner, [{ name: "Sam", answered: true }])].flatMap((x) => [x.closest, x.widest_gap, x.disagreement, x.partner]).join(" ");
  assert.ok(!/\d|%/.test(all), all);
  assert.ok(!/[—–]/.test(all));
  assert.ok(!STYLE.test(all), all);
  assert.ok(!/autopilot|white.?knuckle|future.?self|avoidance/i.test(all), all);
});

test("a tie on position is explained by the situation", () => {
  const rep = writtenReport(named([r("F", 2, "white_knuckle"), r("O", 2, "autopilot"), r("R", 4), r("G", 4), r("E", 4)]));
  assert.equal(rep.keys.widest, "O");
  assert.match(rep.widest_gap, /picked the old way of doing it/);
});

test("the AI report is checked before it is shown", () => {
  const ok = '{"closest":"Outcome Aware: your line about noticing your team showed up.","widest_gap":"Emotionally Anchored. You put yourself near the start.","disagreement":"","partner":"Waiting on Sam."}';
  assert.equal(parseDistanceReport(ok, false)!.partner, "", "no partner asked, no partner section");
  assert.equal(parseDistanceReport(ok, true)!.partner, "Waiting on Sam.");
  assert.equal(parseDistanceReport(ok.replace("near the start", "at 2 out of 5")), null, "no numbers");
  assert.equal(parseDistanceReport(ok.replace("showed up", "showed up on autopilot")), null, "no type names");
  assert.equal(parseDistanceReport(ok.replace("showed up", "kept its rhythm")), null);
  assert.equal(parseDistanceReport('{"closest":"","widest_gap":"x"}'), null);
});

test("the message to the partner: short, ends with the link, no lines copied in", () => {
  const link = "https://app.example/partner/abc123";
  const lines = ["a leader my team trusts with bad news", "a leader who notices what my team needs"];
  const ok = '{"message":"Hi Sam, Dana is working on who they\'re becoming and asked for your honest view. It takes about two minutes. {link}"}';
  assert.equal(parsePartnerMessage(ok, lines, link), `Hi Sam, Dana is working on who they're becoming and asked for your honest view. It takes about two minutes. ${link}`);
  assert.equal(parsePartnerMessage(ok.replace(" {link}", ""), lines, link), null, "the link has to be there");
  assert.equal(parsePartnerMessage(ok.replace("Hi Sam,", "Hi Sam, Dana wants to be a leader my team trusts with bad news."), lines, link), null, "no lines in the text");
  assert.equal(parsePartnerMessage(ok.replace("Hi Sam,", "Hi Sam, " + "word ".repeat(60)), lines, link), null, "under sixty words");
  const written = partnerMessageWritten("Dana", "Sam", link);
  assert.ok(written.endsWith(link));
  assert.ok(!/[—–]/.test(written) && !STYLE.test(written));
  assert.equal(partnerQuestion("Dana"), "How often does Dana look like this person?");
  assert.deepEqual(PARTNER_WORDS, ["Rarely", "Sometimes", "Often", "Almost always"]);
});

test("several partners: the middle answer, who is still out, and where they disagree with each other", () => {
  assert.equal(middle([]), null);
  assert.equal(middle([3]), 3);
  assert.equal(middle([1, 2]), 1.5);
  assert.equal(middle([4, 1, 2]), 2, "one generous view doesn't decide it");
  assert.equal(joinNames(["Jamie", "Sam", "Lee"]), "Jamie, Sam and Lee");
  const views = (pairs: [string, number][]) => pairs.map(([name, rating]) => ({ name, rating, example: "" }));
  const base = named([r("F", 5), r("O", 3), r("R", 3), r("G", 3), r("E", 2)]);
  const asked = base.map((x) => {
    const v = { F: views([["Jamie", 1], ["Sam", 2]]), O: views([["Jamie", 3], ["Sam", 3]]), R: views([["Jamie", 3], ["Sam", 1]]), G: views([["Jamie", 2], ["Sam", 2]]), E: views([["Jamie", 2], ["Sam", 3]]) }[x.pillar];
    return { ...x, partnerViews: v, partnerRating: middle(v.map((y) => y.rating)) };
  });
  const rep = writtenReport(asked, [{ name: "Jamie", answered: true }, { name: "Sam", answered: true }, { name: "Lee", answered: false }]);
  assert.equal(rep.keys.blind, "F");
  assert.match(rep.partner, /^Jamie and Sam see Future Focused differently than you do\. You placed yourself at Driving like them; Jamie said rarely and Sam said sometimes\./);
  assert.match(rep.partner, /On Reason Rooted, Jamie said often and Sam said rarely, so they don't see it the same way\./);
  assert.match(rep.partner, /Still waiting on Lee\.$/);
  assert.ok(!/\d|%/.test(rep.partner) && !STYLE.test(rep.partner));
  assert.equal(partnersSplit(views([["Jamie", 2], ["Sam", 3]])), false);
});

test("day 30: movement per rule, as road positions, and moving back said plainly", () => {
  const before = [{ pillar: "F", position: 4, pressure: "autopilot" }, { pillar: "O", position: 3, pressure: "future_self" }, { pillar: "R", position: 4, pressure: "avoidance" }, { pillar: "G", position: 2, pressure: "" }, { pillar: "E", position: 2, pressure: "white_knuckle" }];
  const now = [{ pillar: "F", position: 5, pressure: "future_self" }, { pillar: "O", position: 3, pressure: "future_self" }, { pillar: "R", position: 3, pressure: "autopilot" }, { pillar: "G", position: 2, pressure: "avoidance" }, { pillar: "E", position: 4, pressure: "white_knuckle" }];
  const m = movement(before, now);
  assert.deepEqual(m.map((x) => [x.pillar, x.from, x.to, x.road, x.pressure]), [
    ["F", "Closing the distance", "Driving like them", "closer", "closer"],
    ["O", "On the road", "On the road", "same", "same"],
    ["R", "Closing the distance", "On the road", "back", "back"],
    ["G", "Pulling out", "Pulling out", "same", ""],
    ["E", "Pulling out", "Closing the distance", "closer", "same"],
  ]);
  assert.equal(movementNote(m[0]), "You moved closer. Your answer to the situation moved toward the person in your line.");
  assert.equal(movementNote(m[2]), "This one moved back since last time. Your answer to the situation moved away from the person in your line.");
  assert.equal(movementNote(m[1]), "Same place as last time.");
  const all = m.map(movementNote).join(" ");
  assert.ok(!/\d|%/.test(all) && !STYLE.test(all) && !/[—–]/.test(all));
});

test("the AI can't invent a life: no kids, spouse or soccer practice they never mentioned", () => {
  const sc = (scenario: string, opt = "Decide, then say it clearly.") => ({ scenario, options: PRESSURE_TYPES.map((type) => ({ type, text: opt })) });
  const told = "someone who leads people at work a leader my team trusts with bad news";
  assert.equal(inventsLife(sc("Your daughter's soccer practice runs late and your boss calls."), told), true);
  assert.equal(inventsLife(sc("Your top client calls at 4 pm Friday."), told), false);
  assert.equal(inventsLife(sc("Your client calls at 4 pm.", "Tell your wife you'll be late, then take the call."), told), true, "options count too");
  // a parent's seat allows their children, but not their ages or their activities
  assert.equal(inventsLife(sc("Your child calls needing help tonight."), "parent"), false);
  assert.equal(inventsLife(sc("Your kids' soccer game starts at 5."), "parent"), true);
  assert.equal(inventsLife(sc("Your teenager is in the car."), "parent"), true);
  // what they told us is fair to use
  assert.equal(inventsLife(sc("You're at your son's soccer game when the call comes."), "dad who coaches my son's soccer team"), false);
});

test("the written situations assume nothing about anyone's family", () => {
  for (const seat of SEATS.filter((x) => x !== "parent")) {
    for (const k of RULE_ORDER) {
      const s = DISTANCE_SCENARIOS[seat][k];
      const all = [s.scenario, ...Object.values(s.options)].join(" ");
      assert.ok(!/\b(kids?|child|children|son|daughter|teen\w*|spouse|husband|wife|soccer|school|homework)\b/i.test(all), `${seat} ${k}: ${all}`);
    }
  }
  const parent = RULE_ORDER.map((k) => { const s = DISTANCE_SCENARIOS.parent[k]; return [s.scenario, ...Object.values(s.options)].join(" "); }).join(" ");
  assert.ok(!/\b(teen\w*|toddler|school|homework|principal|soccer|spouse|husband|wife)\b/i.test(parent), "no ages or partners assumed for a parent");
});
