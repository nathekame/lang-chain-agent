import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';

import { HumanMessage } from '@langchain/core/messages';
import { Annotation } from "@langchain/langgraph";

import { END, START, StateGraph } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";

import { executerAgent } from './agents/executor';
import { plannerAgent } from './agents/planner';
// import { setupPlannerAgent } from './agents/planner';
import { replannerAgent } from './agents/replanner';
import { reviewerAgent } from './agents/reviewer'
import { AIMessage } from "@langchain/core/messages";
import { scanFolderFunc } from './tools/scan-folder';
import { setProjectFiles, setProjectPath, setProjectAbsolutePath, getProjectAbsolutePath } from './workspace';
import { getPlannerAgent } from './agents/planner';
import { MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { readFileTool, readFileFunc } from './tools/read-file';
import { searchFileTool } from './tools/find-file';
import { codeGenAgent } from './agents/codegen';

import { pushToBranchTool } from './tools/push-to-branch'


const checkpointer = new MemorySaver();

const readFileToolNode = new ToolNode(readFileTool);

const searchFileToolNode = new ToolNode(searchFileTool);

const deployToolNode = new ToolNode(pushToBranchTool);




dotenv.config();

const app = express();
const port = process.env.PORT || '8000';


app.use(express.json());
app.use(cors());

let plannerAgent: any;


const CLONE_BASE = './cloned-repos';
if (!fs.existsSync(CLONE_BASE)) fs.mkdirSync(CLONE_BASE);

let projectPath = null;


// async function initializeWorkspace() {
//   const repoUrl = process.env.TARGET_REPO_URL;
//   if (!repoUrl) {
//     console.error('ERROR: TARGET_REPO_URL environment variable is not set.');
//     process.exit(1);
//   }

//   const timestamp = Date.now();
//   projectPath = path.join(CLONE_BASE, `repo-${timestamp}`);
//   await simpleGit().clone(repoUrl, projectPath);
//   console.log(`✅ Repo cloned into ${projectPath}`);

//   // process.env.PROJECT_FOLDER = projectPath;

//  const dFiles = await scanFolderFunc(projectPath);

// const projectAbsolutePath = path.resolve(projectPath);

//   // Store in shared state
//   setProjectAbsolutePath(projectAbsolutePath);
//   setProjectPath(projectPath);
//   setProjectFiles(dFiles);

// //  console.log("THE FILESSSS process.env.PROJECT_FILES =>", JSON.stringify(process.env.PROJECT_FILES));

//   // console.log("THE FILESSSS =>", dFiles.files);

//   // fsAgentProcess = spawn('node', ['../fs-agent/index.js'], {
//   //   env: { ...process.env, PROJECT_FOLDER: projectPath }
//   // });

//   // fsAgentProcess.stdout.on('data', (data) => console.log(`[FS Agent] ${data.toString()}`));
//   // fsAgentProcess.stderr.on('data', (data) => console.error(`[FS Agent Error] ${data.toString()}`));
//   console.log("🔍 Scanned files:", dFiles);
// }


async function initializeWorkspace() {
  const repoUrl = process.env.TARGET_REPO_URL;
  const branchName = process.env.TARGET_BRANCH || 'staging';

  if (!repoUrl) {
    console.error('❌ ERROR: TARGET_REPO_URL environment variable is not set.');
    process.exit(1);
  }

  const timestamp = Date.now();
  projectPath = path.join(CLONE_BASE, `repo-${timestamp}`);

  console.log(`🚀 Cloning branch "${branchName}" from ${repoUrl}...`);
  await simpleGit().clone(repoUrl, projectPath, ['--branch', branchName, '--single-branch']);
  console.log(`✅ Repo cloned into ${projectPath}`);

  const dFiles = await scanFolderFunc(projectPath);
  const projectAbsolutePath = path.resolve(projectPath);

  // Store in shared state
  setProjectAbsolutePath(projectAbsolutePath);
  setProjectPath(projectPath);
  setProjectFiles(dFiles);

  console.log("🔍 Scanned files:", dFiles);
}




async function deployProject({
  folderPath,
  branch,
  commitMessage,
}: {
  folderPath: string;
  branch: string;
  commitMessage: string;
}) {
  try {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`❌ Provided folderPath does not exist: ${folderPath}`);
    }

    console.log(`📌 Pushing changes from ${folderPath} to branch "${branch}"`);

    const git = simpleGit(folderPath);

    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      console.log("🔧 Initializing Git repo...");
      await git.init();
      await git.addRemote('origin', process.env.TARGET_REPO_URL!);
    }

    await git.fetch();

    const branches = await git.branchLocal();
    if (!branches.all.includes(branch)) {
      console.log(`⚠️ Branch "${branch}" not found locally. Creating...`);
      await git.checkoutLocalBranch(branch);
    } else {
      await git.checkout(branch);
      await git.pull('origin', branch);
    }

    await git.add('.');
    const commitResult = await git.commit(commitMessage);

    if (!commitResult.commit) {
      console.log('⚠️ No changes to commit');
      return { status: 'no changes', branch };
    }

    await git.push(['-u', 'origin', branch]);

    console.log(`✅ Folder pushed to branch "${branch}"`);
    return { status: 'pushed', branch };
  } catch (error) {
    console.error('❌ Error pushing to branch:', error);
    throw error;
  }
}



const extractStepsFromPlannerOutput = (result: any): any[] => {
  const aiMessages = result.messages.filter(
    (msg: any) => msg._getType && msg._getType() === "ai"
  );

  for (const msg of [...aiMessages].reverse()) {
    if (msg.content && typeof msg.content === "string") {
      try {
        // Clean up any model-specific tags, like <|python_tag|>
        const cleaned = msg.content.replace(/<\|.*?\|>/g, "").trim();

        // Attempt to parse JSON from content
        const steps = JSON.parse(cleaned);
        if (Array.isArray(steps)) {
          return steps;
        }
      } catch (err) {
        // Not valid JSON, continue checking previous AI messages
        continue;
      }
    }
  }

  // Fallback: no valid structured output found
  return [];
};

async function extractActions(text) {

  console.log("Extracting actions from text:", text);
  const actionToTakeArray = [];

  // Match all JSON-like blocks using a regex
  const jsonMatches = text.match(/(\{[^}]+\})/g);

  if (!jsonMatches) return [];

  for (const match of jsonMatches) {
    try {
      const jsonObj = JSON.parse(match);
      if (jsonObj.action_to_take) {
        actionToTakeArray.push(jsonObj.action_to_take);
      }
    } catch (e) {
      // Ignore malformed JSON
    }
  }

  return actionToTakeArray;
}



const PlanExecuteState = Annotation.Root({
  input: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
  }),
  plan: Annotation<string[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  pastSteps: Annotation<[string, string][]>({
    reducer: (x, y) => x.concat(y),
  }),
  response: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  passOrFail: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
  feedback: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
})



async function executeStep(
  state: typeof PlanExecuteState.State,
  config?: RunnableConfig,
): Promise<Partial<typeof PlanExecuteState.State>> {
  // console.log('this is the state lenght ===> ' + JSON.stringify(state.plan.length))

    console.log("******************************************");

  console.log("Executing with state ========> :", state);


  // console.log("Executing with state input  =>:", state.input);
  console.log("Executing with state plan pass this in:==> ", state.plan);

    console.log("******************************************");

  // const actionTake = await extractActions(state.plan);

  // console.log("Extracted action to take: ====> ", actionTake);

  // const task = state.plan[0];
  const task = state.plan;

  // const task = actionTake[0];


  // console.log("Executing task THE ATSKK ===>   : ", task);

  // const dTask = `${task},  If a file needs to be updated:
  // - Use the **search file** tool to locate the file.
  // - Use the **backup file** tool to create a backup before making any changes.
  // - Use the **read file** tool to inspect the current contents.
  // - Generate the updated version of the file, including all required changes.
  // - Use the **write file** tool to overwrite the file with the new content.
  
  // If a command needs to be executed, use the **run command** tool in the project root directory.`;


    const dTask = `${task}, 

    The above is a task you must perform using any of the tools neccessary at your disposal

    action: Is a description of what you are to do
    action_to_take: Is the action typically running a command or writing to a file
    file: Is the absolute path to the file that you need to perform the action on

    use the anchor edit tool to update file 
    Use any of the tools at your disposal
    
    If a file needs to be updated:
  - Use the **read file** tool to inspect the current contents.
  - Use the **anchor edit** tool to update the file with the new content.
  
    If a command needs to be executed, use the **run command** tool in the project root directory.
    
    
    
  `;


  // const cookedTask = `append this "app.use((req, res, next) => {
  //   res.setHeader("X-Frame-Options", "SAMEORIGIN");
  //   res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  //   next();
  // });" to ${path.join(getProjectAbsolutePath(), 'server.js')} server.js file `
  // const input = {
  //   messages: [new HumanMessage(JSON.stringify(task))],
  // };

const cookedTask2 = `Write this code in the file located at: ${path.join(getProjectAbsolutePath(), '/server.js')}

const express = require('express');
const path = require('path');
const app = express();

// Security Headers Middleware
app.use((req, res, next) => {
  // Clickjacking protection VULN-001
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self'; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'self'");
  next();
});

  // Prevent MIME-sniffing VULN-004
  res.setHeader("X-Content-Type-Options", "nosniff");

  // HSTS (HTTPS only!) VULN-002
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Remove potential timestamp header VULN-003
  res.removeHeader("Last-Modified");

  // Prevent access to dotfiles like .env, .git VULN-010
  if (/\/\.[^\/]+/.test(req.url)) {
    return res.status(403).send("Access denied.");
  }

  next();
});

// Remove X-Powered-By header VULN-005
app.disable('x-powered-by');

// Serve static files VULN-006
app.use(express.static(path.join(__dirname, 'dist', 'renewable-energy-app'), {
  setHeaders: (res, filePath) => {
    if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$/i.test(filePath)) {
      // Cache static assets for 30 days
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
    } else {
      // Don't cache other static files (e.g. HTML)
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

// Handle all other routes VULN-006
app.get('/*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.resolve(__dirname, 'dist', 'renewable-energy-app', 'index.html'));
});

console.log('new code done');



// Use environment variable for the port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
});

`;


// const cookedTask2 = `Update the file located at: ${path.join(getProjectAbsolutePath(), 'src/server.js')} as follows:

// Insert the following code starting at line 6. 
// **Important:** Do NOT overwrite or remove any existing content in the file. 
// Append this snippet into the file, shifting existing lines downward as needed to preserve all original content.

// app.use((req, res, next) => {
//   res.setHeader("X-Frame-Options", "SAMEORIGIN");
//   res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
//   next();
// });
// `;


      const input = {
        messages: [new HumanMessage(cookedTask2)],
      };

      // const input = {
      //   messages: [new HumanMessage(task)],
      // };
//  const data = `echo "<script>function greet() { alert('Hello, world!'); }</script>" > C:\\Users\nathe\humber\oracle-lens\node-next\ts-agent\cloned-repos\repo-1753211957330\src\index.html`;
  console.log("Executing input messages:", input.messages[0]);
  // const input = {
  //   messages: [new HumanMessage('Please run the following command: ' + data)],
  // };

  // const { messages } = await executerAgent.invoke(input, config);
  const res = await executerAgent.invoke(input, config);

  console.log("Executed result Response EEEE ====>>>>> :", res);


  if(res){
    await deployProject({
      folderPath: getProjectAbsolutePath(),
      branch: 'staging',
      commitMessage: 'Agent 3 executer update',
    });
  }



  // console.log("📜 Executed step:", task);
  // console.log("📜 Executed messages:", messages);

  // console.log("📜 Executed messages content:", messages[messages.length - 1].content.toString())
  // console.log("📜 Executed messages content slice:", state.plan.slice(1));


  // const result = JSON.stringify(state.plan.slice(1));

  // console.log("Structured result1 structured ===>:", result);


    return {
    
    // pastSteps: [[task, messages[messages.length - 1].content.toString()]],
    pastSteps: [task],
    plan: res
  };
}

async function planStep(
  state: typeof PlanExecuteState.State,
): Promise<Partial<typeof PlanExecuteState.State>> {
  
  try {
  // console.log("Planning with state:", state.input);

    const plan = await plannerAgent.invoke({ objective: state.input });
  

  // console.log("Structured result1 HumanMessage ===>:", plan.messages[0].content);

  // console.log("Structured result1 HumanMessage arry 1 ===>:", plan.messages[1]);


  //  const result = JSON.parse(plan.content);
  const cleaned = plan.messages[1].content.replace(/<\|.*?\|>/g, "").trim();

  const result = cleaned;

  console.log("Structured result1 structured RESULTS ===>:", result);

  console.log("******************************************");
  return { plan: result };

  
} catch (err) {
  console.error("Agent did not return valid JSON:", err);
}
  
}


async function executeCodeGen(
  state: typeof PlanExecuteState.State,
  config?: RunnableConfig,
): Promise<Partial<typeof PlanExecuteState.State>> {
  console.log("Executing code generation with state:", typeof state.plan);

  console.log("Executing code generation with state parsed :", JSON.parse(state.plan));

  // console.log("Executing code generation with state input:", state.input);

  console.log("Executing code generation with state parsed typeof pased :", typeof JSON.parse(state.plan));

  const parsedPlan = JSON.parse(state.plan);


  console.log("Executing code generation with state  file  ==> :", parsedPlan.file);
  console.log("Executing code generation with state  action==> :", parsedPlan.action_to_take);


  console.log("Executing code generation with state  action to take ==> :", path.join(__dirname, parsedPlan.file));



  // Go one level up from __dirname
    // const baseDir = path.resolve(__dirname, '..');

    // Join with parsedPlan.file (or just the file name if it's relative)
    // const resolvedPath = path.join(baseDir, parsedPlan.file);

    const absolutePathBase = getProjectAbsolutePath();

    let resolvedPath: string;

    const file = parsedPlan.file;

    if (path.isAbsolute(file)) {
      resolvedPath = file;
    } else if (/cloned-repos[\\/]+repo-\d+/.test(file)) {
      // Case: cloned-repos\repo-1753257654006\package.json or with forward slashes
      const baseDir = path.resolve(__dirname, '..');
      resolvedPath = path.join(baseDir, file);
    } else {
      resolvedPath = path.join(absolutePathBase, file);
    }
  console.log("Resolved file path for code generation:", resolvedPath);
  // const fileContent = await readFileFunc(resolvedPath);

  // const newPath = `${getProjectAbsolutePath()}/src/server.js`

  const newPath = path.join(getProjectAbsolutePath(), '/src/server.js');


  // const fileContent = await readFileFunc(newPath);
  const fileContent = await readFileFunc(parsedPlan.file);



  // const fileContent = await readFileToolNode.invoke({
  //   file: parsedPlan.file,
  // });

  console.log("File content to generate code from fieCOntent:", fileContent);

  const prompt = `You are a code generation agent. Your task is to generate code based on the provided objective and file content.

  Objective: ${parsedPlan.action_to_take}
  File Content: ${JSON.stringify(fileContent)}
  Create a new updated file content putting into consideraion the objective.`;

  // console.log('the prrrrrrrrrrrrrr ===> ' + prompt)
  
  // const input = {
  //   messages: [new HumanMessage(prompt)],
  // };


  const act = `Insert the following code starting at line 6.  
  **Important:** Do NOT overwrite or remove any existing content in the file /src/server.js.  
  Append this snippet into the file, shifting existing lines downward as needed to preserve all original content.
  
  app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    next();
  });`

  //  action: parsedPlan.action_to_take,


  const input = {
  action: act,
  fileContent: JSON.stringify(fileContent),
  file: newPath
};



  // const result = await codeGenAgent.invoke({ action_to_take: parsedPlan.action_to_take, fileContent: fileContent });
  const result = await codeGenAgent.invoke(input);

  console.log("Code generation result codegenAgent: --------------------------------", result);

  return { code: result[1] };
}

async function reviewStep(
  state: typeof PlanExecuteState.State,
): Promise<Partial<typeof PlanExecuteState.State>> {
  console.log("Reviewing with state:", state);
  const plan = await reviewerAgent.invoke({ objective: state });
  
//   {objective}
// {editedFile}
  // const plan = await reviewerAgent.invoke({ objective: state,  });

  
  console.log("Review result:", plan);
  return { passOrFail: plan.passOrFail, feedback: plan.feedback };

  // return { plan: plan.steps };
}



async function replanStep(
  state: typeof PlanExecuteState.State,
): Promise<Partial<typeof PlanExecuteState.State>> {
  console.log("Replanning with state:", state);

  const planArray = JSON.parse(state.plan);
  const joinedPlan = planArray.map(
    (step: any) => `${step.step}. ${step.action}${step.file ? ` (File: ${step.file})` : ''}`
  ).join("\n");

  console.log("Replanning with joined plan:", joinedPlan);

  console.log("Replanning with past steps:", state.pastSteps);

  const pastStepsArray = state.pastSteps


  const formattedPastSteps = state.pastSteps
  .map(([step, result]: [any, string]) => {
    let stepText: string;

    try {
      stepText = typeof step === 'object'
        ? JSON.stringify(step, null, 2)
        : String(step);
    } catch (err) {
      stepText = `[Unserializable step: ${(err as Error).message}]`;
    }

    return `${stepText}:\n${result}`;
  })
  .join("\n\n");

  //  const JoinedPastSteps = pastStepsArray
  //     .map(([step, result]: [any, string]) => {
  //       const stepText = typeof step === 'object'
  //         ? JSON.stringify(step, null, 2)
  //         : String(step);
  //       return `${stepText}:\n${result}`;
  //     })
  //     .join("\n\n"),

  const output = await replannerAgent.invoke({
    input: state.input,
    plan: joinedPlan,
    pastSteps: formattedPastSteps,
  });

  console.log("Replanning output:", output);

  const toolCall = output[0];

  if (toolCall.type === "response") {
    return { response: toolCall.args?.response };
  }

  return { plan: toolCall.args?.steps };
}


export async function deploymentStep(
  state: typeof PlanExecuteState.State
): Promise<Partial<typeof PlanExecuteState.State>> {
  try {

    console.log(' I am here to deply')

    const branchName = state.plan?.branch ?? "feature/post-fix-branch";
    const commitMessage = state.plan?.commitMessage ?? "Auto fix commit from workflow";

    await deployToolNode.invoke({
      branch: branchName,
      commitMessage,
    });


    return {
      passOrFail: "Pass",
      feedback: "✅ Successfully deployed changes to branch",
    };
  } catch (err) {
    console.error("❌ Deployment failed:", err);
    return {
      passOrFail: "Fail",
      feedback: "❌ Failed to deploy changes",
    };
  }
}



function shouldEnd(state: typeof PlanExecuteState.State) {
  return state.response ? "true" : "false";
}

function routeReview(state: typeof PlanExecuteState.State) {
  // Route back to joke generator or end based upon feedback from the evaluator
  if (state.passOrFail === "pass") {
    return "Accepted";
  } else if (state.passOrFail === "fail") {
    return "Rejected + Feedback";
  }
}


app.post('/agent/run', (req, res) => {
  try {
    // Immediately send a temporary response to the client
    res.status(202).json({ message: 'Request received. Agent is processing in the background.' });

    // Start the agent logic in the background
    (async () => {
      console.log('The service has received your request, the agents will begin...');

      const workflow = new StateGraph(PlanExecuteState)
        .addNode("planner", planStep)
        .addNode("executer", executeStep)
        // .addNode("deploy", deploymentStep)
        .addEdge(START, "planner")
        .addEdge("planner", "executer")
        // .addEdge("executer", "deploy")
        .addEdge("executer", END);

      const app = workflow.compile({ checkpointer });

      const config = {
        recursionLimit: 50,
        configurable: { thread_id: "conversation-num-1" }
      };

      const inputs = {
        input: req.body.message
      };

      for await (const event of await app.stream(inputs, config)) {
        console.log(event);
      }

    })().catch(err => {
      console.error('Error in background agent process:', err);
    });

  } catch (error) {
    console.error('Failed to handle request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




// app.post('/agent/run', async (req, res) => {
//     try {


//       // await initializeWorkspace();
//         //  console.log('THE SERVICE HAS RECEIVED THE REQUEST ..' + JSON.stringify(req.body.message))
//         console.log('The service has received your request, the agents will begin...')

//             // const workflow = new StateGraph(PlanExecuteState)
//             //     .addNode("executer", executeStep)
//             //     // .addNode("replanner", replanStep)
//             //     .addEdge(START, "executer")
//             //     // .addEdge("planner", "executer")
//             //     // .addEdge("executer", "replanner")
//             //     // .addConditionalEdges("replanner", shouldEnd, {
//             //     //     true: END,
//             //     //     false: "executer",
//             //     // });



//         // const workflow = new StateGraph(PlanExecuteState)
//         //         .addNode("planner", planStep)
//         //         .addNode("executer", executeStep)
//         //         .addNode("replanner", replanStep)
//         //         .addEdge(START, "planner")
//         //         .addEdge("planner", "executer")
//         //         .addEdge("executer", "replanner")
//         //         .addConditionalEdges("replanner", shouldEnd, {
//         //             true: END,
//         //             false: "executer",
//         //         });

//         const workflow = new StateGraph(PlanExecuteState)
//                 .addNode("planner", planStep)
//                 // .addNode("codeGen", executeCodeGen)
//                 .addNode("executer", executeStep)
//                 // .addNode("deploy", deploymentStep) 
//                 .addEdge(START, "planner")
//                 .addEdge("planner", "executer")
//                 // .addEdge("planner", "codeGen")
//                 // .addEdge("codeGen", "executer")
//                 // .addEdge("executer", "deploy")
//                 // .addEdge("deploy", END);
//                 // .addEdge("executer", "reviewer")
//                 // .addEdge("reviewer", "replanner")
//                 // .addConditionalEdges("reviewer", shouldEnd, {
//                 //     true: END,
//                 //     false: "executer",
//                 // });
//                 // .addConditionalEdges("reviewer", routeReview, {
//                 //       "Accepted": END,
//                 //       "Rejected + Feedback": "executer",
//                 //   });

//         // Finally, we compile it!
//         // This compiles it into a LangChain Runnable,
//         // meaning you can use it as you would any other runnable
//         // const app = workflow.compile();
//         const app = workflow.compile({ checkpointer });


//         const config = { recursionLimit: 50, configurable: { thread_id: "conversation-num-1" } };

//         // const inputs = {
//         //   input: "what is the hometown of the 2024 Australian open winner?",
//         // };
//         const inputs = {
//           input: req.body.message,
//         };


//         for await (const event of await app.stream(inputs, config)) {
//         console.log(event);
//         }

        
//     } catch (error) {
//         console.log('The eror ' + error)
//     }
// });



app.post('/agent/webhook', async (req, res) => {

  const payload = req.body;

  const noderedBaseUrl = 'https://eager-stallion-super.ngrok-free.app';

      try {

    const response = await fetch(`${noderedBaseUrl}/agent2/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any other headers if required
        },
        body: JSON.stringify(payload), // Convert data to JSON format
        // body: data.body
      });


       console.log('THE LOG ===> ' + JSON.stringify(response));
  
      if (!response.ok) {
        throw new Error('Network response was not ok');
        return false;
      }
  
      // Request was successful
      if (response.ok) {
        console.log('POST request successful');
        return true;
      }
    } catch (error) {
      console.error('There was a problem with your fetch operation:', error);
      return false;
    }


  return true;



});








// Server startup logic
app.listen(port, async () => {
//   console.log('🚀 API Controller starting...');
await initializeWorkspace();
plannerAgent = getPlannerAgent(); // ✅ after initialization

  console.log('API is ready on port ', port);
});
