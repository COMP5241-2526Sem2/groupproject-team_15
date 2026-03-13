import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function isMusl() {
  if (process.platform !== "linux") {
    return false;
  }

  const report = process.report?.getReport?.();
  if (report?.header?.glibcVersionRuntime) {
    return false;
  }

  return Array.isArray(report?.sharedObjects)
    ? report.sharedObjects.some((entry) => entry.includes("musl"))
    : false;
}

function getTargetPackageName() {
  if (process.platform !== "linux") {
    return null;
  }

  if (process.arch === "x64") {
    return isMusl()
      ? "@tailwindcss/oxide-linux-x64-musl"
      : "@tailwindcss/oxide-linux-x64-gnu";
  }

  if (process.arch === "arm64") {
    return isMusl()
      ? "@tailwindcss/oxide-linux-arm64-musl"
      : "@tailwindcss/oxide-linux-arm64-gnu";
  }

  return null;
}

function getOxideVersion() {
  try {
    return require("@tailwindcss/oxide/package.json").version;
  } catch {
    return null;
  }
}

const targetPackageName = getTargetPackageName();
if (!targetPackageName || process.env.SKIP_TAILWIND_OXIDE_ENSURE === "1") {
  process.exit(0);
}

try {
  require.resolve(targetPackageName);
  console.log(`[tailwind-oxide] ${targetPackageName} already installed`);
  process.exit(0);
} catch {
  // Continue to self-heal below.
}

const oxideVersion = getOxideVersion();
if (!oxideVersion) {
  console.warn("[tailwind-oxide] Unable to detect @tailwindcss/oxide version; skipping self-heal");
  process.exit(0);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const installTarget = `${targetPackageName}@${oxideVersion}`;

console.log(`[tailwind-oxide] Installing missing native package ${installTarget}`);

const install = spawnSync(
  npmCommand,
  ["install", "--no-save", "--ignore-scripts", installTarget],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SKIP_TAILWIND_OXIDE_ENSURE: "1",
    },
  },
);

if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const installed = (() => {
  try {
    return require.resolve(targetPackageName);
  } catch {
    return null;
  }
})();

if (!installed || !existsSync(installed)) {
  console.error(`[tailwind-oxide] ${targetPackageName} is still missing after self-heal`);
  process.exit(1);
}

console.log(`[tailwind-oxide] Installed ${targetPackageName}`);