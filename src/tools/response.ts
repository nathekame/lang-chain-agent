import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const response = zodToJsonSchema(
  z.object({
    response: z.string().describe("Response to user."),
  }),
);

export const responseTool = {
  type: "function",
  function: {
    name: "response",
    description: "Response to user.",
    parameters: response,
  },
};