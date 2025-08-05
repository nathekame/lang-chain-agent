import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { agent, agentWithTools } from './agent';
import { HumanMessage } from '@langchain/core/messages';
import ollama from 'ollama';


dotenv.config();

const app = express();
const port = process.env.PORT || '8000';


app.use(express.json());
app.use(cors());






// Add two numbers function
function addTwoNumbers(args: { a: number, b: number }): number {
    return args.a + args.b;
}

// Subtract two numbers function 
function subtractTwoNumbers(args: { a: number, b: number }): number {
    return args.a - args.b;
}



const addTwoNumbersTool = {
    type: 'function',
    function: {
        name: 'addTwoNumbers',
        description: 'Add two numbers together',
        parameters: {
            type: 'object',
            required: ['a', 'b'],
            properties: {
                a: { type: 'number', description: 'The first number' },
                b: { type: 'number', description: 'The second number' }
            }
        }
    }
};



// Tool definition for subtract function
const subtractTwoNumbersTool = {
    type: 'function',
    function: {
        name: 'subtractTwoNumbers',
        description: 'Subtract two numbers',
        parameters: {
            type: 'object',
            required: ['a', 'b'],
            properties: {
                a: { type: 'number', description: 'The first number' },
                b: { type: 'number', description: 'The second number' }
            }
        }
    }
};




// async function run(model: string, msg: string) {
//     // const msg = 'What is three minus one?'
//     const messages = [{ role: 'user', content: msg }];
//     console.log('Prompt:', messages[0].content);

//     const availableFunctions = {
//         addTwoNumbers: addTwoNumbers,
//         subtractTwoNumbers: subtractTwoNumbers
//     };

//     const response = await ollama.chat({
//         model: model,
//         messages: messages,
//         tools: [addTwoNumbersTool, subtractTwoNumbersTool]
//     });

//     let output: number;
//     if (response.message.tool_calls) {
//         // Process tool calls from the response
//         for (const tool of response.message.tool_calls) {
//             const functionToCall = availableFunctions[tool.function.name];
//             if (functionToCall) {
//                 console.log('Calling function:', tool.function.name);
//                 console.log('Arguments:', tool.function.arguments);
//                 output = functionToCall(tool.function.arguments);
//                 console.log('Function output:', output);

//                 // Add the function response to messages for the model to use
//                 messages.push(response.message);
//                 messages.push({
//                     role: 'tool',
//                     content: output.toString(),
//                 });
//             } else {
//                 console.log('Function', tool.function.name, 'not found');
//             }
//         }

//         // Get final response from model with function outputs
//         const finalResponse = await ollama.chat({
//             model: model,
//             messages: messages
//         });
//         console.log('Final response:', finalResponse.message.content);
//     } else {
//         console.log('No tool calls returned from model');
//     }
// }







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

        const result = await agent.invoke({
            messages: [
                new HumanMessage(req.body.message),
            ]
        });
        // You can send the result back in the response if needed
        // res.json({ runFunct });
        res.json({ result });

        
    } catch (error) {
        console.log('The eror ' + error)
    }
});








// Server startup logic
app.listen(port, async () => {
  console.log('🚀 API Controller starting...');
  console.log('✅ API Controller fully ready on port 8000', port);
});
