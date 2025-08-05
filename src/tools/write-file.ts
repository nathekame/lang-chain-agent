import fs from "fs";
import path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

import { getProjectFiles, getProjectPath, getProjectAbsolutePath } from '../workspace';


const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Typed input object with 'file' and 'content'
export const writeFileFunc = async ({ file, content }: { file: string; content: string }) => {
  try {
    console.log("Write file tool has been called");
    console.log(`Writing content ${content} to file: ${file}`);

    const absolutePathBase = getProjectAbsolutePath();
    const resolvedPath = path.isAbsolute(file)
      ? file
      : path.join(absolutePathBase, file);

    console.log(`Resolved file path: ${resolvedPath}`);

    fs.writeFileSync(resolvedPath, content, "utf-8");

    return { status: "written" };
  } catch (error) {
    throw error;
  }
};


// ✅ Zod schema matching the input
const writeFileSchema = z.object({
  file: z.string().describe("Relative file path (from base directory) to write to"),
  content: z.string().describe("The content to write into the file")
});

// ✅ Tool configuration
const writeToolProps = {
  name: "write_content_to_file",
  description: "Writes content to the file specified in the file path.",
  schema: writeFileSchema
};

// ✅ Tool registration
export const writeFileTool = tool(writeFileFunc, writeToolProps);