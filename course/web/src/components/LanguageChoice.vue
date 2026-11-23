<script setup>
// The question after the Developer persona, once the course offers more than Python: which
// language do you build in? One card per language on offer (course.languages). Picking one keeps
// it (and, for another language than the page's, loads the page again). It can be changed later
// from the account menu.
import { nextTick, onMounted, ref } from "vue";

import LanguageIcon from "./LanguageIcon.vue";
import { chooseLanguage } from "../progress.js";
import { course, store } from "../store.js";

const props = defineProps({
  // Opened to switch (not the first time): it can be closed without choosing.
  switching: { type: Boolean, default: false },
});
const emit = defineEmits(["close"]);
const first = ref(null);

const current = (id) => store.language.chosen && store.language.id === id;

function pick(id) {
  chooseLanguage(id);
  emit("close");
}

function onKey(event) {
  if (event.key === "Escape" && props.switching) emit("close");
}

onMounted(() => nextTick(() => first.value?.focus({ preventScroll: true })));
</script>

<template>
  <div class="persona-backdrop" @keydown="onKey" @click.self="switching && emit('close')">
    <section class="persona-choice" role="dialog" aria-modal="true" aria-labelledby="language-title">
      <p class="eyebrow">Temporal Quest</p>
      <h2 id="language-title">{{ switching ? "Switch your language" : "Which language do you build in?" }}</h2>
      <div class="persona-cards">
        <button
          v-for="(l, i) in course.languages"
          :key="l.id"
          :ref="(el) => i === 0 && (first = el)"
          type="button"
          :class="['persona-card', { 'is-current': current(l.id) }]"
          :aria-current="current(l.id) ? 'true' : undefined"
          @click="pick(l.id)"
        >
          <span class="persona-icon"><LanguageIcon :id="l.id" :size="40" /></span>
          <span class="persona-label">{{ l.label }}</span>
          <span class="persona-go">{{ current(l.id) ? "Your current choice" : "Choose →" }}</span>
        </button>
      </div>
      <button v-if="switching" class="button persona-cancel" type="button" @click="emit('close')">Keep it as it is</button>
    </section>
  </div>
</template>
