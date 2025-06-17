const { Anthropic } = require("@anthropic-ai/sdk");

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-version": "2023-06-01",
  },
});

const modelNames = [
  "claude-sonnet-4-20250514",
  "claude-3-sonnet-20240229",
  "claude-3-sonnet",
  "claude-3-opus-20240229",
  "claude-3-opus",
  "claude-2.1",
  "claude-2",
];

async function testModel(model) {
  try {
    console.log(`\nTesting model: ${model}`);
    const response = await anthropic.messages.create({
      model,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Hello, this is a test message.",
        },
      ],
    });
    console.log("Success! Response:", response);
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

async function runAll() {
  console.log("API Key present:", !!process.env.ANTHROPIC_API_KEY);
  for (const model of modelNames) {
    await testModel(model);
  }
}

// Run the test
runAll();
