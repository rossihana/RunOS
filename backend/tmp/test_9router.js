const OpenAI = require('openai');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend folder
dotenv.config({ path: path.join(__dirname, '../.env') });

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || 'no-key',
  baseURL: process.env.NINEROUTER_BASE_URL || 'http://localhost:20128/v1'
});

async function test() {
  console.log("Testing connection to 9Router...");
  console.log("Base URL:", process.env.NINEROUTER_BASE_URL);
  
  try {
    // Tahap 1: Cek apakah API Key valid dengan melist model
    console.log("Checking available models...");
    const models = await openai.models.list();
    console.log("API Key Valid! Model yang tersedia di 9Router kamu:");
    models.data.forEach(m => console.log("- " + m.id));

    // Tahap 2: Coba kirim chat
    console.log("\nTrying to chat with model: gemini/gemini-2.5-flash");
    const response = await openai.chat.completions.create({
      model: "gemini/gemini-2.5-flash", 
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Say hello!" }
      ],
    });

    console.log("Response from AI:");
    console.log(response.choices[0].message.content);
    console.log("\nSuccess! Integrasi 9Router berhasil.");
  } catch (error) {
    console.error("Error dari 9Router:");
    console.error("Status:", error.status);
    console.error("Message:", error.message);
    
    if (error.status === 401) {
      console.log("\n[SOLUSI] 401 berarti API Key di .env salah atau 9Router perlu di-restart.");
    }
  }
}

test();
