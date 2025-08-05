import fs from "fs";
import path from "path";
import { tool } from "@langchain/core/tools";

// Base directory to scan
const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Function to recursively collect relative file paths in BASE_DIR
export const scanFolderFunc = async (ur: any): Promise<{ files: string[] }> => {
  try {
     console.log('Scan folder tool has been called');
        // console.log('they have called me scan folder tool BASE_DIR==> ', BASE_DIR)

    const files: string[] = [];

    async function walk(dir: string) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          let relativePath = path.relative(BASE_DIR, fullPath);
          relativePath = relativePath.split(path.sep).join("/"); // Normalize slashes
          files.push(relativePath);
        }
      });
    }

    // walk(BASE_DIR || ur);
    
    await walk(ur);


    return { files };
  } catch (error) {
    throw error;
  }
};

// ✅ Tool metadata
const toolProps = {
  name: "scan_project_folder",
  description: "Recursively scans the base project folder and returns a list of all file paths.",
  schema: undefined, // No input required
};

// ✅ Register the tool with LangChain
export const scanFolderTool = tool(scanFolderFunc, toolProps);
