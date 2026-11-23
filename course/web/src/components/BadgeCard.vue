<script setup>
// One badge on the shelf (BadgesPage): its medal, what it is, and what earns it, or when it was
// earned. An earned tier badge whose tier has grown since says so, and keeps it. One whose modules
// are all done but a code check hasn't passed says which check is left.
import { computed } from "vue";

import BadgeMedal from "./BadgeMedal.vue";
import { badgeComingSoon, badgeMissing, badgeUnchecked, isEarned, progress } from "../progress.js";

const props = defineProps({
  badge: { type: Object, required: true },
  size: { type: Number, default: 80 },
});

const date = (at) => (at ? new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");
const note = computed(() => {
  const badge = props.badge;
  if (isEarned(badge.id)) {
    const grown = badgeMissing(badge).length;
    return { earned: true, when: date(progress.badges[badge.id]), grown: grown ? `+${grown} new module${grown === 1 ? "" : "s"}` : "" };
  }
  const unchecked = badgeMissing(badge).length ? [] : badgeUnchecked(badge);
  return { earned: false, soon: badgeComingSoon(badge), unchecked: unchecked.length ? `Pass the check of ${unchecked.join(", ")}` : "" };
});
const kicker = computed(() => {
  const badge = props.badge;
  return badge.kind === "tier" ? `Tier ${badge.numeral} · ${badge.tierName}` : badge.kind === "boss" ? "Class title" : "";
});
</script>

<template>
  <li class="badge-card" :class="{ 'is-locked': !note.earned }" :style="{ width: `${size + 36}px` }" :data-badge="badge.id" :data-earned="note.earned || null">
    <BadgeMedal :badge="badge" :earned="note.earned" :size="size" />
    <p v-if="kicker" class="badge-card-kicker">{{ kicker }}</p>
    <h3 class="badge-card-name">{{ badge.name }}</h3>
    <p class="badge-card-criteria">{{ badge.criteria }}</p>
    <p v-if="note.earned" class="badge-card-when">Earned {{ note.when }}</p>
    <p v-else-if="note.soon" class="badge-card-soon">Coming soon</p>
    <p v-else-if="note.unchecked" class="badge-card-unchecked" title="Run ./quest check in your sandbox (the ✓ Check button)">{{ note.unchecked }}</p>
    <p v-if="note.grown" class="badge-card-grown" :title="`Still yours. The tier has ${note.grown.slice(1)} since you earned it.`">{{ note.grown }}</p>
  </li>
</template>
