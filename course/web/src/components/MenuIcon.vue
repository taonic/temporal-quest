<script setup>
// A menu item's icon: a line drawing in the style of the top bar's (20×20, a 1.8 stroke in the
// text's colour), never an emoji.
defineProps({ name: { type: String, required: true } });

const PATHS = {
  // A route between two points: the page tour.
  tour: '<circle cx="5" cy="5" r="2"/><circle cx="15" cy="15" r="2"/><path d="M7 5h5a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h5"/>',
  // A person: who you learn as.
  persona: '<circle cx="10" cy="7" r="3.2"/><path d="M4 17c.8-3.2 3.2-5 6-5s5.2 1.8 6 5"/>',
  // Code brackets: the language you build in.
  language: '<path d="M7 6l-4 4 4 4M13 6l4 4-4 4M11 4l-2 12"/>',
  // A speech bubble, as the top bar's Feedback.
  feedback: '<path d="M4 4h12v9H9l-4 3v-3H4z"/>',
  // The sun and the moon: light mode and dark mode.
  sun: '<circle cx="10" cy="10" r="3.2"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
  moon: '<path d="M15.5 12.5A6 6 0 0 1 7.5 4.5a6 6 0 1 0 8 8z"/>',
  // A shield: the admin panel.
  admin: '<path d="M10 3l6 2.5v4c0 4-2.6 6.6-6 7.5-3.4-.9-6-3.5-6-7.5v-4z"/>',
  // A flag: the race.
  race: '<path d="M5 17V3.5M5 4h9l-2 3 2 3H5"/>',
  // Out of a door: sign out.
  signout: '<path d="M8 4H4v12h4M12 6l4 4-4 4M16 10H8"/>',
};
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <svg class="menu-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="PATHS[name]" />
</template>
