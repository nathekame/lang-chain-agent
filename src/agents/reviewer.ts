import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOllama } from "@langchain/ollama";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { scanFolderTool } from "../tools/scan-folder";
import { readFileTool } from "../tools/read-file";
import  { writeFileTool } from "../tools/write-file"
import { backupFileTool } from "../tools/backup-file";
import { backupFolderTool } from "../tools/backup-folder";
import { restoreFileTool } from "../tools/restore-file";
import { restoreFolderTool } from "../tools/restore-folder";
// import { cloneRepoTool } from "../tools/clone-repo";

import { workingDirectoryTool } from "../tools/get-working-directory";

import { runCommandTool } from "../tools/run-command";

import { planFunction } from "../tools/task-planner";

import { z } from "zod";


// const codeReviewPrompt = ChatPromptTemplate.fromTemplate(
//   `You are a senior software engineer reviewing a proposed code change. \
// Your task is to go through the change step by step and provide a clear, concise review. \
// Focus on correctness, potential bugs, readability, security, performance, and adherence to best practices. \
// Explain any issues you find and suggest improvements. \
// Do not overlook edge cases or assumptions. Be specific in your feedback.

// Here is the code change to review:

// {codeDiff}`
// );

// const codeReviewPrompt = ChatPromptTemplate.fromTemplate(
//   `You are a senior software engineer reviewing a proposed code change.

// Your task is to go through the change step by step and return your review in a **structured JSON** format.

// Please return only JSON, with the following format:

// {{
//   "summary": "<short high-level summary of the review>",
//   "issues": [
//     {{
//       "type": "<one of: 'bug', 'readability', 'performance', 'security', 'best_practice'>",
//       "line": <line number if applicable>,
//       "description": "<clear explanation of the issue>",
//       "suggestion": "<specific improvement suggestion>"
//     }}
    
//   ]
// }}

// Here is the code change to review:

// {codeDiff}`
// );

const codeReviewPrompt = ChatPromptTemplate.fromTemplate(
  ` You are reviewing a proposed code change made by another agent.

Your task is to go through the file that were changed and check if all changes are correct to avoid any issues. Return your review in a **structured JSON** format.

Please return only JSON, with the following format:

{{
  "issues": [
    {{
      passOrFail: "<did the review pass or fail?>", 
      feedback: "<recommend specific action to fix issues>"
    }}
    
  ]
}}

Here is the review task:

{objective}
`

);




const feedbackSchema = z.object({
  grade: z.enum(["pass", "fail"]).describe(
    "Decide if the action taken on the file was successful or not, also check if the all code was formated well."
  ),
  feedback: z.string().describe(
    "If the action was not successful, provide feedback on how to improve it"
  ),
});


// Initialize the model
// const llm = new ChatOllama({
//   model: "llama3.1:8b",
//   temperature: 0,
//   maxRetries: 2
// }).withStructuredOutput(planFunction);

// const llm = new ChatOllama({
//   model: "llama3.1:8b",
//   // model: "deepseek-coder:1.3b",
//   temperature: 0,
//   maxRetries: 2
// }).withStructuredOutput(feedbackSchema);


const llm = new ChatOllama({
  model: "llama3.1:8b",
  // model: "deepseek-coder:1.3b",
  temperature: 0,
  maxRetries: 2
});

const tools = [
  // cloneRepoTool,
  workingDirectoryTool,
  runCommandTool,
  backupFolderTool,
  scanFolderTool,
  backupFileTool,
  readFileTool,
  writeFileTool,
  restoreFolderTool,
  restoreFileTool
];

const llmWithTools = llm.bindTools(tools);

 
const reviewerModel = createReactAgent({
      llm: llmWithTools,
      tools: [ 
              //  cloneRepoTool,
               workingDirectoryTool,
               runCommandTool,
               backupFolderTool, 
               scanFolderTool,
               backupFileTool, 
               readFileTool,
               writeFileTool,
               restoreFolderTool,
               restoreFileTool 
              
            ],
        responseFormat: feedbackSchema,

    });


export const reviewerAgent = codeReviewPrompt.pipe(reviewerModel);