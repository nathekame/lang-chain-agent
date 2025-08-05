import fsExtra from "fs-extra";
import path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Function to backup a single file from BASE_DIR
export const backupFileFunc = async ({ file }: { file: string }) => {
  try {
    console.log('Backup file tool has been called');
    const sourcePath = path.join(BASE_DIR, file);

    if (!fsExtra.existsSync(sourcePath)) {
      throw new Error(`File not found: ${sourcePath}`);
    }

    const ext = path.extname(file);
    const baseName = path.basename(file, ext);
    const dir = path.dirname(file);

    const backupFileName = `${baseName}-backup-${Date.now()}${ext}`;
    const backupPath = path.join(BASE_DIR, dir, backupFileName);

    fsExtra.copySync(sourcePath, backupPath);

    return { backup: backupPath };
  } catch (error) {
    throw error;
  }
};

// ✅ Schema for a single file input
const backupFileSchema = z.object({
  file: z.string().describe("Relative path to the file (within the base project folder) to back up")
});

// ✅ Tool metadata for backing up a single file
const toolProps = {
  name: "backup_project_file",
  description: "Creates a timestamped backup of a single file in the project folder.",
  schema: backupFileSchema
};

// ✅ Register the tool
export const backupFileTool = tool(backupFileFunc, toolProps);
