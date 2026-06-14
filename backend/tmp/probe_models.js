const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    // There isn't a direct listModels in the main SDK easily accessible like this
    // but we can try common names.
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp", "gemini-2.0-flash"];
    for (const m of models) {
      try {
        const model = genAI.getGenerativeModel({ model: m });
        const result = await model.generateContent("hi");
        console.log(`Model ${m} is available.`);
        break;
      } catch (e) {
        console.log(`Model ${m} failed: ${e.message}`);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

listModels();
