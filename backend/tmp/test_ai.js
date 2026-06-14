const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });
    
    console.log("Testing model: gemini-1.5-flash");
    const result = await model.generateContent("Give me a sample JSON object with one key 'status' and value 'ok'");
    const response = await result.response;
    console.log("Response text:", response.text());
    JSON.parse(response.text());
    console.log("Successfully parsed JSON!");
  } catch (e) {
    console.error("Error during AI test:", e);
  }
}

test();
