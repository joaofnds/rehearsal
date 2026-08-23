import { $ } from "bun";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const TARGET_DIR = "/Users/joaofnds/code/nest/template";
const rl = readline.createInterface({ input, output });

console.log("🚀 STARTING COMPLETELY AUTONOMOUS BENCHMARK SIMULATION...");

const status = await $`cd ${TARGET_DIR} && git status --porcelain`.text();
if (status.trim() !== "") {
  console.error("⚠️ Main is dirty. Commit or stash before running the benchmark.");
  process.exit(1);
}

console.log("\n📄 Injecting Task into Backlog and loading instructions...");
const taskSeed = await Bun.file("backlog-seed.md").text();
const currentBacklogFile = Bun.file(`${TARGET_DIR}/backlog.md`);
let currentBacklog = "";
if (await currentBacklogFile.exists()) {
  currentBacklog = await currentBacklogFile.text();
}
await Bun.write(`${TARGET_DIR}/backlog.md`, taskSeed + "\n" + currentBacklog);
await $`cp CLAUDE.md ${TARGET_DIR}/CLAUDE.md`;

console.log("\n🗣️  PHASE 1: Agent Discuss Session");
const discussPrompt =
  "Read the top task in backlog.md. Assume we are in the Discuss phase of our workflow. Output your exact architectural questions, design considerations, and any clarifying questions you have before writing code. Make sure to exit the session immediately after outputting your questions.";
let extract;
try {
  extract = await $`cd ${TARGET_DIR} && claude -p ${discussPrompt}`.text();
} catch (e) {
  extract = e.stdout?.toString() || "No questions extracted.";
}
console.log("Agent's Questions:\n", extract);

console.log("\n👔 PHASE 2: Product Owner Intercept");
const poPersona = await Bun.file("po-persona.md").text();
const poPrompt = `You are the strict Product Owner. Adhere exactly to this persona:\n\n${poPersona}\n\nThe engineering agent has asked the following questions about the backlog task:\n\n${extract}\n\nAnswer them concisely, uniformly, and assertively so the engineer can start building.`;

const poAnswers = await $`claude -p ${poPrompt}`.text();
console.log("PO Answers:\n", poAnswers);

console.log("\n🏗️  PHASE 3: Agent Build Session");
const buildPrompt = `We are now in the Build Phase. Here are the answers from the Product Owner to your previous questions:\n\n${poAnswers}\n\nExecute the top task in backlog.md from start to finish. Adhere strictly to CLAUDE.md. Write tests. Run local checks (bun run test:unit, bun run check). Fix any errors. When all tests pass, commit directly to main with a standard commit message. Do NOT ask for permission to commit. Exit the session when the commit is done.`;
await $`cd ${TARGET_DIR} && claude -p ${buildPrompt}`;

console.log("\n🧪 PHASE 4: Local Sanity Checks");
try {
  await $`cd ${TARGET_DIR} && bun run typecheck && bun run check && bun run test:unit`;
  console.log("✅ Code compiles, lints, and tests pass.");
} catch (e) {
  console.error("❌ Agent broke the build or tests.");
}

console.log("\n⚖️  PHASE 5: The Judge Engine");
const diff = await $`cd ${TARGET_DIR} && git show HEAD`.text();
const rubric = await Bun.file("rubric.md").text();
const judgePrompt = `You are a Principal Engineer grading a pull request (diff). \n\nRUBRIC:\n${rubric}\n\nDIFF TO GRADE:\n${diff}\n\nAssess the diff against every item in the rubric. Did the agent pass or fail? Provide a ruthless, bulleted critique, ending with a final verdict of PASS or FAIL.`;

const grade = await $`claude -p ${judgePrompt}`.text();
console.log("\n================ JUDGE VERDICT ================\n");
console.log(grade);
console.log("\n===============================================\n");

const madeMistakes = await rl.question(
  "🤔 Did the agent FAIL or miss something? Update CLAUDE.md? (y/n) ",
);
if (madeMistakes.toLowerCase() === "y") {
  const editor = process.env.EDITOR || "code";
  try {
    await $`${editor} --wait CLAUDE.md`;
    console.log("✅ Instructions updated.");
  } catch (e) {
    console.log("⚠️ Could not open editor automatically, edit CLAUDE.md manually.");
  }
}

const readyCleanup = await rl.question("🧹 Rollback the commit and restore backlog.md? (y/n) ");
if (readyCleanup.toLowerCase() === "y") {
  const hasUncommitted = await $`cd ${TARGET_DIR} && git status --porcelain`.text();
  if (hasUncommitted.trim() !== "") {
    await $`cd ${TARGET_DIR} && git clean -fd && git checkout -- .`;
  }
  await $`cd ${TARGET_DIR} && git reset --hard HEAD~1`;
  await $`cd ${TARGET_DIR} && git checkout -- backlog.md`;
  await $`cd ${TARGET_DIR} && rm -f CLAUDE.md`;
  console.log("✅ Repository restored.");
}

process.exit(0);
