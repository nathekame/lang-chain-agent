import fsExtra from "fs-extra";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getProjectFiles, getProjectPath, projectAbsolutePath } from '../workspace';


// const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Function expects an object with a `file` key
export const getWorkingDirectoryFunc = async () => {
  try {
         console.log('Get Working Directory Tool has been called');

          const projectAbsolutePath = await getProjectAbsolutePath();
          const files = await getProjectFiles();

          if (!projectAbsolutePath || !files) {
            throw new Error("❌ Tool: project files or path not set.");
          }
        
    console.log("🔍 Project Path:", projectAbsolutePath);
    return { projectPath };
  } catch (error) {
    throw error;
  }
};

// ✅ Schema that matches the function's input structure
const workingDirectorySchema = z.object({
  path: z.string().describe("The project working directory path")
});

// ✅ Tool configuration for LangChain
const toolProps = {
  name: "working_directory",
  description: "Retrieves the project working directory path.",
  schema: workingDirectorySchema
};

// ✅ Tool registration
export const workingDirectoryTool = tool(getWorkingDirectoryFunc, toolProps);