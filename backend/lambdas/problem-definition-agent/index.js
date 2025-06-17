const axios = require("axios");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { Anthropic } = require("@anthropic-ai/sdk");
const cheerio = require("cheerio");

// Initialize clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-version": "2023-06-01",
  },
});

// Constants
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const MAX_REDDIT_POSTS = 50;
const MAX_COMMENTS_PER_POST = 100;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// Helper function to get Reddit access token
async function getRedditToken(retryCount = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  try {
    console.log("Getting Reddit access token...");

    // Validate environment variables
    if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
      throw new Error("Missing Reddit API credentials");
    }

    const response = await axios.post(
      "https://www.reddit.com/api/v1/access_token",
      `grant_type=client_credentials`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`
          ).toString("base64")}`,
        },
        timeout: 5000, // 5 second timeout
      }
    );

    if (!response.data || !response.data.access_token) {
      console.error(
        "Invalid response from Reddit token endpoint:",
        response.data
      );
      throw new Error("Failed to get Reddit access token: Invalid response");
    }

    console.log("Successfully obtained Reddit access token");
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting Reddit access token:", error.message);

    if (error.response) {
      console.error("Reddit API error response:", error.response.data);

      if (error.response.status === 401) {
        throw new Error(
          "Invalid Reddit API credentials. Please check your client ID and secret."
        );
      } else if (error.response.status === 429) {
        if (retryCount < MAX_RETRIES) {
          console.log(
            `Rate limited. Retrying in ${RETRY_DELAY}ms... (Attempt ${
              retryCount + 1
            }/${MAX_RETRIES})`
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
          return getRedditToken(retryCount + 1);
        }
        throw new Error(
          "Reddit API rate limit exceeded. Please try again later."
        );
      }
    }

    if (retryCount < MAX_RETRIES) {
      console.log(
        `Retrying in ${RETRY_DELAY}ms... (Attempt ${
          retryCount + 1
        }/${MAX_RETRIES})`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return getRedditToken(retryCount + 1);
    }

    throw new Error(
      `Failed to get Reddit access token after ${MAX_RETRIES} attempts: ${error.message}`
    );
  }
}

// Helper function to search Reddit
async function searchReddit(query, token) {
  const subreddits = [
    "startups",
    "entrepreneur",
    "smallbusiness",
    "business",
    "investing",
    "venturecapital",
    "producthunt",
    "indiehackers",
    "tech",
    "technology",
    "innovation",
    "futurology",
  ];

  const results = [];
  let rateLimitReset = 0;

  for (const subreddit of subreddits) {
    try {
      // Check if we need to wait for rate limit reset
      if (rateLimitReset > 0) {
        const waitTime = rateLimitReset * 1000; // Convert to milliseconds
        console.log(
          `Reddit rate limit reached. Waiting ${waitTime}ms before next request...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        rateLimitReset = 0;
      }

      const response = await axios.get(
        `https://oauth.reddit.com/r/${subreddit}/search`,
        {
          params: {
            q: query,
            limit: 10,
            sort: "relevance",
            t: "all",
          },
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": USER_AGENT,
          },
        }
      );

      // Check rate limit headers
      const remaining = parseInt(
        response.headers["x-ratelimit-remaining"] || "0"
      );
      const reset = parseInt(response.headers["x-ratelimit-reset"] || "0");

      if (remaining <= 1) {
        rateLimitReset = reset;
      }

      const posts = response.data.data.children.map((post) => ({
        title: post.data.title,
        text: post.data.selftext,
        score: post.data.score,
        num_comments: post.data.num_comments,
        created_utc: post.data.created_utc,
        url: post.data.url,
        subreddit: post.data.subreddit,
      }));

      results.push(...posts);

      // Add a small delay between requests to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`Subreddit ${subreddit} not found, skipping...`);
        continue;
      }
      if (error.response && error.response.status === 429) {
        // Rate limit hit, get reset time from headers
        rateLimitReset = parseInt(
          error.response.headers["x-ratelimit-reset"] || "60"
        );
        console.error(
          `Rate limit hit for subreddit ${subreddit}. Reset in ${rateLimitReset} seconds.`
        );
        // Continue to next iteration to wait and retry
        continue;
      }
      console.error(`Error searching subreddit ${subreddit}:`, error.message);
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, MAX_REDDIT_POSTS);
}

// Helper function to get post comments
async function getPostComments(postId, token) {
  try {
    const response = await axios.get(
      `https://oauth.reddit.com/comments/${postId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const comments = response.data[1].data.children
      .map((comment) => ({
        text: comment.data.body,
        score: comment.data.score,
        created_utc: comment.data.created_utc,
      }))
      .filter((comment) => comment.text && comment.text.length > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_COMMENTS_PER_POST);

    return comments;
  } catch (error) {
    console.error(`Error getting comments for post ${postId}:`, error);
    return [];
  }
}

// Helper function to get news data
async function getNewsData(query) {
  try {
    const response = await axios.get(`https://newsapi.org/v2/everything`, {
      params: {
        q: query,
        language: "en",
        sortBy: "relevancy",
        pageSize: 10,
      },
      headers: {
        "X-Api-Key": process.env.NEWS_API_KEY,
      },
    });

    return response.data.articles.map((article) => ({
      title: article.title,
      description: article.description,
      url: article.url,
      publishedAt: article.publishedAt,
      source: article.source.name,
    }));
  } catch (error) {
    console.error("Error fetching news data:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    return [];
  }
}

// Helper function to analyze data with Claude
async function analyzeWithClaude(businessIdea, data) {
  try {
    if (
      !businessIdea ||
      typeof businessIdea !== "string" ||
      !businessIdea.trim()
    ) {
      throw new Error("Invalid business idea provided to Claude analysis");
    }

    // Process and truncate Reddit data
    const processedRedditData = (data.reddit || []).slice(0, 5).map((post) => ({
      title: post.title || "",
      score: post.score || 0,
      num_comments: post.num_comments || 0,
      created_utc: post.created_utc || 0,
      url: post.url || "",
    }));

    // Process and truncate News data
    const processedNewsData = (data.news || []).slice(0, 3).map((article) => ({
      title: article.title || "",
      description: article.description || "",
      url: article.url || "",
    }));

    const prompt = `Analyze this business idea: "${businessIdea}"

Relevant Reddit discussions (top 5):
${JSON.stringify(processedRedditData, null, 2)}

Recent news (top 3):
${JSON.stringify(processedNewsData, null, 2)}

Provide a detailed analysis with these EXACT fields (do not modify the field names):
{
  "Problem Statement": "A clear, concise statement of the problem this business idea solves",
  "Target Market": "Detailed description of the target market, including demographics and size",
  "Market Size": "Estimated market size with supporting data",
  "Current Solutions": "Analysis of existing solutions and their limitations",
  "Pain Points": "Key pain points and challenges faced by the target market",
  "Opportunity": "Clear explanation of the business opportunity",
  "Risks": "Potential risks and challenges",
  "Score": number between 0-10,
  "Confidence": number between 0-1,
  "Reasoning": "Detailed explanation of the score and confidence level"
}

Format as JSON. Do not wrap the response in markdown code blocks.`;

    console.log("Sending request to Claude API...");
    console.log(
      "Using API key:",
      process.env.ANTHROPIC_API_KEY ? "Present" : "Missing"
    );

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY environment variable");
    }

    try {
      const response = await Promise.race([
        anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error("Claude API request timed out after 250 seconds")
              ),
            250000
          )
        ),
      ]);

      if (
        !response ||
        !response.content ||
        !response.content[0] ||
        !response.content[0].text
      ) {
        throw new Error("Invalid response format from Claude API");
      }

      console.log("Received response from Claude API");
      console.log("Response content:", response.content[0].text);

      // Clean the response text by removing markdown code blocks if present
      let cleanedText = response.content[0].text;
      if (cleanedText.includes("```json")) {
        cleanedText = cleanedText.replace(/```json\n|\n```/g, "");
      }

      let analysis;
      try {
        analysis = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error(
          "Failed to parse Claude's response as JSON:",
          cleanedText
        );
        throw new Error("Failed to parse Claude's response as JSON");
      }

      console.log("Parsed analysis:", analysis);

      // Validate the analysis has all required fields
      const requiredFields = [
        "Problem Statement",
        "Target Market",
        "Market Size",
        "Current Solutions",
        "Pain Points",
        "Opportunity",
        "Risks",
        "Score",
        "Confidence",
        "Reasoning",
      ];

      // Ensure all fields are present with correct names
      const normalizedAnalysis = {};
      const missingFields = [];
      requiredFields.forEach((field) => {
        // Check for exact match first
        if (analysis[field] !== undefined) {
          normalizedAnalysis[field] = analysis[field];
        } else {
          // Try snake_case version
          const snakeCase = field.toLowerCase().replace(/\s+/g, "_");
          if (analysis[snakeCase] !== undefined) {
            normalizedAnalysis[field] = analysis[snakeCase];
          } else {
            missingFields.push(field);
          }
        }
      });

      if (missingFields.length > 0) {
        throw new Error(
          `Missing required fields in Claude's response: ${missingFields.join(
            ", "
          )}`
        );
      }

      // Validate Score and Confidence are numbers
      if (typeof normalizedAnalysis.Score !== "number") {
        const score = Number(normalizedAnalysis.Score);
        if (isNaN(score)) {
          throw new Error("Invalid Score value: must be a number");
        }
        normalizedAnalysis.Score = score;
      }

      if (typeof normalizedAnalysis.Confidence !== "number") {
        const confidence = Number(normalizedAnalysis.Confidence);
        if (isNaN(confidence)) {
          throw new Error("Invalid Confidence value: must be a number");
        }
        normalizedAnalysis.Confidence = confidence;
      }

      // Validate Score and Confidence ranges
      if (normalizedAnalysis.Score < 0 || normalizedAnalysis.Score > 10) {
        throw new Error("Score must be between 0 and 10");
      }

      if (
        normalizedAnalysis.Confidence < 0 ||
        normalizedAnalysis.Confidence > 1
      ) {
        throw new Error("Confidence must be between 0 and 1");
      }

      return normalizedAnalysis;
    } catch (error) {
      if (error.response) {
        console.error("Claude API error response:", {
          status: error.response.status,
          data: error.response.data,
        });
        throw new Error(
          `Claude API error: ${error.response.status} - ${JSON.stringify(
            error.response.data
          )}`
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Error analyzing with Claude:", error.message);
    // Return fallback analysis instead of throwing
    return {
      "Problem Statement": `Initial analysis of "${businessIdea}" suggests a potential business opportunity. Further research needed.`,
      "Target Market": "Target market analysis pending additional data.",
      "Market Size": "Market size estimation requires more comprehensive data.",
      "Current Solutions":
        "Analysis of current solutions pending additional research.",
      "Pain Points":
        "Key pain points to be identified through further market research.",
      Opportunity: "Business opportunity requires additional validation.",
      Risks: "Risk assessment pending comprehensive analysis.",
      Score: 5,
      Confidence: 0.5,
      Reasoning:
        "Fallback analysis due to API error. Please try again later for a more detailed assessment.",
    };
  }
}

// Main handler function
exports.handler = async (event) => {
  console.log("Starting problem definition analysis...");
  console.log("Event:", JSON.stringify(event, null, 2));

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  try {
    // Validate environment variables
    const requiredEnvVars = [
      "ANTHROPIC_API_KEY",
      "REDDIT_CLIENT_ID",
      "REDDIT_CLIENT_SECRET",
      "DYNAMODB_TABLE_NAME",
    ];
    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingEnvVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(", ")}`
      );
    }

    // Parse the request body
    let body;
    try {
      console.log("Raw event body:", event.body);
      body = JSON.parse(event.body);
      console.log("Parsed request body:", body);
    } catch (error) {
      console.error("Error parsing request body:", error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Invalid request body: Must be valid JSON",
          details: error.message,
        }),
      };
    }

    // Extract and validate business idea
    const businessIdea = body.businessIdea;
    console.log("Extracted business idea:", businessIdea);
    console.log("Business idea type:", typeof businessIdea);

    if (
      !businessIdea ||
      typeof businessIdea !== "string" ||
      !businessIdea.trim()
    ) {
      console.error("Invalid business idea:", {
        value: businessIdea,
        type: typeof businessIdea,
        isEmpty: !businessIdea,
        isNotString: typeof businessIdea !== "string",
        isWhitespace: businessIdea && !businessIdea.trim(),
      });
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Business idea is required and must be a non-empty string",
          details: {
            value: businessIdea,
            type: typeof businessIdea,
          },
        }),
      };
    }

    const trimmedIdea = businessIdea.trim();
    console.log("Trimmed business idea:", trimmedIdea);

    // Get Reddit data
    console.log("Getting Reddit data...");
    let redditData = [];
    try {
      const redditToken = await getRedditToken();
      redditData = await searchReddit(trimmedIdea, redditToken);
      console.log("Reddit data retrieved:", redditData.length, "posts");
    } catch (error) {
      console.error("Error getting Reddit data:", error.message);
      // Continue execution - Reddit data is not critical
    }

    // Get news data
    console.log("Getting news data...");
    let newsData = [];
    try {
      newsData = await getNewsData(trimmedIdea);
      console.log("News data retrieved:", newsData.length, "articles");
    } catch (error) {
      console.error("Error getting news data:", error.message);
      // Continue execution - News data is not critical
    }

    // Analyze with Claude
    console.log("Analyzing with Claude...");
    let analysis;
    try {
      analysis = await analyzeWithClaude(trimmedIdea, {
        reddit: redditData,
        news: newsData,
      });
      console.log("Claude analysis complete:", analysis);
    } catch (error) {
      console.error("Error analyzing with Claude:", error.message);
      // Use fallback analysis from analyzeWithClaude
      analysis = await analyzeWithClaude(trimmedIdea, { reddit: [], news: [] });
    }

    // Save to DynamoDB
    const analysisId = `analysis_${Date.now()}`;
    try {
      await docClient.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_NAME,
          Item: {
            analysisId,
            type: "problem_definition",
            businessIdea: trimmedIdea,
            analysis,
            timestamp: new Date().toISOString(),
          },
        })
      );
      console.log("Analysis saved to DynamoDB with ID:", analysisId);
    } catch (error) {
      console.error("Error saving to DynamoDB:", error.message);
      // Continue execution - DynamoDB save is not critical
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          analysisId,
          type: "problem_definition",
          businessIdea: trimmedIdea,
          analysis: {
            problemStatement: analysis["Problem Statement"],
            targetMarket: analysis["Target Market"],
            marketSize: analysis["Market Size"],
            currentSolutions: analysis["Current Solutions"],
            painPoints: analysis["Pain Points"],
            opportunity: analysis["Opportunity"],
            risks: analysis["Risks"],
            score: analysis["Score"],
            confidence: analysis["Confidence"],
            reasoning: analysis["Reasoning"],
          },
          timestamp: new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    console.error("Error in problem definition analysis:", error);
    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
        details: error.stack,
      }),
    };
  }
};
