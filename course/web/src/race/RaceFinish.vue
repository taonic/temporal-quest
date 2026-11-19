<script setup>
// The finish line, for a racer, over the course like the stalls before the gun: once when they've
// done every stop (their score is final, though their place can change until the clock runs
// out), and once when the race is over (their final place). Closed, each stays closed for that
// race; the pill says it from then on.
import { computed, nextTick, ref, watch } from "vue";

import { store } from "../store.js";
import Horse from "./Horse.vue";
import { ordinal } from "./live.js";
import { closeFinish as close, field, finishMoment as moment, finishOpen, me, raceState } from "./racing.js";

const closeButton = ref(null);
watch(finishOpen, async (now) => {
  if (!now) return;
  await nextTick();
  closeButton.value?.focus();
}, { immediate: true });

const stops = computed(() => raceState.value?.course.stops.length ?? 0);
const maxXp = computed(() => raceState.value?.course.maxXp ?? 0);
const slips = computed(() => {
  const n = me.value?.stumbles ?? 0;
  return n ? `${n} ${n === 1 ? "slip" : "slips"}` : "no slips";
});
const raceHref = computed(() => `/race/${raceState.value?.race.slug ?? ""}`);
</script>

<template>
  <div v-if="finishOpen" class="race-lobby race-finish" role="dialog" aria-modal="true" aria-labelledby="race-finish-title" @keydown.escape="close">
    <div class="race-lobby-card">
      <p class="race-lobby-kicker">🏇 {{ raceState.race.name }}</p>
      <h2 id="race-finish-title">{{ moment === "home" ? "🏁 You've crossed the finish line!" : "🏁 The race is over" }}</h2>
      <div class="race-lobby-horse">
        <Horse :creature="store.race.creature" :silks="store.race.silks" :pattern="store.race.pattern" :coat="me.coat" :number="me.lane + 1" gait="idle" :label="store.race.horse" />
      </div>
      <p class="race-lobby-names"><strong>{{ store.race.horse }}</strong>, ridden by {{ store.race.name }}</p>

      <div class="race-finish-stats">
        <span><strong>{{ ordinal(me.rank) }}</strong> of {{ field }}{{ moment === "home" ? " so far" : "" }}</span>
        <span><strong>{{ me.xp }}</strong> / {{ maxXp }} XP</span>
        <span>{{ slips }}</span>
      </div>

      <template v-if="moment === 'home'">
        <p class="race-finish-lead">Every stop is done, so your race is finished and your score is final.</p>
        <p class="race-lobby-wait">Your place can still change until the clock runs out: a rider with more XP, or the same XP and fewer slips, can pass you. Watch the rest of the race, or look around the course: nothing you do now changes your score.</p>
      </template>
      <template v-else>
        <p class="race-finish-lead">{{ me.finishedAt ? "You finished every stop." : `You did ${me.completed} of ${stops} stops.` }} That's your final place.</p>
        <p class="race-lobby-wait">The podium goes up on the race screen.</p>
      </template>

      <div class="race-finish-actions">
        <a class="button button-primary" :href="raceHref" target="_blank" rel="noopener">Watch the race ↗</a>
        <button ref="closeButton" class="button button-secondary" type="button" @click="close">{{ moment === "home" ? "Look around the course" : "Close" }}</button>
      </div>
    </div>
  </div>
</template>

<style>
.race-finish-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 12px 0;
}
.race-finish-stats span {
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--success-soft);
  font-size: 15px;
}
.race-finish-stats strong {
  font-size: 18px;
  color: var(--success);
}
.race-finish-lead {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
}
.race-finish-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
}
</style>
