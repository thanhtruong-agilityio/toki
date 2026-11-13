# Toki Blueprint sources

The Toki Blueprint is one page that holds the prototype, the requirements, user flows, questions and gaps, the technical design, milestones and the phase 1 plan, in English and Vietnamese.

Published at: https://claude.ai/code/artifact/e6b79d7f-ff70-41b2-99d6-d2cb61c33b35

## Files

| File | What it is |
|---|---|
| `blueprint.en.json` | The Blueprint's content in English. Source of truth. |
| `blueprint.vi.json` | The same content in Vietnamese. Same ids as the English file. |
| `gen_flowmaps.py` | The source of the charts and tables at the top of the Flows tab: 2 high-level charts, 13 detailed swimlane charts (user, frontend, backend), 3 error charts, the business rules, the assumptions and the open questions. Every string is `English||Tiếng Việt`. Edit this file. |
| `flowmaps.json` | Written by `gen_flowmaps.py`. Do not edit by hand. |
| `gen_analysis.py` | The source of the Gap analysis tab: prototype overview, findings, missing flows, open questions, assumptions and risks. Writes the `analysis` key into both language files. Edit this file. |
| `gen_validation.py` | The source of the Validation tab: findings backlog, decisions required, flow validation, business rules, requirements (FR, NFR), acceptance criteria, test scenarios, traceability matrix and readiness report. Reads `gen_flowmaps.py` and `gen_analysis.py`; writes the `validation` key into both language files. Run it last. |
| `test_details.py` | The full text of each test scenario: preconditions, numbered steps and expected result, one entry per test in the order `gen_validation.py` numbers them. The one-line text in `gen_validation.py` is the scenario's name. |
| `flowmaps.prototype.json` | Six screen maps drawn from a walkthrough of the prototype. Not shown on the page; kept for reference. |
| `prototype/index.html` | A snapshot of the Toki prototype, embedded in the Prototype tab. |
| `blueprint.html` | The built page. Not committed; rebuild it. |

## Changing the Blueprint

Edit the JSON, never the built HTML. Change both language files in the same edit so they keep the same ids.

The build scripts belong to the `prototype-blueprint` skill (`~/.claude/skills/prototype-blueprint/scripts/`).

```bash
SKILL=~/.claude/skills/prototype-blueprint/scripts
cd docs/blueprint

# after editing gen_flowmaps.py: write the spec, validate it, and redraw the charts into both data files
# (flowmap.py stops if a decision has one branch, a step is unreachable, or a step is a dead end)
python3 gen_flowmaps.py

# after editing gen_analysis.py: write the Gap analysis tab into both data files
python3 gen_analysis.py
# last: write the Validation tab (needs the three steps above)
python3 gen_validation.py
python3 $SKILL/flowmap.py --spec flowmaps.json --data en=blueprint.en.json --data vi=blueprint.vi.json

# check each file, and that the two languages list the same things
python3 $SKILL/check.py --data blueprint.en.json --lang en --compare blueprint.vi.json
python3 $SKILL/check.py --data blueprint.vi.json

# build the page
python3 $SKILL/build.py --data en=blueprint.en.json --data vi=blueprint.vi.json \
        --prototype prototype/index.html --out blueprint.html
```

Then publish `blueprint.html` to the artifact URL above.

## If these files are ever lost

The published page embeds both data files as JSON in `<script id="bp-data">`, and the English data carries the chart spec at `flowsTab.spec`. Everything here except the prototype snapshot can be extracted from the page.

## The published page since 13 Nov 2026

The Toki Blueprint artifact is published in the nine-tab format of the `prototype-blueprint` skill (Overview, Prototype, Findings, Decisions, Flows, Requirements, QA, Technical, Plan), with one decision log (D-001 onward; the earlier ids stay in a column). This folder remains the source of the content. `../blueprint-v2/gen_page.py` assembles the page data from it, and the skill's `build_page.py` renders the page. The older twelve-tab page (`blueprint.html`) is no longer published.

```bash
S=~/.claude/skills/prototype-blueprint/scripts
python3 gen_flowmaps.py
python3 $S/flowmap.py --spec flowmaps.json --data en=blueprint.en.json --data vi=blueprint.vi.json
cd ../blueprint-v2
python3 gen_page.py                       # writes page.en.json and page.vi.json
python3 $S/build_page.py --data en=page.en.json --data vi=page.vi.json \
        --prototype ../blueprint/prototype/index.html --out toki-blueprint.html --title "Toki Blueprint"
```

Publish `toki-blueprint.html`. The format and the shape of `page.<lang>.json` are described in the skill's `references/page-format.md`.
