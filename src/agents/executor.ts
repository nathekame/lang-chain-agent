import { ChatOllama } from "@langchain/ollama";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatPromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { scanFolderTool } from "../tools/scan-folder";
import { readFileTool } from "../tools/read-file";
import  { writeFileTool } from "../tools/write-file"
import { backupFileTool } from "../tools/backup-file";
import { backupFolderTool } from "../tools/backup-folder";
import { restoreFileTool } from "../tools/restore-file";
import { restoreFolderTool } from "../tools/restore-folder";

import { workingDirectoryTool } from "../tools/get-working-directory";

import { findFileTool } from "../tools/find-file";

import { runCommandTool } from "../tools/run-command";

import { applyEditTool } from "../tools/anchor-edit";
import { appendFileTool } from "../tools/append-file";
  

import { projectAbsolutePath } from '../workspace';



// Initialize the model
const llm = new ChatOllama({
  model: "llama3.1:8b",
  // model: "deepseek-coder:1.3b",
  temperature: 0,
  maxRetries: 2
});


// Create the agent with the tool

const tools = [
  findFileTool,
  workingDirectoryTool,
  runCommandTool,
  backupFolderTool,
  scanFolderTool,
  backupFileTool,
  readFileTool,
  writeFileTool,
  restoreFolderTool,
  restoreFileTool,
  applyEditTool,
  appendFileTool

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


//   const systemPrompt = ChatPromptTemplate.fromTemplate(
//   `
//  You are a highly skilled file system assistant with access to tools that help with file scanning, backup, restoration, and command execution.
//      Follow instructions carefully and use tools only when needed.
     

//     **Guidelines**:
//     - Pass in the current working directory as the cwd parameter to the run-command tool.
//     - Use the scan-folder tool to scan folders and get their contents.
//     - Use the backup-file tool to backup individual files.
//     - Use the read-file tool to read the contents of files.
//     - Use the write-file tool to write contents to files.
//     - Use the restore-file tool to restore backed up files if need be.
//     - Do not write python code or use pip install, strictly use and stick to npm for package management.

//     You are  working on an angular project, so you can run commands like 'ng serve' , and also npm commands. we do not need python here.



//     Your output should follow this template format
//       {{
//         "problem": <he instruction that was given to the agent, if any. If no instruction was given, this should be empty.>,
//         "action_taken": "<The action that was taken on the file, if any. If no action was taken, this should be empty.>",
//         "file": "The file that was acted upon, if any. If no file was acted upon, this should be empty."
//       }},
 


// `
// );


const systemPrompt = ChatPromptTemplate.fromTemplate(
  `
  
   With the task you are given you must perform the action to take
  
      action: Is a description of what you are to do
      action_to_take: Is the action typically running a command or writing to a file
      file: Is the absolute path to the file that you need to perform the action on
  
      ***Use the write tool to write all changes into the destination file***      

  `
)


// const systemPrompt = ChatPromptTemplate.fromTemplate(
//   `
// As a code execution agent with access to tools for file scanning, reading, anchor-editing, file appending, writing, backup, restoration, and command execution. 
// Follow instructions carefully and use tools only when necessary.

// **Guidelines**:

// If a file needs to be updated:
// - Use the **search file** tool to locate the file.
// - Use the **backup file** tool to create a backup before making any changes.
// - Use the **read file** tool to inspect the current contents.
// - Generate the updated version of the file, including all required changes.
// - Use the **write file** tool to overwrite the file with the new content.

// If a command needs to be executed, use the **run command** tool in the project root directory.

// You are working on an **Angular project**, so it's safe to run Angular-specific commands like \`ng serve\` and \`ng build\`, as well as common \`npm\` commands. Python is not required in this context.

// **Output Format** (return strictly in this structure):
// \`\`\`json
// {
//   "problem": "<The instruction or issue being addressed. Leave empty if none.>",
//   "action_taken": "<The action performed, if any. Leave empty if none.>",
//   "file": "<The file that was modified or read, if applicable. Leave empty if none.>"
// }
// \`\`\`
// `
// );


const llmWithTools = llm.bindTools(tools).bind({ prompt: systemPrompt });


  
export const executerAgent = createReactAgent({
      llm: llmWithTools,
      tools: [ 
               workingDirectoryTool,
               findFileTool,
               runCommandTool,
               backupFolderTool, 
               scanFolderTool,
               backupFileTool, 
               readFileTool,
               writeFileTool,
               restoreFolderTool,
               restoreFileTool, 
               applyEditTool,
               appendFileTool
              
            ]
    });

