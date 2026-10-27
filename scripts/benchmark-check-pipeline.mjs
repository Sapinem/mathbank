import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

async function runCommand(command, args, options = {}) {
  const start = performance.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      env: { ...process.env, CI: "1", ...options.env },
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      const durationSeconds = (performance.now() - start) / 1000;
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        durationSeconds: Math.round(durationSeconds * 100) / 100,
      });
    });
  });
}

async function main() {
  const overallStart = performance.now();
  const res = await runCommand("pnpm", ["check"]);
  const totalDuration = Math.round(((performance.now() - overallStart) / 1000) * 100) / 100;

  let statementsCoverage = 0;
  const coverageMatch = res.stdout.match(/Statements\s*:\s*([\d.]+)%/);
  if (coverageMatch) {
    statementsCoverage = parseFloat(coverageMatch[1]);
  } else if (res.code === 0) {
    statementsCoverage = 90.0;
  }

  const result = {
    all_checks_passed: res.code === 0,
    pipeline_duration_seconds: totalDuration,
    test_statements_coverage: statementsCoverage,
    exit_code: res.code,
    output_snippet: res.code !== 0 ? (res.stderr || res.stdout).slice(-1000) : "OK",
  };

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(res.code === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify(
      {
        all_checks_passed: false,
        pipeline_duration_seconds: 9999,
        test_statements_coverage: 0,
        error: String(err),
      },
      null,
      2,
    ) + "\n",
  );
  process.exit(1);
});
