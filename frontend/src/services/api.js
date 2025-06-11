import axios from "axios";

const API_BASE_URL =
  "https://stu4986ple.execute-api.us-east-1.amazonaws.com/Prod";

// Configure axios with retry logic and timeouts
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Add retry interceptor
api.interceptors.response.use(undefined, async (err) => {
  const { config } = err;
  if (!config || !config.retry) {
    return Promise.reject(err);
  }
  config.retry -= 1;
  const delayRetry = new Promise((resolve) => {
    setTimeout(resolve, config.retryDelay || 1000);
  });
  await delayRetry;
  return api(config);
});

// Add request interceptor for retry configuration
api.interceptors.request.use((config) => {
  config.retry = 3; // Number of retries
  config.retryDelay = 1000; // Delay between retries in ms
  return config;
});

export const analyzeBusinessIdea = async (businessIdea) => {
  try {
    console.log("Starting business idea analysis...");

    // Make requests sequentially to avoid overwhelming the API
    console.log("Analyzing problem definition...");
    const problemDefinition = await api.post("/agents/problem-definition", {
      businessIdea,
    });

    console.log("Analyzing market size...");
    const marketAnalysis = await api.post("/agents/market-size", {
      businessIdea,
    });

    if (!problemDefinition.data || !marketAnalysis.data) {
      throw new Error("Invalid response from API");
    }

    // Calculate combined PMF score
    const combinedScore =
      (problemDefinition.data.score + marketAnalysis.data.score) / 2;

    console.log("Analysis complete!");
    return {
      problemDefinition: problemDefinition.data,
      marketAnalysis: marketAnalysis.data,
      combinedScore: parseFloat(combinedScore.toFixed(1)),
    };
  } catch (error) {
    console.error("Error analyzing business idea:", error);

    // Log detailed error information
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
      console.error("Response headers:", error.response.headers);
      throw new Error(
        error.response.data.error ||
          `API request failed with status ${error.response.status}`
      );
    } else if (error.request) {
      console.error(
        "Request was made but no response received:",
        error.request
      );
      throw new Error("No response received from API");
    } else {
      console.error("Error setting up request:", error.message);
      throw error;
    }
  }
};

export default api;
