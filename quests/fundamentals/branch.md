---
id: fundamentals
name: Fundamentals
icon: 🌱
badgeIcon: sprout
color: green
order: 1
classTitle: Durable Apprentice
worker: uv run hello-worker
starter: uv run hello-start
languages: [python, typescript, java, dotnet]
langs:
  # Each language's learners work in its project, langs/<language>/hello: their terminals open there.
  typescript: { worker: npm run worker, starter: npm run start -- }
  # ./hello builds the Java (or C#) code when it has changed, then runs it.
  java: { worker: ./hello worker, starter: ./hello start }
  dotnet: { worker: ./hello worker, starter: ./hello start }
agentUi: false
maxWords: 150
tiers:
  - name: Durable execution
    badge:
      name: Survived the Crash
  - name: Building blocks
    badge:
      name: Blocksmith
---

The trunk every other branch grows from: workflows, activities, workers and the history that ties them together. What Temporal does when code breaks, a process dies, or nothing is running at all.
