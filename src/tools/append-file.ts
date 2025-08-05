import fsExtra from "fs-extra";
import path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import fs from "fs";



export const appendFileFunc = async ({ file, text }: { file: string; text: string }) => {
      console.log('Append file tool has been called');

  const fullPath = path.join(BASE_DIR, file);
  if (!text.endsWith("\n")) text += "\n";
  fs.appendFileSync(fullPath, text);
  return { result: "OK: text appended." };
};

const appendFileSchema = z.object({
  file: z.string().describe("Relative path to file (from base directory)"),
  text: z.string().describe("Text to append to the file"),
});

export const appendFileTool = tool(appendFileFunc, {
  name: "append_file",
  description: "Appends text to the end of a file.",
  schema: appendFileSchema,
});
