import fsExtra from "fs-extra";
import path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import fs from "fs";




const BASE_DIR = process.env.PROJECT_FOLDER || "";


export const applyEditFunc = async (spec: z.infer<typeof editSpecSchema>) => {
      console.log('Anchor Edit tool has been called');

  const fullPath = path.join(BASE_DIR, spec.file_path);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  let content = fs.readFileSync(fullPath, "utf-8");
  const original = content;

  switch (spec.action) {
    case "append":
      if (spec.text && content.includes(spec.text)) {
        return { result: "Skipped: text already present (idempotent)." };
      }
      content += (!content.endsWith("\n") ? "\n" : "") + (spec.text ?? "");
      break;

    case "insert_after":
    case "insert_before":
      if (!spec.anchor || !spec.text) throw new Error("Both anchor and text are required.");
      const idx = content.indexOf(spec.anchor);
      if (idx === -1) throw new Error(`Anchor not found: "${spec.anchor}"`);
      const insertAt = spec.action === "insert_after" ? idx + spec.anchor.length : idx;
      if (content.includes(spec.text)) {
        return { result: "Skipped: text already present (idempotent)." };
      }
      content = content.slice(0, insertAt) + spec.text + content.slice(insertAt);
      break;

    case "replace":
      if (!spec.pattern || spec.replacement === undefined) {
        throw new Error("Pattern and replacement are required for replace.");
      }
      const regex = new RegExp(spec.pattern, "gm");
      let count = 0;
      content = content.replace(regex, (match) => {
        if (spec.occurrences !== 0 && count >= spec.occurrences) return match;
        count++;
        return spec.replacement!;
      });
      if (count === 0) throw new Error("No matches for pattern; nothing replaced.");
      break;

    default:
      throw new Error(`Unsupported action: ${spec.action}`);
  }

  if (content !== original) {
    fs.copyFileSync(fullPath, fullPath + ".bak");
    fs.writeFileSync(fullPath, content, "utf-8");
    return { result: "OK: file updated." };
  }

  return { result: "No change." };
};


// ✅ Schema for a single file input

// EditSpec schema
const editSpecSchema = z.object({
  file_path: z.string().describe("Relative path to file to modify (from base directory)"),
  action: z.enum(["insert_after", "insert_before", "replace", "append"]),
  anchor: z.string().optional(),
  pattern: z.string().optional(),
  replacement: z.string().optional(),
  text: z.string().optional(),
  occurrences: z.number().int().nonnegative().default(1),
});

// ✅ Tool metadata for backing up a single file
const toolProps = {
  name: "anchored_edit_file",
  description: "Edits a file based on anchor, pattern or appending text. Safe and idempotent.",
  schema: editSpecSchema,
};

// ✅ Register the tool
export const applyEditTool = tool<typeof applyEditFunc>(applyEditFunc, toolProps);