import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const command = cleanText(process.argv[2] || "status").toLowerCase();
const tasks = [
  { name: "GYO6-Policy-Quality-Sources", time: "00:40", phase: "sources" },
  { name: "GYO6-Policy-Quality-Simulate", time: "02:40", phase: "simulate" },
  { name: "GYO6-Policy-Quality-Evaluate", time: "04:40", phase: "evaluate" }
];

let result;
if (command === "install") {
  result = await installTasks();
} else if (command === "uninstall" || command === "delete") {
  result = await uninstallTasks();
} else if (command === "status" || !command) {
  result = await getStatus();
} else if (command === "run-now") {
  result = await runNow(process.argv[3] || "all");
} else {
  result = { ok: false, error: `unknown_command:${command}`, commands: ["status", "install", "uninstall", "run-now"] };
}

printJson(result);
process.exitCode = result.ok ? 0 : 1;

async function installTasks() {
  const results = [];
  for (const task of tasks) {
    const taskRun = buildTaskRun(task.phase);
    const install = await runCommand("schtasks.exe", [
      "/Create",
      "/TN",
      task.name,
      "/SC",
      "DAILY",
      "/ST",
      task.time,
      "/TR",
      taskRun,
      "/F"
    ], 20000);
    const fallback = install.code === 0 ? null : await installTaskWithPowerShell(task);
    results.push({
      ...task,
      taskRun,
      ok: install.code === 0 || Boolean(fallback?.ok),
      method: install.code === 0 ? "schtasks" : fallback?.method || "failed",
      stdout: install.stdout,
      stderr: install.stderr,
      error: install.error,
      fallback
    });
  }

  return {
    ok: results.every((item) => item.ok),
    timezone: "Asia/Seoul / Windows local time",
    schedule: tasks.map(({ name, time, phase }) => ({ name, time, phase })),
    results
  };
}

async function uninstallTasks() {
  const results = [];
  for (const task of tasks) {
    const deleted = await runCommand("schtasks.exe", ["/Delete", "/TN", task.name, "/F"], 20000);
    const missingOk = /cannot find|지정된 파일을 찾을 수 없습니다|시스템이 지정된 파일을 찾을 수 없습니다/i.test(`${deleted.stdout}\n${deleted.stderr}\n${deleted.error}`);
    results.push({
      ...task,
      ok: deleted.code === 0 || missingOk,
      stdout: deleted.stdout,
      stderr: deleted.stderr,
      error: deleted.error
    });
  }
  return { ok: results.every((item) => item.ok), results };
}

async function getStatus() {
  const results = [];
  for (const task of tasks) {
    const status = await runCommand("schtasks.exe", ["/Query", "/TN", task.name, "/FO", "LIST", "/V"], 20000);
    results.push({
      ...task,
      installed: status.code === 0,
      stdout: status.stdout,
      stderr: status.stderr,
      error: status.error
    });
  }
  return {
    ok: true,
    installed: results.filter((item) => item.installed).length,
    expected: tasks.length,
    timezone: "Asia/Seoul / Windows local time",
    results
  };
}

async function runNow(phase) {
  const run = await runCommand("cmd.exe", ["/d", "/c", path.join(rootDir, "tools", "run-policy-quality-nightly.cmd"), phase], 180000);
  return {
    ok: run.code === 0,
    phase,
    stdout: run.stdout,
    stderr: run.stderr,
    error: run.error
  };
}

function buildTaskRun(phase) {
  const launcher = path.join(rootDir, "tools", "run-policy-quality-nightly.cmd");
  return `"${launcher}" ${phase}`;
}

async function installTaskWithPowerShell(task) {
  const launcher = path.join(rootDir, "tools", "run-policy-quality-nightly.cmd");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$action = New-ScheduledTaskAction -Execute '${escapePowerShellSingleQuoted(launcher)}' -Argument '${escapePowerShellSingleQuoted(task.phase)}' -WorkingDirectory '${escapePowerShellSingleQuoted(rootDir)}'`,
    `$trigger = New-ScheduledTaskTrigger -Daily -At '${escapePowerShellSingleQuoted(task.time)}'`,
    `$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries`,
    `Register-ScheduledTask -TaskName '${escapePowerShellSingleQuoted(task.name)}' -Action $action -Trigger $trigger -Settings $settings -Description 'GYO6 law policy quality loop (${escapePowerShellSingleQuoted(task.phase)})' -Force | Out-Null`,
    "Write-Output 'registered'"
  ].join("; ");
  const result = await runCommand("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script
  ], 30000);
  return {
    ok: result.code === 0,
    method: "powershell-scheduled-task",
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error
  };
}

function escapePowerShellSingleQuoted(value) {
  return String(value || "").replace(/'/g, "''");
}

function runCommand(file, args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    execFile(file, args, { cwd: rootDir, windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
      resolve({
        code: Number(error?.code || 0),
        stdout: cleanText(stdout).slice(-4000),
        stderr: cleanText(stderr).slice(-4000),
        error: error ? cleanText(error.message).slice(0, 1000) : ""
      });
    });
  });
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
