import { ChatOllama } from "@langchain/ollama";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { scanFolderTool } from "../tools/scan-folder";
import { readFileTool } from "../tools/read-file";
import  { writeFileTool } from "../tools/write-file"
import { backupFileTool } from "../tools/backup-file";
import { backupFolderTool } from "../tools/backup-folder";
import { restoreFileTool } from "../tools/restore-file";
import { restoreFolderTool } from "../tools/restore-folder";
import { ChatPromptTemplate } from "@langchain/core/prompts";

import { planTool } from '../tools/task-planner';
import { responseTool } from '../tools/response';
// import { cloneRepoTool } from "../tools/clone-repo";

import { workingDirectoryTool } from "../tools/get-working-directory";

import { runCommandTool } from "../tools/run-command";


import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";


const replannerPrompt = ChatPromptTemplate.fromTemplate(
  `For the given objective, come up with a simple step by step plan. 
This plan should involve individual tasks, that if executed correctly will yield the correct answer. Do not add any superfluous steps.
The result of the final step should be the final answer. Make sure that each step has all the information needed - do not skip steps.

Your objective was this:
{input}

Your original plan was this:
{plan}

You have currently done the follow steps:
{pastSteps}

Update your plan accordingly. If no more steps are needed and you can return to the user, then respond with that and use the 'response' function.
Otherwise, fill out the plan.  
Only add steps to the plan that still NEED to be done. Do not return previously done steps as part of the plan.`,
);

const parser = new JsonOutputToolsParser();

const llm = new ChatOllama({
  // model: "deepseek-coder:1.3b",
 model: "llama3.1:8b",
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
  restoreFileTool,
    
  planTool,
  responseTool
];

const llmWithTools = llm.bindTools(tools);


export const replannerModel = createReactAgent({
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
               restoreFileTool,
               
               planTool,
               responseTool
               
              
            ]
    });


// const replanner = replannerPrompt
//   .pipe(
//     new ChatOpenAI({ model: "gpt-4o" }).bindTools([
//       planTool,
//       responseTool,
//     ]),
//   )
//   .pipe(parser);


export const replannerAgent = replannerPrompt.pipe(replannerModel).pipe(parser);