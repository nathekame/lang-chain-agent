import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import { executerAgent } from './agent';
import { HumanMessage } from '@langchain/core/messages';
import ollama from 'ollama';
import * as tslab from "tslab";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { scanFolderFunc } from './tools/scan-folder';
import { setProjectFiles, setProjectPath, setProjectAbsolutePath } from './workspace';
import { reviewerAgent } from './agents/reviewer';
import { END, START, StateGraph } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { Annotation } from "@langchain/langgraph";
import { z } from "zod";

// import { scanFolderTool } from "./tools/scan-folder";
// import { readFileTool } from "./tools/read-file";
// import  { writeFileTool } from "./tools/write-file"
// import { backupFileTool } from "./tools/backup-file";
// import { backupFolderTool } from "./tools/backup-folder";
// import { restoreFileTool } from "./tools/restore-file";
// import { restoreFolderTool } from "./tools/restore-folder";
// import { workingDirectoryTool } from "./tools/get-working-directory";

// import { runCommandTool } from "./tools/run-command";

import { MemorySaver } from "@langchain/langgraph";



const memory = new MemorySaver();


dotenv.config();

const app = express();
const port = process.env.PORT || '8000';


app.use(express.json());
app.use(cors());

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

  console.log("🔍 Scanned files:", dFiles);
}


// const StateAnnotation = Annotation.Root({
//   joke: Annotation<string>,
//   topic: Annotation<string>,
//   feedback: Annotation<string>,
//   funnyOrNot: Annotation<string>,
// });

// const StateAnnotation = Annotation.Root({
//   action: Annotation<string>,
//   file: Annotation<string>,
//   feedback: Annotation<string>,
//   passOrFail: Annotation<string>,
// });

const StateAnnotation = Annotation.Root({
  input: Annotation<string>({
    reducer: (x, y) => y ?? x ?? "",
  }),
  action: Annotation<string[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  file: Annotation<string[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  feedback: Annotation<string[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  passOrFail: Annotation<string[]>({
    reducer: (x, y) => y ?? x ?? [],
  }),
  pastSteps: Annotation<[string, string][]>({
    reducer: (x, y) => x.concat(y),
  }),
  response: Annotation<string>({
    reducer: (x, y) => y ?? x,
  }),
})


// Schema for structured output to use in evaluation
// const feedbackSchema = z.object({
//   grade: z.enum(["funny", "not funny"]).describe(
//     "Decide if the joke is funny or not."
//   ),
//   feedback: z.string().describe(
//     "If the joke is not funny, provide feedback on how to improve it."
//   ),
// });

const feedbackSchema = z.object({
  grade: z.enum(["pass", "fail"]).describe(
    "Decide if the action taken on the file was successful or not, also check if the all code was formated well."
  ),
  feedback: z.string().describe(
    "If the action was not successful, provide feedback on how to improve it"
  ),
});



// const evaluator = reviewerAgent.withStructuredOutput(feedbackSchema);


const routeTask = (state: typeof GraphState.State) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  // If no tools are called, we can finish (respond to the user)
  if (!lastMessage.tool_calls?.length) {
    return "evaluator";
  }
  // Otherwise if there is, we continue and call the tools
  return "executer";
};


// const callModel = async (
//   state: typeof GraphState.State,
//   config?: RunnableConfig,
// ) => {
//   const { messages } = state;
//   const response = await executerAgent.invoke(messages, config);
//   return { messages: [response] };
// };


// const callExecuter = async (
//   state: typeof StateAnnotation.State,
//   config?: RunnableConfig,
// ) => {

//   let msg;
//   if (state.feedback) {
//     msg = await executerAgent.invoke(
//       `Make the appropriate tool calls to carry out this action ${state.action} on this file ${state.file}, but take into account the feedback: ${state.feedback}`
//     );
//   } else {
//     msg = await executerAgent.invoke(
//         `Make the appropriate tool calls to carry out this action ${state.action} on this file ${state.file}`
//     );
//   }
//   // return { response: msg.content };

//   console.log('The message content is:', msg);

//   //   return {
//   //     problem: msg.problem,
//   //     file: msg.file,
//   //     action_taken: msg.action_taken
//   // };

//     return {
//       msg
//   };

// //   const { messages } = state;
// //   const response = await executerAgent.invoke(messages, config);
// //   return { messages: [response] };


// };


const callExecuter = async (
  state: typeof StateAnnotation.State,
  config?: RunnableConfig,
) => {
  console.log('The state is:', JSON.stringify(state.content));
  const prompt = state.feedback
    ? `Make the appropriate tool calls to carry out this action ${state.action} on this file ${state.file}, but take into account the feedback: ${state.feedback}`
    : `Make the appropriate tool calls to carry out this action ${state.action} on this file ${state.file}`;

  const result = await executerAgent.invoke({ input: prompt });

  console.log('The message content is:', result);

  // 🔁 LangGraph React Agent returns an async iterable, so we iterate
  let finalStep;
  for await (const step of result) {
    console.log("Step:", step);  // ✅ This is where you inspect each step
    finalStep = step;            // Store the most recent step
  }

  if (!finalStep) throw new Error("No steps returned from agent");

  // ✅ Return tool calls if present
  if (finalStep.tool_calls && finalStep.tool_calls.length > 0) {
    return {
      commands: finalStep.tool_calls,
    };
  }

  // ✅ Return structured output as a message if present
  if (finalStep.output) {
    return {
      messages: [
        {
          role: "assistant",
          content: `Action Taken: ${finalStep.output.action_taken}`,
              metadata: {
              file: finalStep.output.file,
              problem: finalStep.output.problem,
              // timestamp: new Date().toISOString()
            }
        },
      ],
    };
  }

  // ✅ Or return raw messages
  if (finalStep.messages) {
    return {
      messages: finalStep.messages,
    };
  }

  throw new Error("Agent did not return tool calls or messages.");
};


// Nodes
// async function llmCallGenerator(state: typeof StateAnnotation.State) {
//   // LLM generates a joke
//   let msg;
//   if (state.feedback) {
//     msg = await llm.invoke(
//       `Write a joke about ${state.topic} but take into account the feedback: ${state.feedback}`
//     );
//   } else {
//     msg = await llm.invoke(`Write a joke about ${state.topic}`);
//   }
//   return { joke: msg.content };
// }

async function callEvaluator(state: typeof StateAnnotation.State) {
  // LLM evaluates the fix 
  // const grade = await reviewerAgent.invoke(`Grade the fix ${state.response}`);
   const grade = await reviewerAgent.invoke(`Grade the fix ${state.msg}`);

  return { passOrFail: grade.grade, feedback: grade.feedback };
}

// Conditional edge function to route back to joke generator or end based upon feedback from the evaluator
// function routeJoke(state: typeof StateAnnotation.State) {
//   // Route back to joke generator or end based upon feedback from the evaluator
//   if (state.funnyOrNot === "funny") {
//     return "Accepted";
//   } else if (state.funnyOrNot === "not funny") {
//     return "Rejected + Feedback";
//   }
// }

function routeReview(state: typeof StateAnnotation.State) {
  // Route back to joke generator or end based upon feedback from the evaluator
  if (state.passOrFail === "pass") {
    return "Accepted";
  } else if (state.passOrFail === "fail") {
    return "Rejected + Feedback";
  }
}




app.post('/agent/run', async (req, res) => {
    try {
        // const result = await agent.invoke({
        //     messages: [
        //         new HumanMessage("You are a helpful assistant that translates English to French. Translate the user sentence."),
        //         new HumanMessage("I love programming.")
        //     ]
        // });

    //    const runFunct = await run('llama3.1:8b', req.body.message).catch(error => console.error("An error occurred:", error));

// llama3-chatqa:8b

        console.log('The service has received your request, the agents will begin...')


        // Build workflow
        // const optimizerWorkflow = new StateGraph(StateAnnotation)
        // .addNode("llmCallGenerator", llmCallGenerator)
        // .addNode("llmCallEvaluator", llmCallEvaluator)
        // .addEdge("__start__", "llmCallGenerator")
        // .addEdge("llmCallGenerator", "llmCallEvaluator")
        // .addConditionalEdges(
        //     "llmCallEvaluator",
        //     routeJoke,
        //     {
        //     // Name returned by routeJoke : Name of next node to visit
        //     "Accepted": "__end__",
        //     "Rejected + Feedback": "llmCallGenerator",
        //     }
        // )
        // .compile();


        // const workflow = new StateGraph(GraphState)
        //     .addNode("agent", callExecuter)
        //     .addNode("tools", toolNode)
        //     .addNode("evaluator", callEvaluator)
        //     .addEdge(START, "agent")
        //     .addEdge("tools", "agent")
        //     .addConditionalEdges("agent", routeMessage)
        //     .addConditionalEdges("evaluator", routeTask, {
        //         "Accepted": END,
        //         "Rejected + Feedback": "agent",
        //     })
          
        const workflow = new StateGraph(StateAnnotation)
            .addNode("agent", callExecuter)
            .addNode("evaluator", callEvaluator)
            .addEdge(START, "agent")
            .addEdge("agent", "evaluator")
            .addConditionalEdges("agent", routeTask)
            .addConditionalEdges("evaluator", routeReview, {
                "Accepted": END,
                "Rejected + Feedback": "agent",
            });

            const graph = workflow.compile();

            // const graph = workflow.compile({ checkpointer: memory });

            // .addNode("deploymentTool", deploymentToolNode)




        let inputs = { messages: [{ role: "user", content: req.body.message }] };

        console.log('The inputs are:', inputs);
        // config = { configurable: { thread_id: "conversation-1" } };

        // inputs = { messages: [{ role: "user", content: "Remember my name?" }] };
        // for await (
        //   const { messages } of await graph.stream(inputs, {
        //       // ...config,
        //     streamMode: "values",
        //   })
        // ) {
        //   let msg = messages[messages?.length - 1];
        //   if (msg?.content) {
        //     console.log(msg.content);
        //   } else if (msg?.tool_calls?.length > 0) {
        //     console.log(msg.tool_calls);
        //   } else {
        //     console.log(msg);
        //   }
        //   console.log("-----\n");

        // }


       const result = await graph.invoke(inputs);

       console.log('The result is:', result);

        // Get the last message, if available
        const messages = result.messages ?? [];
        const lastMsg = messages[messages.length - 1];

        if (lastMsg?.content) {
          console.log(lastMsg.content);
        } else if (lastMsg?.tool_calls?.length > 0) {
          console.log(lastMsg.tool_calls);
        } else {
          console.log(lastMsg);
        }

        console.log("-----\n");



        // let inputs = {
        //     messages: [
        //         { role: "user", content: '' }
        //     ]
        // };

        // let stream = await executerAgent.invoke(inputs, {
        // streamMode: "values",
        // });

        // let result = await executerAgent.invoke(inputs);


        // for await (const { messages } of result) {
        // let msg = messages[messages?.length - 1];
        // if (msg?.content) {
        //     console.log(msg.content);
        // } else if (msg?.tool_calls?.length > 0) {
        //     console.log(msg.tool_calls);
        // } else {
        //     console.log(msg);
        // }
        // console.log("-----\n");
        // }

      // --- invoke equivalent of stream
        // let result = await executerAgent.invoke(inputs);

        // let msg = result?.messages?.[result.messages.length - 1] ?? result;
        // if (msg?.content) {
        // console.log('The message content is:', msg.content);
        // } else if (msg?.tool_calls?.length > 0) {
        // console.log('The tool calls are:', msg.tool_calls);
        // } else {
        // console.log('The message is:', msg);
        // }
        // console.log("--------------\n");



        // const graph = await executerAgent.getGraph();
        // const image = await graph.drawMermaidPng();
        // const arrayBuffer = await image.arrayBuffer();

        // await tslab.display.png(new Uint8Array(arrayBuffer));

        // const result = await agent.invoke({
        //     messages: [
        //         new HumanMessage(req.body.message),
        //     ]
        // });
        // You can send the result back in the response if needed
        // res.json({ runFunct });
        res.json({ result });

        
    } catch (error) {
        console.log('The eror ' + error)
    }
});








// Server startup logic
app.listen(port, async () => {
    await initializeWorkspace();
    console.log('✅ Workspace initialized successfully');
  console.log('🚀 API Controller starting...');
  console.log('✅ API Controller fully ready on port', port);
});
