// What each load-test racer will do, and so what the race should score them: how many wrong
// picks each question gets before the right one, and how many boss stories it gets wrong (fewer
// than its hearts, so it wins). Seeded by the run's seed and the racer's number, so a racer is
// the same from run to run and the report can check the standings against it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { QUESTION_XP, quizXp } from "../../web/src/race/rules.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const COURSE_DATA = path.resolve(here, "../../web/src/generated/course-data.json");

// The course as built (npm run content in course/): the questions' right answers, in the race's
// order. Built from the same commit that's deployed, so it says what the site shows.
export function loadCourse() {
  if (!fs.existsSync(COURSE_DATA)) throw new Error(`No ${COURSE_DATA}: run npm run content in course/ first.`);
  const data = JSON.parse(fs.readFileSync(COURSE_DATA, "utf8"));
  const exercise = data.exercises.find((e) => e.id === "07-essentials");
  const path_ = data.paths.find((p) => p.id === "essentials");
  const boss = data.modules.find((m) => m.id === "E-boss");
  const questions = path_.modules.map((id) => {
    const choices = id.startsWith("EC") ? exercise.challenges[id].choices : exercise.checks[id].quiz.choices;
    return { id, choices: choices.length, right: choices.findIndex((c) => c.right) };
  });
  // Essentials' pages name modules and challenges by title, not id.
  const titles = Object.fromEntries([
    ...Object.entries(exercise.challenges).map(([id, c]) => [c.title, id]),
    ...data.modules.filter((m) => m.branch === "essentials").map((m) => [m.title, m.id]),
  ]);
  return { questions, titles, boss: { xp: boss.xp, pool: boss.pool, hearts: 3 } };
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Racer n's plan: { misses: { E1: 0, EC1: 2, … }, bossMisses, expected: { xp, stumbles } }.
// Most questions right first time, some on the second, a few on the third: like a room.
export function planFor(n, seed, course = loadCourse()) {
  const random = rng(seed * 1009 + n);
  const misses = {};
  for (const q of course.questions) {
    const r = random();
    misses[q.id] = Math.min(q.choices - 1, r < 0.6 ? 0 : r < 0.9 ? 1 : 2);
  }
  const bossMisses = Math.floor(random() * course.boss.hearts); // 0 to 2: it still wins
  return { n, misses, bossMisses, expected: expectedScore(misses, course) };
}

// What the race should say: each question's XP by the try it was right on, the boss's in full
// (it's won), and a slip for every wrong pick (a boss's wrong answers aren't slips when it's won).
export function expectedScore(misses, course) {
  let xp = course.boss.xp;
  let stumbles = 0;
  for (const q of course.questions) {
    const picks = [...Array(misses[q.id]).keys()].map((i) => `wrong${i}`).concat("right");
    xp += quizXp(QUESTION_XP, picks, "right");
    stumbles += misses[q.id];
  }
  return { xp, stumbles, completed: course.questions.length + 1 };
}
