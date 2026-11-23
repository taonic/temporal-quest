# 01 · The first human language after English

Status: needs-triage

## What

Quest is only in English. Translate it into one more human language first, and choose which.

**Proposed: Japanese.** Simplified Chinese is the alternative.

| | Japanese | Simplified Chinese | Korean |
|---|---|---|---|
| English proficiency (EF EPI 2025) | 96th of 123, "very low" | 86th, "low" | 48th, "moderate" |
| Developers | Large | Largest | Medium |
| Temporal Cloud buyers | Strong: enterprises that pay, and Temporal's planned APJ push | Weak: mainland data rules, the firewall, no local region | Good, smaller |
| Temporal learning material in the language | Almost none | Some community translations | Almost none |

- **Japanese** if the goal is Cloud pipeline. English is lowest there and still falling. Developers learn in Japanese (Zenn, Qiita).
- **Simplified Chinese** if the goal is community reach. Its learners mostly run open-source Temporal themselves.
- Korean next. Brazilian Portuguese after that. Skip European languages; their English is high.

Before deciding, check Quest's own learners by country and how far they get.

## Scope notes for the spec that follows

- Translate the prose only: the guide, UI strings, quiz questions, and the Ask Temporal persona's reply language. Code, CLI commands and Temporal API names stay in English, so checks, recorded histories and sandbox snapshots don't change.
- `lang` and `?lang=` already mean the programming language (see [multi-language 05](../../multi-language/issues/05-site-language.md)). Call this one `locale`.

## Done when

The first locale is chosen and written here, with the reason, and a `spec.md` for it is drafted.

## Sources

- [nippon.com: Japan drops into the bottom group](https://www.nippon.com/en/japan-data/h02620/)
- [EF EPI 2025 launch](https://www.ef.edu/about-us/press/articles/2025/ef-english-proficiency-index-2025-launched/)
- [TechCrunch, March 2025: Temporal's EMEA and APJ push](https://techcrunch.com/2025/03/31/temporal-lands-146-million-at-a-flat-valuation-eyes-agentic-ai-expansion)
