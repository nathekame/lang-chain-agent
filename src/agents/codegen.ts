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
import path from 'path';
import { setProjectFiles, setProjectPath, setProjectAbsolutePath, getProjectAbsolutePath } from '../workspace';


import { planTool } from '../tools/task-planner';
import { responseTool } from '../tools/response';
// import { cloneRepoTool } from "../tools/clone-repo";

import { workingDirectoryTool } from "../tools/get-working-directory";

import { runCommandTool } from "../tools/run-command";


import { JsonOutputToolsParser } from "@langchain/core/output_parsers/openai_tools";


// const codegenPrompt = ChatPromptTemplate.fromTemplate(
//   `You are a code generation agent. Your task is to generate code based on the provided objective and file content.

// Objective: {action}
// File Content: {fileContent}

// Create a new updated file content putting into consideration the objective.`
// );


const codegenPrompt = ChatPromptTemplate.fromTemplate(
  `You are a code generation agent. Your task is to generate code based on the provided objective and file content.

Objective: {action}
File Content: {fileContent}
file: {file}

Create a new updated file content putting into consideration the objective.
write the updated content into the file path provided`
);



// const codegenPrompt = ChatPromptTemplate.fromTemplate(
//   `Update the file located at: ${getProjectAbsolutePath()}/src/server.js

// Insert the following code starting at line 6.  
// **Important:** Do NOT overwrite or remove any existing content in the file.  
// Append this snippet into the file, shifting existing lines downward as needed to preserve all original content.

// app.use((req, res, next) => {
//   res.setHeader("X-Frame-Options", "SAMEORIGIN");
//   res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
//   next();
// });
// `);


// const parser = new JsonOutputToolsParser();

const llm = new ChatOllama({
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


export const codegenModel = createReactAgent({
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


// const replanner = codegenPrompt
//   .pipe(
//     new ChatOpenAI({ model: "gpt-4o" }).bindTools([
//       planTool,
//       responseTool,
//     ]),
//   )
//   .pipe(parser);


// export const codeGenAgent = codegenPrompt.pipe(codegenModel).pipe(parser);

export const codeGenAgent = codegenPrompt.pipe(codegenModel);