"""The workshop's content, as the scripts see it: modules, branches and paths, read from quests/.

    quests/<branch>/branch.md               a branch: its name, icon, tiers, worker
    quests/<branch>/<NN-slug>/module.md     a module: its id, what it requires, its check
    quests/paths/<path>.yaml                a path: an ordered run of modules (a live event)

The course site reads the same files (course/content/build.mjs), and checks them more closely.

A branch comes in each of its `languages` (Python when it lists none), the first its default: a
module's frontmatter is that language's, and its `langs:` gives what differs in each other one.
Code for a language other than Python lives under langs/<language>/ (its masters under
authoring/langs/<language>/). docs/adr/0001-one-module-several-languages.md
"""

import re
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
QUESTS = ROOT / "quests"
LANGUAGES = ("python", "typescript", "java", "dotnet")


def language_of(path: Path, base: Path = ROOT) -> str:
    """The language a file of code is in: langs/<language>/… is that language's, anything else Python's."""
    parts = path.relative_to(base).parts
    return parts[1] if len(parts) > 2 and parts[0] == "langs" else "python"


@dataclass(frozen=True)
class Module:
    id: str
    branch: str
    dir: Path
    title: str
    requires: tuple[str, ...]
    status: str = "ready"
    check: dict = field(default_factory=dict, hash=False, compare=False)
    savepoint: dict = field(default_factory=dict, hash=False, compare=False)
    worker: str | None = None
    languages: tuple[str, ...] = ("python",)
    langs: dict = field(default_factory=dict, hash=False, compare=False)
    branch_langs: dict = field(default_factory=dict, hash=False, compare=False)

    @property
    def ready(self) -> bool:
        return self.status != "coming-soon"

    def language(self, wanted: str) -> str:
        """The language a learner who builds in ``wanted`` does this module in: that one, if its
        branch has it, and otherwise its branch's first."""
        return wanted if wanted in self.languages else self.languages[0]

    def worker_in(self, language: str) -> str | None:
        """Its worker command in one of its languages."""
        if language == self.languages[0]:
            return self.worker
        return (self.langs.get(language) or {}).get("worker") or (self.branch_langs.get(language) or {}).get("worker")

    def hint_in(self, language: str) -> str:
        """Its check's hint in one of its languages."""
        given = (self.langs.get(language) or {}).get("hint") if language != self.languages[0] else None
        return given or self.check.get("hint", "Not there yet.")


@dataclass(frozen=True)
class Exercise:
    """A run of a path's modules that the site shows as one exercise, until it shows the map."""

    id: str
    title: str
    modules: tuple[str, ...]


def frontmatter(path: Path) -> dict:
    match = re.match(r"^---\n(.*?)\n---\n", path.read_text(), re.S)
    return (yaml.safe_load(match[1]) if match else None) or {}


@cache
def branches() -> dict[str, dict]:
    found = {}
    for path in sorted(QUESTS.glob("*/branch.md")):
        meta = frontmatter(path)
        meta.setdefault("languages", ["python"])
        for language in meta["languages"]:
            if language not in LANGUAGES:
                raise ValueError(f"{path}: language {language} isn't one of {', '.join(LANGUAGES)}")
        found[path.parent.name] = meta
    return dict(sorted(found.items(), key=lambda kv: kv[1].get("order", 99)))


@cache
def modules() -> dict[str, Module]:
    """Every module, by id: branch by branch, in each branch's folder order."""
    found: dict[str, Module] = {}
    for branch, meta in branches().items():
        for path in sorted((QUESTS / branch).glob("*/module.md")):
            m = frontmatter(path)
            module = Module(
                id=m["id"],
                branch=branch,
                dir=path.parent,
                title=m["title"],
                requires=tuple(m.get("requires") or ()),
                status=m.get("status", "ready"),
                check=m.get("check") or {"kind": "pending"},
                savepoint=m.get("savepoint") or {},
                worker=m.get("worker", meta.get("worker")),
                # Its own languages narrow its branch's: a module a language doesn't have yet.
                languages=tuple(m.get("languages") or meta["languages"]),
                langs=m.get("langs") or {},
                branch_langs=meta.get("langs") or {},
            )
            if module.id in found:
                raise ValueError(f"{path}: module id {module.id} is also {found[module.id].dir}")
            found[module.id] = module
    for module in found.values():
        for req in module.requires:
            if req not in found:
                raise ValueError(f"{module.dir}/module.md: requires {req}, which isn't a module")
    return found


@cache
def exercises() -> dict[str, Exercise]:
    """The exercises the paths group their modules into, by id."""
    found = {}
    for path in sorted((QUESTS / "paths").glob("*.yaml")):
        for ex in yaml.safe_load(path.read_text()).get("exercises", []):
            found[ex["id"]] = Exercise(id=ex["id"], title=ex["title"], modules=tuple(ex["modules"]))
    return found


def closure(ids) -> list[str]:
    """Every module the given ones build on, directly or not, in module order (not the given
    ones themselves, unless one builds on another)."""
    all_modules = modules()
    seen: set[str] = set()
    stack = [req for id_ in ids for req in all_modules[id_].requires]
    while stack:
        id_ = stack.pop()
        if id_ not in seen:
            seen.add(id_)
            stack.extend(all_modules[id_].requires)
    return [id_ for id_ in all_modules if id_ in seen]


def resolve(target: str) -> tuple[list[Module], Exercise | None]:
    """A module id (A4) or an exercise id (02-durable-session): its modules, and the exercise."""
    if target in exercises():
        ex = exercises()[target]
        return [modules()[id_] for id_ in ex.modules], ex
    if target in modules():
        module = modules()[target]
        return [module], next((ex for ex in exercises().values() if module.id in ex.modules), None)
    raise KeyError(target)
