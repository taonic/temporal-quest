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
# The code each command runs: a command block in the guide gets a Code button that opens it.
# `from` and `to` find its lines, as a code tour's do.
commands:
  uv run hello-worker: { file: hello/worker.py, from: "async def main() -> None:" }
  uv run hello-board: { file: hello/starter.py, from: "async def board(" }
  uv run hello-hold: { file: hello/starter.py, from: "async def hold(" }
  uv run hello-pay: { file: hello/starter.py, from: "async def pay(" }
  uv run hello-itinerary: { file: hello/starter.py, from: "async def itinerary(" }
  uv run hello-book: { file: hello/starter.py, from: "async def book(" }
  uv run hello-replay: { file: hello/replay.py, from: "async def main(name" }
langs:
  # Each language's learners work in its project, langs/<language>/hello: their terminals open there.
  typescript:
    worker: npm run worker
    starter: npm run start --
    commands:
      npm run worker: { file: langs/typescript/hello/src/worker.ts, from: "async function main()", to: "await worker.run();" }
      npm run board: { file: langs/typescript/hello/src/starter.ts, from: "if (command === 'board')", to: "'BoardingWorkflow'" }
      npm run hold: { file: langs/typescript/hello/src/starter.ts, from: "if (command === 'hold')", to: "return;" }
      npm run pay: { file: langs/typescript/hello/src/starter.ts, from: "if (command === 'pay')", to: "return;" }
      npm run itinerary: { file: langs/typescript/hello/src/starter.ts, from: "if (command === 'itinerary')", to: "return;" }
      npm run book: { file: langs/typescript/hello/src/starter.ts, from: "if (command === 'book')", to: "return;" }
      npm run replay: { file: langs/typescript/hello/src/replay.ts, from: "async function main()", to: "safe to deploy" }
  # ./hello builds the Java (or C#) code when it has changed, then runs it: each command is a case
  # in Main.java (Program.cs), and those that start and talk to workflows are in Starter.
  java:
    worker: ./hello worker
    starter: ./hello start
    commands:
      ./hello worker: { file: langs/java/hello/src/main/java/hello/HelloWorker.java, from: "static void run()", to: "Hello worker ready" }
      ./hello board: { file: langs/java/hello/src/main/java/hello/Starter.java, from: 'case "board" ->', to: "new BoardingRequest(" }
      ./hello hold: { file: langs/java/hello/src/main/java/hello/Starter.java, from: 'case "hold" ->', to: "return 0;" }
      ./hello pay: { file: langs/java/hello/src/main/java/hello/Starter.java, from: "private static int pay(", to: "return 0;" }
      ./hello itinerary: { file: langs/java/hello/src/main/java/hello/Starter.java, from: 'case "itinerary" ->', to: "new Itinerary(stops)" }
      ./hello book: { file: langs/java/hello/src/main/java/hello/Starter.java, from: 'case "book" ->', to: "});" }
      ./hello replay: { file: langs/java/hello/src/main/java/hello/Replay.java, from: "static int run(String[] args)", to: "safe to deploy" }
  dotnet:
    worker: ./hello worker
    starter: ./hello start
    commands:
      ./hello worker: { file: langs/dotnet/hello/HelloWorker.cs, from: "public static async Task RunAsync()", to: "await worker.ExecuteAsync" }
      ./hello board: { file: langs/dotnet/hello/Starter.cs, from: 'case "board":', to: '"BoardingWorkflow"' }
      ./hello hold: { file: langs/dotnet/hello/Starter.cs, from: 'case "hold":', to: "return 0;" }
      ./hello pay: { file: langs/dotnet/hello/Starter.cs, from: "private static async Task<int> PayAsync", to: "return 0;" }
      ./hello itinerary: { file: langs/dotnet/hello/Starter.cs, from: 'case "itinerary":', to: '"ItineraryWorkflow"' }
      ./hello book: { file: langs/dotnet/hello/Starter.cs, from: 'case "book":', to: "});" }
      ./hello replay: { file: langs/dotnet/hello/Replay.cs, from: "public static async Task<int> RunAsync", to: "safe to deploy" }
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
