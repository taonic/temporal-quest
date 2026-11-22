<script setup>
// A language's icon: a monogram tile in its colour (not its logo, and never an emoji).
import { computed } from "vue";

const props = defineProps({
  id: { type: String, required: true },
  size: { type: Number, default: 36 },
});

const TILES = {
  python: { text: "Py", bg: "#3776ab", fg: "#ffd43b" },
  typescript: { text: "TS", bg: "#3178c6", fg: "#ffffff" },
  java: { text: "J", bg: "#e76f00", fg: "#ffffff" },
  dotnet: { text: "C#", bg: "#512bd4", fg: "#ffffff" },
};
const tile = computed(() => TILES[props.id] ?? { text: props.id.slice(0, 2).toUpperCase(), bg: "#6b7280", fg: "#ffffff" });
</script>

<template>
  <svg class="language-icon" :width="size" :height="size" viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="9" :fill="tile.bg" />
    <text x="35" y="33" text-anchor="end" :fill="tile.fg" font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="800" letter-spacing="-0.5">{{ tile.text }}</text>
  </svg>
</template>
