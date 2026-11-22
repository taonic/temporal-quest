<script setup>
// The badge shelf (#/badges): the branches' badges (each branch's tier badges, then its boss
// badge, the class title) beside the skill badges (how you learn, and milestones), so both start
// at the top of a wide screen; a narrow one stacks them, with a jump to each. Unearned badges show
// greyed, with what earns them: there are no secret ones. It closes (× or Esc) back to the page it
// was opened from, or the map.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import BadgeCard from "../components/BadgeCard.vue";
import { iconSvg } from "../badgeArt.js";
import { badges, earnedCount, isEarned } from "../progress.js";
import { cameFrom, course, navigate } from "../store.js";

const rows = computed(() =>
  course.branches
    .map((branch) => ({
      key: branch.id,
      name: branch.name,
      icon: iconSvg(branch.badgeIcon, 18, branch.color),
      tiers: badges.filter((b) => b.branch === branch.id && b.kind === "tier"),
      boss: badges.find((b) => b.branch === branch.id && b.kind === "boss") ?? null,
    }))
    .filter((row) => row.tiers.length || row.boss),
);
const branchBadges = computed(() => rows.value.flatMap((row) => [...row.tiers, ...(row.boss ? [row.boss] : [])]));

// Skill badges: those for how you learn (a rule across the course), and milestones (a module or
// a few of them passed).
const skills = computed(() => badges.filter((b) => b.kind === "skill"));
const skillGroups = computed(() =>
  [
    { key: "how", name: "How you learn", badges: skills.value.filter((b) => b.rule !== "pass") },
    { key: "milestones", name: "Milestones", badges: skills.value.filter((b) => b.rule === "pass") },
  ].filter((group) => group.badges.length),
);

const earnedOf = (list) => list.filter((b) => isEarned(b.id)).length;
const sections = computed(() => [
  { key: "branches", name: "Tiers and class titles", list: branchBadges.value },
  { key: "skills", name: "Skills", list: skills.value },
]);
const branchesEl = ref(null);
const skillsEl = ref(null);
function jump(key) {
  (key === "skills" ? skillsEl : branchesEl).value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function close() {
  const from = cameFrom();
  navigate(from && !from.startsWith("#/badges") ? from : "#/");
}
// Esc closes the shelf, unless something is open over it (the earn moment, a dialog).
const onKey = (event) => event.key === "Escape" && !document.querySelector(".earn-backdrop, .modal-backdrop") && close();
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <main class="badges-page">
    <header class="badges-head">
      <button class="badges-close" type="button" aria-label="Close your badges" title="Close (Esc)" @click="close">×</button>
      <p class="panel-kicker">Your badges</p>
      <h1>{{ earnedCount }} of {{ badges.length }} earned</h1>
      <p class="badges-lede">A badge for every tier you finish and every boss you beat, which is your class title, and a few for how you learn. Badges you haven't earned yet say what earns them.</p>
      <nav class="badges-jump" aria-label="Badge sections">
        <button v-for="s in sections" :key="s.key" type="button" class="badges-jump-link" @click="jump(s.key)">
          {{ s.name }} <span class="badges-jump-count">{{ earnedOf(s.list) }} of {{ s.list.length }}</span>
        </button>
      </nav>
    </header>
    <div class="badges-layout">
      <section ref="branchesEl" class="badges-shelf" aria-labelledby="badges-branches-title">
        <h2 id="badges-branches-title" class="badges-section-title">
          Tiers and class titles <span class="badges-jump-count">{{ earnedOf(branchBadges) }} of {{ branchBadges.length }}</span>
        </h2>
        <div v-for="row in rows" :key="row.key" class="badges-row">
          <h3 class="badges-row-label"><span v-html="row.icon" />{{ row.name }}</h3>
          <ul class="badges-row-items">
            <template v-for="badge in [...row.tiers, ...(row.boss ? [row.boss] : [])]" :key="badge.id">
              <li v-if="badge.kind === 'boss' && row.tiers.length" class="badges-divider" aria-hidden="true" />
              <BadgeCard :badge="badge" :size="72" />
            </template>
          </ul>
        </div>
      </section>
      <section ref="skillsEl" class="badges-shelf badges-skills" aria-labelledby="badges-skills-title">
        <h2 id="badges-skills-title" class="badges-section-title">
          Skills <span class="badges-jump-count">{{ earnedOf(skills) }} of {{ skills.length }}</span>
        </h2>
        <div v-for="group in skillGroups" :key="group.key" class="badges-row">
          <h3 class="badges-row-label">{{ group.name }}</h3>
          <ul class="badges-row-items">
            <BadgeCard v-for="badge in group.badges" :key="badge.id" :badge="badge" :size="64" />
          </ul>
        </div>
      </section>
    </div>
  </main>
</template>
