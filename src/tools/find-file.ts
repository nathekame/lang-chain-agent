import fs from "fs";
import path from "path";
import { tool } from "@langchain/core/tools";

const BASE_DIR = process.env.PROJECT_FOLDER || "";

// 🔍 Function to find a file (or files) matching a name
export const findFileFunc = async ({
  search,
  directory,
}: {
  search: string;
  directory: string;
}): Promise<{ matches: string[] }> => {
  try {
    console.log(`Searching for file matching: ${search} in ${directory}`);

    const matches: string[] = [];

    function walk(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
        } else {
          if (entry.name.toLowerCase().includes(search.toLowerCase())) {
            let relativePath = path.relative(BASE_DIR, fullPath);
            relativePath = relativePath.split(path.sep).join("/"); // Normalize slashes
            matches.push(relativePath);
          }
        }
      }
    }

    walk(directory);

    return { matches };
  } catch (error) {
    throw error;
  }
};

// ✅ LangChain Tool metadata
const toolProps = {
  name: "find_file_in_project",
  description:
    "Recursively searches the given folder and returns file paths that include the search keyword.",
  schema: {
    type: "object",
    properties: {
      search: {
        type: "string",
        description: "The keyword or filename to look for (e.g., 'server.js' or 'config').",
      },
      directory: {
        type: "string",
        description: "The absolute or relative directory to begin searching from.",
      },
    },
    required: ["search", "directory"],
  },
};

// ✅ Register tool with LangChain
export const findFileTool = tool(findFileFunc, toolProps);
