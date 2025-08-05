import fsExtra from "fs-extra";
import path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Restore a single file into BASE_DIR, preserving filename
export const restoreFileFunc = async ({ backup }: { backup: string }) => {
  try {
    console.log('Restore file tool has been called');
    const filename = path.basename(backup);
    const destination = path.join(BASE_DIR, filename);

    fsExtra.copySync(backup, destination);

    return { restored: true, restoredTo: destination };
  } catch (error) {
    throw error;
  }
};

// ✅ Zod schema for file-based restore
const restoreFileSchema = z.object({
  backup: z.string().describe("The full path of the backup file to restore into the project folder")
});

// ✅ Tool metadata updated to reflect file-based restore
const toolProps = {
  name: "restore_project_file",
  description: "Restores a single file from a given backup file path into the project folder.",
  schema: restoreFileSchema
};

// ✅ Register the tool
export const restoreFileTool = tool(restoreFileFunc, toolProps);
