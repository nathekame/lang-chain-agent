import fetch from "node-fetch"; // or: import axios from "axios";

app.post('/agent/run', async (req, res) => {
  try {
    const webhookUrl = req.body.webhookUrl || "https://host.docker.internal:1880/agent/webhook";
    const message = req.body.message;

    console.log('The service has received your request, the agents will begin...');

    const workflow = new StateGraph(PlanExecuteState)
      .addNode("planner", planStep)
      .addNode("executer", executeStep)
      .addNode("reviewer", reviewStep)
      .addNode("replanner", replanStep)
      .addEdge(START, "planner")
      .addEdge("planner", "executer")
      .addEdge("executer", "reviewer")
      .addEdge("reviewer", "replanner")
      .addConditionalEdges("replanner", shouldEnd, {
        true: END,
        false: "executer",
      });

    const app = workflow.compile();
    const config = { recursionLimit: 50 };
    const inputs = { input: message };

    let finalState: any;

    for await (const event of await app.stream(inputs, config)) {
      if (event && event.value && event.value.response) {
        finalState = event.value; // capture final output
      }
    }

    // Send the final result to webhook if specified
    if (webhookUrl && finalState?.response) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: finalState.response,
          input: message,
          pastSteps: finalState.pastSteps,
        })
      });
      console.log("Webhook notified:", webhookUrl);
    }

    // Respond back to the user too
    res.json({
      status: "completed",
      result: finalState?.response ?? null,
      steps: finalState?.pastSteps ?? [],
    });

  } catch (error) {
    console.log(' Error:', error);
    res.status(500).json({ error: "An error occurred." });
  }
});
