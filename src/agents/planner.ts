import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOllama } from "@langchain/ollama";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { scanFolderTool } from "../tools/scan-folder";
import { readFileTool } from "../tools/read-file";
import { writeFileTool } from "../tools/write-file";
import { backupFileTool } from "../tools/backup-file";
import { backupFolderTool } from "../tools/backup-folder";
import { restoreFileTool } from "../tools/restore-file";
import { restoreFolderTool } from "../tools/restore-folder";
// import { cloneRepoTool } from "../tools/clone-repo";
import { planTool } from '../tools/task-planner';

import { getProjectFiles, getProjectPath, getProjectAbsolutePath } from '../workspace';

import { workingDirectoryTool } from "../tools/get-working-directory";

import { runCommandTool } from "../tools/run-command";
import path from "path";


// Initialize the model
const llm = new ChatOllama({
  model: "llama3.1:8b",
  // model: "deepseek-coder:1.3b",
  temperature: 0,
  maxRetries: 2
});

const plannerModel = createReactAgent({
  llm,
  tools: [
    workingDirectoryTool,
    runCommandTool,
    backupFolderTool,
    scanFolderTool,
    backupFileTool,
    readFileTool,
    writeFileTool,
    restoreFolderTool,
    restoreFileTool,
    planTool
  ]
});

// ✅ Export a function that returns the agent after getting the latest files
export function getPlannerAgent() {
  const projectPath = getProjectPath();
  const files = getProjectFiles();

  const absolutePath = getProjectAbsolutePath();
  const cleanedPath = path.resolve(path.normalize(absolutePath));


  if (!projectPath || !files || !absolutePath) {
    throw new Error("❌ PlannerAgent initialization failed: project files or path not set.");
  }

  console.log("📁 Loaded project files for planner:", files);

  
  // The first step should be
  // {{
  //   "step": 1,
  //   "action": "run npm update command in the project root directory.",
  //   "file": "${cleanedPath}"
  // }},



//   const plannerPrompt = ChatPromptTemplate.fromTemplate(
//   `
//   Objective:
// {objective}

// For the given objective above. A penetration test was conducted on an Angular v16 application, and several vulnerabilities were reported. Your task is to generate a precise step-by-step remediation plan based on the listed files path below.

// Below is the list of relevant files paths in the project:
// ${JSON.stringify(files.files, null, 2)}

// Using the list above, Come up with a step-by-step plan. Focus only on steps that are necessary to fix the vulnerabilities.

// Return your response strictly as a valid JSON array. Each step must follow this exact format:



//   Steps should follow in this format
//   {{
//     "step": <number>,
//     "action": "<action description>",
//     "file": "${cleanedPath}/<file path>"
//   }},

// **Guidelines**:
// - Do not include any explanations or comments outside of the JSON.
// - Each step should be self-contained, detailed and executable.

// - Ensure that the "action" field describes a specific task to be performed.
// - Use tools to scan, read and understand each file and match it with the objective before generating the plan.

// - This is the cwd: ${cleanedPath},  pass it into the run command tool together with the command.

// - Use backup tools to backup files and folders before making changes.
// - Use the run command tool to navigate the project directory.

// - Run npm update command in the project root directory
// - The "file" field must match a file or directory from the list above.


// `
// );



/// this one worked
// const plannerPrompt = ChatPromptTemplate.fromTemplate(
//               `
//             Zap Penetration Testing Report:
//             {objective}

//             Your task is to generate a **clear, actionable fix plan** for the vulnerabilities described above. The plan must be **based strictly on** the relevant file paths listed below:
            
//             Relevant file paths in the project:
//             ${JSON.stringify(files.files, null, 2)}

//             **Instructions**:

//             1. Analyze the vulnerabilities listed in the test report and match them to the files above.
//             2. Read the contents of each file using the read file tool to understand how they relate to the vulnerabilities.
//             3. Identify the specific changes needed to address each vulnerability.
//             4. Create a **step-by-step remediation plan** using only the files provided.
//             5. Focus solely on **concrete, security-related fixes** that directly address the reported issues.
//             6. Before making changes:
//               - Use the backup file tool to back up each file.
//               - Use the run command tool to navigate the project directory and apply changes.
//               - This is the project root (cwd): ${cleanedPath}. Use it in all tool commands.

//             **Output Format**:
//             Outputed steps must follow this exact schema:

//               {{
//                 "step": <serial number>,
//                 "action": "<description of the fix to apply>",
//                 "action_to_take": "<specific command to run using the run command tool>",
//                 "file": "${cleanedPath}/<relative file path from the list above where the action should be applied>"
//              }}
            
//             **Guidelines**:
//             - Do NOT include any text, explanation, or comments outside the JSON array.
//             - The "action" field must be a **specific** remediation task.
//             - The "action_to_take" field must specify the tool and precise command to use.
//             - The "file" field must exactly match a path from the provided file list.
//             - Use available tools to understand file contents and plan changes precisely.

//             Be precise. Be security-focused. Return only the required JSON output.
//             `
//             );


// const plannerPrompt = ChatPromptTemplate.fromTemplate(
//               `
//             Zap Penetration Testing Report:
//             {objective}

//             Your task is to generate a **clear, actionable fix plan** for the vulnerabilities described above. The plan must be **based strictly on** the relevant file paths listed below:
            
//             Relevant file paths in the project:
//             ${JSON.stringify(files.files, null, 2)}

//             **Instructions**:

//             1. Analyze the vulnerabilities listed in the objective and match them to the files above.
//             2. Read the contents of each file using the read file tool to understand how they relate to the vulnerabilities.
//             3. Identify the specific changes needed to address each vulnerability.
//             4. Create a **step-by-step remediation plan** using only the files provided.
//             5. Focus solely on **concrete, security-related fixes** that directly address the reported issues.
//             6. Before making changes:
//               - Use the backup file tool to back up each file.
//               - Use the run command tool to navigate the project directory and apply changes.
//               - This is the project root (cwd): ${cleanedPath}. Use it in all tool commands.

//             **Output Format**:
//             Outputed steps must follow this exact schema:

//               {{
//                 "step": <serial number>,
//                 "action": "<description of the fix to apply>",
//                 "action_to_take": "<specific command to run using the run command tool>",
//                 "file": "${cleanedPath}/<relative file path from the list above where the action should be applied>"
//              }}
            
//             **Guidelines**:
//             - Do NOT include any text, explanation, or comments outside the JSON array.
//             - Return only one line of action to take.
//             - The "action" field must be a **specific** remediation task.
//             - The "action_to_take" field must specify the tool and precise command to use.
//             - The "file" field must exactly match a path from the provided file list.
//             - Use available tools to understand file contents and plan changes precisely.

//             Be precise. Be security-focused. Return only the required JSON output.
//             `
//     );


const plannerPrompt = ChatPromptTemplate.fromTemplate(
              `
            Zap Penetration Testing Report:
            {objective}

            **Instructions**:

            - This application was built with Angular 16.
            1. Read the contents of each file using the read file tool to understand how they relate to the vulnerabilities.
            2. Analyze the vulnerabilities listed in the objective and match them to the files above.
            3. Identify the specific file changes needed to address each vulnerability.
            4. Generate commands for windows environment only

            
            Relevant file paths in the files in the project:
            ${JSON.stringify(files.files, null, 2)}

            **Output Format must be this structure only with no other test before or after the JSON object**:
        
            {{
                "step": <serial number>,
                "action": "<description of the fix to apply, if it is a command to run or file to update>",
                "action_to_take": "<specific update to make on the file>",
                "file": "${cleanedPath}/<relative file path from the list above where the action should be applied>"
            }}
            
            **Guidelines**:
            - Do NOT include any text, explanation, or comments outside the JSON.
            - Provide project specific fix and not general fixes.
            - You must return only one JSON object in the output and no extra text.

            `
    );


// const plannerPrompt = ChatPromptTemplate.fromTemplate(
//   `
// Zap Penetration Test Report:
// {objective}

// Relevant file paths:
// ${JSON.stringify(files.files, null, 2)}

// Your task: Identify and return **one specific fix** for the most critical vulnerability using **only** the files listed above.

// - Use the read file tool to inspect file contents.
// - Backup the file before modifying it.
// - Use the run command tool to apply the fix.
// - Project root (cwd): ${cleanedPath}

// **Output (only one JSON object):**

// \`\`\`json
// {  
//   "step": 1,
//   "action": "Short description of the fix",
//   "action_to_take": "run: <exact shell command>",
//   "file": "${cleanedPath}/<relative file path>"
// }
// \`\`\`

// No extra text. Return only the JSON. Be specific and security-focused.
//   `
// );



//   const plannerPrompt = ChatPromptTemplate.fromTemplate(
//     `For the given objective. An application built in angular version 16, a penetration test was conducted on the hosted application and vulnerabilities were raised. \
// These are the files in the project: ${JSON.stringify(files.files)}. \
// Come up with a step-by-step plan on how to fix the vulnerabilities and specify which of the files need to be updated. \
// Return your response as a valid JSON array where each step has the format:

// {{
//   "step": <number>,
//   "action": <string>,
//   "file": <string>
// }}

// step refers to the serial number or index of the step  
// action refers to what needs to be taken on the file  
// file refers to the file path of the file or directory to be modified  

// Do not include any extra commentary. Only output JSON.

// Objective:
// {objective}`
//   );

  return plannerPrompt.pipe(plannerModel);
}
