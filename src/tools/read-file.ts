import fs from "fs";
import path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

const BASE_DIR = process.env.PROJECT_FOLDER || "";

// ✅ Typed input object with 'file'
// export const readFileFunc = async ({ file }: { file: string }) => {
export const readFileFunc = async ( file : string ) => {

  try {
    console.log('Read file tool has been called');

    console.log(`Reading file ==> : ${file}`);

    const content = fs.readFileSync(file, "utf-8");
    return { content };
  } catch (error) {
    throw error;
  }
};

// ✅ Zod schema matching the input
const readFileSchema = z.object({
  file: z.string().describe("Relative file path (from base directory) to read")
});

// ✅ Tool configuration
const toolProps = {
  name: "read_file_from_base",
  description: "Reads a file from the base project directory and returns its contents as a string.",
  schema: readFileSchema
};

// ✅ Tool registration
export const readFileTool = tool(readFileFunc, toolProps);
