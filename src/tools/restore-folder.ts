import fsExtra from "fs-extra";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Restores a folder from backup into BASE_DIR
export const restoreFolderFunc = async ({ backup }: { backup: string }) => {
  try {
    console.log('Restore folder tool has been called');
    fsExtra.copySync(backup, BASE_DIR);
    return { restored: true, restoredTo: BASE_DIR };
  } catch (error) {
    throw error;
  }
};

// ✅ Zod schema for input validation
const restoreFolderSchema = z.object({
  backup: z.string().describe("The full path to the backup folder to restore into the project base directory")
});

// ✅ LangChain tool metadata
const toolProps = {
  name: "restore_project_folder",
  description: "Restores the entire project folder from a given backup folder path.",
  schema: restoreFolderSchema
};

// ✅ Registering the tool
export const restoreFolderTool = tool(restoreFolderFunc, toolProps);
