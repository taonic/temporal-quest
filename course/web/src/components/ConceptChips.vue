<script setup>
// A module's Temporal concepts (quests/concepts.yaml), as chips: on its steps in the guide, and
// on its card on the map. A chip opens a card under the row: the concept in a line, its docs, and
// Ask Temporal about it.
import { computed, ref } from "vue";

import { openHelper } from "../helper.js";
import { conceptsById } from "../progress.js";

const props = defineProps({
  ids: { type: Array, default: () => [] },
  // Shown before the chips ("Concepts"), for a screen reader and a sighted reader alike.
  label: { type: String, default: "Concepts" },
});

const items = computed(() => props.ids.map((id) => conceptsById.get(id)).filter(Boolean));
const open = ref(null);
const shown = computed(() => items.value.find((c) => c.id === open.value) ?? null);

function ask(c) {
  openHelper({ question: `What is ${c.name} in Temporal, and when should I use it?` });
}
</script>

<template>
  <div v-if="items.length" class="concept-chips">
    <p class="concept-row">
      <span v-if="label" class="concept-label">{{ label }}</span>
      <button
        v-for="c in items"
        :key="c.id"
        type="button"
        :class="['concept-chip', { 'is-open': open === c.id }]"
        :aria-expanded="open === c.id"
        @click="open = open === c.id ? null : c.id"
      >
        {{ c.name }}
      </button>
    </p>
    <div v-if="shown" class="concept-card" role="note">
      <p><strong>{{ shown.name }}</strong>: {{ shown.short }}</p>
      <p class="concept-card-actions">
        <a :href="shown.docs" target="_blank" rel="noopener">Read the docs ↗</a>
        <button type="button" class="concept-ask" @click="ask(shown)"><span aria-hidden="true">✦</span> Ask about it</button>
      </p>
    </div>
  </div>
</template>
