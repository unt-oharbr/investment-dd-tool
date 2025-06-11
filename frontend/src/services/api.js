import axios from "axios";

const API_BASE_URL =
  "https://stu4986ple.execute-api.us-east-1.amazonaws.com/Prod";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const analyzeBusinessIdea = async (businessIdea) => {
  try {
    const [problemDefinition, marketAnalysis] = await Promise.all([
      api.post("/agents/problem-definition", { businessIdea }),
      api.post("/agents/market-size", { businessIdea }),
    ]);

    if (!problemDefinition.data || !marketAnalysis.data) {
      throw new Error("Invalid response from API");
    }

    // Calculate combined PMF score
    const combinedScore =
      (problemDefinition.data.score + marketAnalysis.data.score) / 2;

    return {
      problemDefinition: problemDefinition.data,
      marketAnalysis: marketAnalysis.data,
      combinedScore: parseFloat(combinedScore.toFixed(1)),
    };
  } catch (error) {
    console.error("Error analyzing business idea:", error);
    if (error.response) {
      throw new Error(error.response.data.error || "API request failed");
    }
    throw error;
  }
};

export default api;
