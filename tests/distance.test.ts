/** The distance check ("Where I am"): the scoring rules, the plain proof check, the written situations and the AI readers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { widestGap, closest, disagreement, blindSpot, writtenReport, partnerMessageWritten, partnerQuestion, PARTNER_WORDS, evidenceHeuristic, shuffled, positionWord, POSITIONS, PRESSURE_TYPES, RULE_ORDER, type RuleResult } from "../src/lib/distance";
import { DISTANCE_SCENARIOS, SEATS, seatFor } from "../src/content/distanceScenarios";
import { parseDistanceScenario, parseEvidenceCheck, parseDistanceReport, parsePartnerMessage } from "../src/lib/ai";

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
  const rep = writtenReport(rules, null);
  assert.deepEqual(rep.keys, { closest: "O", widest: "E", disagree: "F", blind: null });
  assert.match(rep.closest, /^Outcome Aware: "a leader who stays calm when decisions get\.\.\."/);
  assert.match(rep.widest_gap, /^Emotionally Anchored\. You placed yourself at Pulling out\./);
  assert.match(rep.widest_gap, /couldn't name a real moment/);
  assert.match(rep.disagreement, /^On Future Focused, you placed yourself at Driving like them, but/);
  assert.equal(rep.partner, "");
  assert.equal(writtenReport(rules, { name: "Sam", answered: false }).partner, "Waiting on Sam.");
  const withPartner = named([r("F", 5, "future_self", "concrete", 1), r("O", 3, "future_self", "concrete", 2), r("R", 3), r("G", 3), r("E", 2)]);
  assert.match(writtenReport(withPartner, { name: "Sam", answered: true }).partner, /^Sam sees Future Focused differently/);
  const all = [rep, writtenReport(withPartner, { name: "Sam", answered: true })].flatMap((x) => [x.closest, x.widest_gap, x.disagreement, x.partner]).join(" ");
  assert.ok(!/\d|%/.test(all), all);
  assert.ok(!/[—–]/.test(all));
  assert.ok(!STYLE.test(all), all);
  assert.ok(!/autopilot|white.?knuckle|future.?self|avoidance/i.test(all), all);
});

test("a tie on position is explained by the situation", () => {
  const rep = writtenReport(named([r("F", 2, "white_knuckle"), r("O", 2, "autopilot"), r("R", 4), r("G", 4), r("E", 4)]), null);
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
