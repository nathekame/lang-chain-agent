import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { z } from "zod";
import simpleGit from "simple-git";
import { tool } from "@langchain/core/tools";

const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Clones a Git repo to a timestamped folder and launches a file agent
export const cloneRepoFunc = async ({ file }: { file: string }) => {
  try {
    console.log('Clone repo tool has been called');

    const CLONE_BASE = path.resolve(BASE_DIR, "cloned-repos");
    if (!fs.existsSync(CLONE_BASE)) {
      fs.mkdirSync(CLONE_BASE, { recursive: true });
    }

    const repoUrl = process.env.TARGET_REPO_URL;
    if (!repoUrl) {
      throw new Error("TARGET_REPO_URL environment variable is not set.");
    }

    const timestamp = Date.now();
    const projectPath = path.join(CLONE_BASE, `repo-${timestamp}`);

    // Clone the repo
    await simpleGit().clone(repoUrl, projectPath);
    console.log(`Repo cloned into ${projectPath}`);

    // Spawn the fs-agent process
    const fsAgentProcess = spawn("node", ["../fs-agent/index.js"], {
      env: { ...process.env, PROJECT_FOLDER: projectPath },
    });

    fsAgentProcess.stdout.on("data", (data) =>
      console.log(`[FS Agent] ${data.toString()}`)
    );
    fsAgentProcess.stderr.on("data", (data) =>
      console.error(`[FS Agent Error] ${data.toString()}`)
    );

    return { status: "repo cloned", path: projectPath };
  } catch (error) {
    console.error("Error cloning repo:", error);
    throw error;
  }
};

// ✅ Schema for triggering clone (e.g. dummy `file` input to fit tool pattern)
const cloneRepoSchema = z.object({
  file: z.string().describe("Any string to trigger the repo cloning process (e.g. 'start')")
});

// ✅ Tool configuration
const cloneToolProps = {
  name: "clone_repo_to_workspace",
  description:
    "Clones the target Git repository into a timestamped workspace folder and starts the fs-agent process.",
  schema: cloneRepoSchema,
};

// ✅ Tool registration
export const cloneRepoTool = tool(cloneRepoFunc, cloneToolProps);
