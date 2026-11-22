// The language a Developer learner builds in: Python, TypeScript, Java or C# (course.languages,
// those with at least one whole tier), and the course as that language has it.
//
// A module is one module whatever the language (docs/adr/0001-one-module-several-languages.md):
// an exercise comes in some languages, the first its default, with what differs in each other one
// in `byLang` (its files, tour, guide, challenges, worker and starter commands). exerciseIn picks
// the learner's; an exercise that doesn't come in it is shown in its default (Python), tagged so.
//
// Where the language comes from, first to last: ?lang= in the URL, what the learner chose (kept in
// this browser, and on the server as a language_set event), their cohort's, else Python. With
// only Python on offer, the site never asks. Switching reloads the page, as a persona does.
import { storageKey } from "./forget.js";

const KEY = storageKey("language");
export const DEFAULT_LANGUAGE = "python";

// An exercise as `language` has it: that language's version where it has one, and `language`,
// the one it's in.
export function exerciseIn(exercise, language) {
  const languages = exercise.languages ?? [DEFAULT_LANGUAGE];
  const lang = languages.includes(language) ? language : languages[0];
  const variant = lang === languages[0] ? {} : (exercise.byLang?.[lang] ?? {});
  return { ...exercise, ...variant, language: lang };
}

// The course as `language` has it: each exercise in it, and Polyglot only once there's a choice.
export function courseIn(course, language) {
  const choice = (course.languages?.length ?? 1) > 1;
  return {
    ...course,
    language,
    exercises: course.exercises.map((ex) => exerciseIn(ex, language)),
    badges: (course.badges ?? []).filter((b) => b.rule !== "polyglot" || choice),
  };
}

// The language a learner who builds in `language` does a module in.
export function moduleLanguage(module, language) {
  const languages = module?.languages ?? [DEFAULT_LANGUAGE];
  return languages.includes(language) ? language : languages[0];
}

export function languageLabel(course, id) {
  return (course.languages ?? []).find((l) => l.id === id)?.label ?? { python: "Python" }[id] ?? id;
}

function stored() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

// { id, chosen, fromUrl }: the language to show, whether it was chosen (or set) rather than
// defaulted, and whether the URL set it. A ?lang= that names one on offer is kept, as if chosen.
export function readLanguage(full, search = window.location.search) {
  const ids = (full.languages ?? []).map((l) => l.id);
  const fromUrl = new URLSearchParams(search).get("lang");
  if (ids.includes(fromUrl)) {
    keepLanguage(fromUrl);
    return { id: fromUrl, chosen: true, fromUrl: true };
  }
  const saved = stored();
  if (ids.includes(saved)) return { id: saved, chosen: true, fromUrl: false };
  return { id: DEFAULT_LANGUAGE, chosen: false, fromUrl: false };
}

export function keepLanguage(id) {
  try {
    localStorage.setItem(KEY, JSON.stringify(id));
  } catch {
    /* storage unavailable: it's chosen for this page only */
  }
}
