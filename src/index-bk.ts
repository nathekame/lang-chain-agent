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
import { setProjectFiles, setProjectPath, setProjectAbsolutePath } from './workspace';
import { getPlannerAgent } from './agents/planner';


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

//  process.env.PROJECT_FILES = await dFiles;

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
})


// const State = Annotation.Root({
//   messages: Annotation<BaseMessage[]>({
//     reducer: (x, y) => x.concat(y),
//   })
// })


async function executeStep(
  state: typeof PlanExecuteState.State,
  config?: RunnableConfig,
): Promise<Partial<typeof PlanExecuteState.State>> {
  // console.log('this is the state lenght ===> ' + JSON.stringify(state.plan.length))

  const task = state.plan[0];
  // const task = state.plan;

  // console.log('this is the TASK stringified ===> ' + JSON.stringify(task))
    // console.log('this is the TASK only ===> ' + task)

    // const formattedTask = task.replace(/"/g, '\\"'); // Escape quotes for JSON string
    // console.log('this is the TASK formatted ===> ' + formattedTask)

  const input = {
    messages: [new HumanMessage(JSON.stringify(task))],
  };


  const { messages } = await executerAgent.invoke(input, config);



  console.log("📜 Executed step:", task);
  console.log("📜 Executed messages:", messages);

  console.log("📜 Executed messages content:", messages[messages.length - 1].content.toString())
  console.log("📜 Executed messages content slice:", state.plan.slice(1));

  // const cleaned = plan.messages[1].content.replace(/<\|.*?\|>/g, "").trim();

  // const cleaned = state.plan.slice(1).replace(/<\|.*?\|>/g, "").trim();

  // console.log("📜 Executed messages cleaned content:", cleaned);


  const result = JSON.stringify(state.plan.slice(1));

  console.log("Structured result1 structured ===>:", result);


  // return {
  //   pastSteps: [[task, messages[messages.length - 1].content.toString()]],
  //   plan: state.plan.slice(1),
  // };
    return {
    pastSteps: [[task, messages[messages.length - 1].content.toString()]],
    plan: result,
  };
}

async function planStep(
  state: typeof PlanExecuteState.State,
): Promise<Partial<typeof PlanExecuteState.State>> {
  
  try {

      // const plannerAgent = await setupPlannerAgent();

    const plan = await plannerAgent.invoke({ objective: state.input });
  
  // console.log("Structured result1 HumanMessage length ===>:", plan.messages.length);


  console.log("Structured result1 HumanMessage ===>:", plan.messages[0].content);

  console.log("Structured result1 HumanMessage arry 1 ===>:", plan.messages[1]);

  // console.log("Structured result1 HumanMessage arry 3 ===>:", plan.messages[3]);
  // console.log("Structured result1 HumanMessage arry 3 content ===>:", plan.messages[3].content);


  // console.log("Structured result1 HumanMessage arry 4 ===>:", plan.messages[4]);


  //  const result = JSON.parse(plan.content);
  const cleaned = plan.messages[1].content.replace(/<\|.*?\|>/g, "").trim();

  const result = JSON.parse(cleaned);

  console.log("Structured result1 structured ===>:", result);

  return { plan: result };

  // const result = JSON.parse(plan.messages);

  // console.log("Structured result ===>:", result);

  
  // const steps = await extractStepsFromPlannerOutput(result);

  // console.log("Structured plan ===>:", steps);
  
} catch (err) {
  console.error("Agent did not return valid JSON:", err);
}
  
//   return { plan: plan.steps };
  // return { plan: plan.messages[3].content };

}


async function reviewStep(
  state: typeof PlanExecuteState.State,
): Promise<Partial<typeof PlanExecuteState.State>> {
  const plan = await reviewerAgent.invoke({ objective: state.input });
  return { plan: plan.steps };
}


// const reflectionNode = async (state: typeof State.State) => {
//   const { messages } = state;
//   // Other messages we need to adjust
//   const clsMap: { [key: string]: new (content: string) => BaseMessage } = {
//     ai: HumanMessage,
//     human: AIMessage,
//   };
//   // First message is the original user request. We hold it the same for all nodes
//   const translated = [
//     messages[0],
//     ...messages
//       .slice(1)
//       .map((msg) => new clsMap[msg._getType()](msg.content.toString())),
//   ];
//   const res = await reflect.invoke({ messages: translated });
//   // We treat the output of this as human feedback for the generator
//   return {
//     messages: [new HumanMessage({ content: res.content })],
//   };
// };

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
    // pastSteps: state.pastSteps
    //   .map(([step, result]: [any, string]) => {
    //     const stepText = typeof step === 'object'
    //       ? JSON.stringify(step, null, 2)
    //       : String(step);
    //     return `${stepText}:\n${result}`;
    //   })
    //   .join("\n\n"),
    pastSteps: formattedPastSteps,
  });

  console.log("Replanning output:", output);

  const toolCall = output[0];

  if (toolCall.type === "response") {
    return { response: toolCall.args?.response };
  }

  return { plan: toolCall.args?.steps };
}



// async function replanStep(
//   state: typeof PlanExecuteState.State,
// ): Promise<Partial<typeof PlanExecuteState.State>> {
//   console.log("Replanning with state:", state);

//   const planArray = JSON.parse(state.plan);
//   const joinedPlan = planArray.map(
//     (step: any) => `${step.step}. ${step.action}${step.file ? ` (File: ${step.file})` : ''}`
//   ).join("\n");

//   const output = await replannerAgent.invoke({
//     input: state.input,
//     // plan: state.plan.join("\n"),
//     plan: joinedPlan,
//     pastSteps: state.pastSteps
//       .map(([step, result]) => `${step}: ${result}`)
//       .join("\n"),
//     // pastSteps: state.pastSteps
//     //   .map(([step, result]: [any, string]) => {
//     //     const stepText = typeof step === 'object' ? JSON.stringify(step, null, 2) : step;
//     //     return `${stepText}:\n${result}`;
//     //   })
//     //   .join("\n\n"),

//   });
//   const toolCall = output[0];

//   if (toolCall.type == "response") {
//     return { response: toolCall.args?.response };
//   }

//   return { plan: toolCall.args?.steps };
// }

function shouldEnd(state: typeof PlanExecuteState.State) {
  return state.response ? "true" : "false";
}


app.post('/agent/run', async (req, res) => {
    try {


      // await initializeWorkspace();
        //  console.log('THE SERVICE HAS RECEIVED THE REQUEST ..' + JSON.stringify(req.body.message))
        console.log('The service has received your request, the agents will begin...')

        // const workflow = new StateGraph(PlanExecuteState)
        //         .addNode("planner", planStep)
        //         .addNode("executer", executeStep)
        //         .addNode("reviewer", reviewStep)
        //         .addNode("replanner", replanStep)
        //         .addEdge(START, "planner")
        //         .addEdge("planner", "executer")
        //         .addEdge("executer", "reviewer")
        //         .addEdge("reviewer", "replanner")
        //         .addConditionalEdges("replanner", shouldEnd, {
        //             true: END,
        //             false: "executer",
        //         });

        const workflow = new StateGraph(PlanExecuteState)
                .addNode("planner", planStep)
                .addNode("executer", executeStep)
                .addNode("replanner", replanStep)
                .addEdge(START, "planner")
                .addEdge("planner", "executer")
                .addEdge("executer", "replanner")
                .addConditionalEdges("replanner", shouldEnd, {
                    true: END,
                    false: "executer",
                });

        // Finally, we compile it!
        // This compiles it into a LangChain Runnable,
        // meaning you can use it as you would any other runnable
        const app = workflow.compile();

        const config = { recursionLimit: 50 };

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
