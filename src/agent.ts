import { ChatOllama } from "@langchain/ollama";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatPromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { scanFolderTool } from "./tools/scan-folder";
import { readFileTool } from "./tools/read-file";
import  { writeFileTool } from "./tools/write-file"
import { backupFileTool } from "./tools/backup-file";
import { backupFolderTool } from "./tools/backup-folder";
import { restoreFileTool } from "./tools/restore-file";
import { restoreFolderTool } from "./tools/restore-folder";

import { workingDirectoryTool } from "./tools/get-working-directory";

import { runCommandTool } from "./tools/run-command";

import { projectAbsolutePath } from './workspace';




const responseSchema = z.object({
  problem: z.string().describe(
    "The instruction that was given to the agent, if any. If no instruction was given, this should be empty."
  ),
  file: z.string().describe(
    "The file that was acted upon, if any. If no file was acted upon, this should be empty."
  ),
  action_taken: z.string().describe(
    "The action that was taken on the file, if any. If no action was taken, this should be empty."
  ),
  
});





// Initialize the model
const llm = new ChatOllama({
  model: "llama3.1:8b",
  temperature: 0,
  maxRetries: 2
});


// Create the agent with the tool

const tools = [
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



//   const systemPrompt = ChatPromptTemplate.fromTemplate(
//   `
//  You are a highly skilled file system assistant with access to tools that help with file scanning, backup, restoration, and command execution.
//      Follow instructions carefully and use tools only when needed.
     

//     **Guidelines**:
//     - Use the get-working-directory tool to get the current working directory.
//     - Use the run-command tool to execute shell commands in the current working directory.
//     - Pass in the current working directory as the cwd parameter to the run-command tool.
//     - Use the backup-folder tool to backup folders.
//     - Use the scan-folder tool to scan folders and get their contents.
//     - Use the backup-file tool to backup individual files.
//     - Use the read-file tool to read the contents of files.
//     - Use the write-file tool to write contents to files.
//     - Use the restore-folder tool to restore backed up folders if need be.
//     - Use the restore-file tool to restore backed up files if need be.
//     - Use the plan tool to create a plan for executing tasks.
//     - Use the response tool to return a final response to the user.
//     - Do not write python code or use pip install, strictly use and stick to npm for package management.

//     You are  working on an angular project, so you can run commands like 'ng serve' , and also npm commands. we do not need python here.

// `
// );

  const systemPrompt = ChatPromptTemplate.fromTemplate(
  `
 You are a highly skilled file system assistant with access to tools that help with file scanning, backup, restoration, and command execution.
     Follow instructions carefully and use tools only when needed.
     

    **Guidelines**:
    - Use the get-working-directory tool to get the current working directory.
    - Use the run-command tool to execute shell commands in the current working directory.
    - Pass in the current working directory as the cwd parameter to the run-command tool.
    - Use the scan-folder tool to scan folders and get their contents.
    - Use the backup-file tool to backup individual files.
    - Use the read-file tool to read the contents of files.
    - Use the write-file tool to write contents to files.
    - Use the restore-file tool to restore backed up files if need be.
    - Do not write python code or use pip install, strictly use and stick to npm for package management.

    You are  working on an angular project, so you can run commands like 'ng serve' , and also npm commands. we do not need python here.

`
);





const llmWithTools = llm.bindTools(tools).bind({ prompt: systemPrompt });


  
export const executerAgent = createReactAgent({
      llm: llmWithTools,
      tools: [ 
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
          responseFormat: responseSchema,

    });

    console.log("✅ Executor Agent initialized with tools:", tools.map(tool => tool.name).join(", "));