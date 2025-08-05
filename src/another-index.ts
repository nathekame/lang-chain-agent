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

const checkpointer = new MemorySaver();



dotenv.config();

const app = express();
const port = process.env.PORT || '8000';


app.use(express.json());
app.use(cors());

let plannerAgent: any;


const CLONE_BASE = './cloned-repos';
if (!fs.existsSync(CLONE_BASE)) fs.mkdirSync(CLONE_BASE);

let projectPath = null;


async function initializeWorkspace() {
  const repoUrl = process.env.TARGET_REPO_URL;
  if (!repoUrl) {
    console.error('ERROR: TARGET_REPO_URL environment variable is not set.');
    process.exit(1);
  }

  const timestamp = Date.now();
  projectPath = path.join(CLONE_BASE, `repo-${timestamp}`);
  await simpleGit().clone(repoUrl, projectPath);
  console.log(`✅ Repo cloned into ${projectPath}`);

  // process.env.PROJECT_FOLDER = projectPath;

 const dFiles = await scanFolderFunc(projectPath);

const projectAbsolutePath = path.resolve(projectPath);

  // Store in shared state
  setProjectAbsolutePath(projectAbsolutePath);
  setProjectPath(projectPath);
  setProjectFiles(dFiles);

//  console.log("THE FILESSSS process.env.PROJECT_FILES =>", JSON.stringify(process.env.PROJECT_FILES));

  // console.log("THE FILESSSS =>", dFiles.files);

  // fsAgentProcess = spawn('node', ['../fs-agent/index.js'], {
  //   env: { ...process.env, PROJECT_FOLDER: projectPath }
  // });

  // fsAgentProcess.stdout.on('data', (data) => console.log(`[FS Agent] ${data.toString()}`));
  // fsAgentProcess.stderr.on('data', (data) => console.error(`[FS Agent Error] ${data.toString()}`));
  console.log("🔍 Scanned files:", dFiles);
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
  console.log("Executing with state plan:==> ", state.plan);

    console.log("******************************************");

  // const actionTake = await extractActions(state.plan);

  // console.log("Extracted action to take: ====> ", actionTake);

  // const task = state.plan[0];
  const task = state.plan;

  // const task = actionTake[0];


  // console.log("Executing task THE ATSKK ===>   : ", task);

  const dTask = `${task},  If a file needs to be updated:
  - Use the **search file** tool to locate the file.
  - Use the **backup file** tool to create a backup before making any changes.
  - Use the **read file** tool to inspect the current contents.
  - Generate the updated version of the file, including all required changes.
  - Use the **write file** tool to overwrite the file with the new content.
  
  If a command needs to be executed, use the **run command** tool in the project root directory.`;


  const cookedTask = `append this "app.use((req, res, next) => {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    next();
  });" to ${path.join(getProjectAbsolutePath(), 'server.js')} server.js file `
  // const input = {
  //   messages: [new HumanMessage(JSON.stringify(task))],
  // };

  const input = {
    messages: [new HumanMessage(cookedTask)],
  };

//  const data = `echo "<script>function greet() { alert('Hello, world!'); }</script>" > C:\\Users\nathe\humber\oracle-lens\node-next\ts-agent\cloned-repos\repo-1753211957330\src\index.html`;
  console.log("Executing input messages:", input.messages[0]);
  // const input = {
  //   messages: [new HumanMessage('Please run the following command: ' + data)],
  // };

  // const { messages } = await executerAgent.invoke(input, config);
  const res = await executerAgent.invoke(input, config);

  console.log("Executed result ====>>>>> :", res);



  // console.log("📜 Executed step:", task);
  // console.log("📜 Executed messages:", messages);

  // console.log("📜 Executed messages content:", messages[messages.length - 1].content.toString())
  // console.log("📜 Executed messages content slice:", state.plan.slice(1));


  // const result = JSON.stringify(state.plan.slice(1));

  // console.log("Structured result1 structured ===>:", result);


    return {
    
    // pastSteps: [[task, messages[messages.length - 1].content.toString()]],
    pastSteps: [task],
    plan: res,
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



app.post('/agent/run', async (req, res) => {
    try {


      // await initializeWorkspace();
        //  console.log('THE SERVICE HAS RECEIVED THE REQUEST ..' + JSON.stringify(req.body.message))
        console.log('The service has received your request, the agents will begin...')


        // const workflow = new StateGraph(PlanExecuteState)
        //         .addNode("planner", planStep)
        //         .addNode("executer", executeStep)
        //         .addNode("replanner", replanStep)
        //         .addEdge(START, "planner")
        //         .addEdge("planner", "executer")
        //         .addEdge("executer", "replanner")
        //         .addConditionalEdges("replanner", shouldEnd, {
        //             true: END,
        //             false: "executer",
        //         });

        const workflow = new StateGraph(PlanExecuteState)
                .addNode("planner", planStep)
                .addNode("executer", executeStep)
                // .addNode("reviewer", reviewStep)
                // .addNode("replanner", replanStep)
                .addEdge(START, "planner")
                .addEdge("planner", "executer")
                // .addEdge("executer", "reviewer")
                // .addEdge("reviewer", "replanner")
                // .addConditionalEdges("reviewer", shouldEnd, {
                //     true: END,
                //     false: "executer",
                // });
                // .addConditionalEdges("reviewer", routeReview, {
                //       "Accepted": END,
                //       "Rejected + Feedback": "executer",
                //   });

        // Finally, we compile it!
        // This compiles it into a LangChain Runnable,
        // meaning you can use it as you would any other runnable
        // const app = workflow.compile();
        const app = workflow.compile({ checkpointer });


        const config = { recursionLimit: 50, configurable: { thread_id: "conversation-num-1" } };

        // const inputs = {
        //   input: "what is the hometown of the 2024 Australian open winner?",
        // };
        const inputs = {
          input: req.body.message,
        };


        for await (const event of await app.stream(inputs, config)) {
        console.log(event);
        }

        
    } catch (error) {
        console.log('The eror ' + error)
    }
});








// Server startup logic
app.listen(port, async () => {
//   console.log('🚀 API Controller starting...');
await initializeWorkspace();
plannerAgent = getPlannerAgent(); // ✅ after initialization

  console.log('API is ready on port ', port);
});
