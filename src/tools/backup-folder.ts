import fsExtra from "fs-extra";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getProjectAbsolutePath } from "../workspace";

const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Function expects an object with a `file` key
export const backupFolderFunc = async ({ file }: { file: string }) => {
  try {
    console.log('Backup folder tool has been called');

    const getPath = await getProjectAbsolutePath();

    const backup = `${file}-backup-${Date.now()}`;
    fsExtra.copySync(getPath, backup);
    return { backup };
  } catch (error) {
    throw error;
  }
};

// ✅ Schema that matches the function's input structure
const backupFolderSchema = z.object({
  file: z.string().describe("The destination folder path where the backup will be created")
});

// ✅ Tool configuration for LangChain
const toolProps = {
  name: "backup_folder",
  description: "Backs up the contents of the base project folder to a new folder with a timestamped name.",
  schema: backupFolderSchema
};

// ✅ Tool registration
export const backupFolderTool = tool(backupFolderFunc, toolProps);
