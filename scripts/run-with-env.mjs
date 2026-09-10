import { spawn } from "node:child_process";

const [, , nodeEnv, command, ...args] = process.argv;

if (!nodeEnv || !command) {
  console.error("Usage: node scripts/run-with-env.mjs <NODE_ENV> <command> [...args]");
  process.exit(1);
}

const executable = process.platform === "win32" && command !== "node" && !command.includes(".")
  ? `${command}.cmd`
  : command;
const child = spawn(executable, args, {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: nodeEnv },
});

child.on("error", (error) => {
  console.error(`Unable to start ${command}:`, error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
