import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

import { getProjectAbsolutePath } from "../workspace";

// Function that executes a shell command in the specified directory
export const runCommandFunc = async ({ command, cwd, }: { command: string; cwd?: string; }) => {
  return new Promise((resolve, reject) => {
    try {

        console.log(`Run command Tool Has been called: ${command}`);

      console.log(`[runCommand] Received command: ${cwd}`);

      console.log(`[runCommand] Command: ${command}`);

    //   const resolvedCwd = cwd ? path.resolve(cwd) : process.cwd();
    const resolvedCwd = getProjectAbsolutePath();

      // Ensure the directory exists
      if (!fs.existsSync(resolvedCwd)) {
        return reject(new Error(`Directory not found: ${resolvedCwd}`));
      }
      console.log(`[runCommand] Executing: ${command} in ${resolvedCwd}`);

      // Spawn the command using shell
      const cmdProcess = spawn(command, {
        cwd: resolvedCwd,
        shell: true,
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      cmdProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      cmdProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      cmdProcess.on("close", (code) => {
        resolve({
          status: code === 0 ? "success" : "error",
          exitCode: code,
          output: stdout.trim(),
          errorOutput: stderr.trim(),
        });
      });
    } catch (err) {
      reject(err);
    }
  });
};

// ✅ Schema definition
const runCommandSchema = z.object({
  command: z
    .string()
    .min(1, "Command must not be empty")
    .describe("The shell command to run"),
  cwd: z
    .string()
    .optional()
    .describe("Optional working directory to run the command from"),
});

// ✅ Tool props
const runCommandToolProps = {
  name: "run_shell_command",
  description: "Runs any shell command in the given folder. If no folder is given, it runs in the current working directory.",
  schema: runCommandSchema,
};

// ✅ Tool registration
export const runCommandTool = tool(runCommandFunc, runCommandToolProps);
