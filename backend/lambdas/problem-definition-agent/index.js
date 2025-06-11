const AWS = require("aws-sdk");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const axios = require("axios");

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Reddit API configuration
const REDDIT_API_BASE = "https://oauth.reddit.com";
const RELEVANT_SUBREDDITS = [
  "entrepreneur",
  "startups",
  "smallbusiness",
  "business",
  "sidehustle",
  "indiebiz",
];

// Initialize Reddit API client
const getRedditToken = async () => {
  const auth = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      "https://www.reddit.com/api/v1/access_token",
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Failed to get Reddit token:", error);
    throw error;
  }
};

// Search Reddit for discussions
const searchReddit = async (query, token) => {
  const searchResults = [];

  for (const subreddit of RELEVANT_SUBREDDITS) {
    try {
      const response = await axios.get(
        `${REDDIT_API_BASE}/r/${subreddit}/search`,
        {
          params: {
            q: query,
            limit: 25,
            sort: "relevance",
            t: "all",
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      searchResults.push(...response.data.data.children);
    } catch (error) {
      console.error(`Error searching r/${subreddit}:`, error);
    }
  }

  return searchResults;
};

// Analyze Reddit data and calculate scores
const analyzeRedditData = (posts) => {
  if (!posts.length) {
    return {
      score: 0,
      breakdown: {
        clarity: 0,
        evidence: 0,
        urgency: 0,
        frequency: 0,
      },
      confidence: 0.3,
      reasoning: "No relevant discussions found",
    };
  }

  // Calculate metrics
  const totalPosts = posts.length;
  const totalComments = posts.reduce(
    (sum, post) => sum + post.data.num_comments,
    0
  );
  const postScore = posts.reduce((sum, post) => sum + post.data.score, 0);

  // Calculate urgency indicators
  const urgencyWords = [
    "urgent",
    "critical",
    "pain",
    "problem",
    "need",
    "must",
    "help",
  ];
  const urgencyCount = posts.reduce((count, post) => {
    const text = `${post.data.title} ${post.data.selftext}`.toLowerCase();
    return count + urgencyWords.filter((word) => text.includes(word)).length;
  }, 0);

  // Calculate scores
  const clarity = Math.min(3, (postScore / (totalPosts * 100)) * 3);
  const evidence = Math.min(3, (totalPosts / 50) * 3);
  const urgency = Math.min(2, (urgencyCount / (totalPosts * 2)) * 2);
  const frequency = Math.min(2, (totalComments / (totalPosts * 10)) * 2);

  const totalScore = clarity + evidence + urgency + frequency;
  const confidence = Math.min(0.9, 0.3 + totalPosts / 100);

  return {
    score: parseFloat(totalScore.toFixed(1)),
    breakdown: {
      clarity: parseFloat(clarity.toFixed(1)),
      evidence: parseFloat(evidence.toFixed(1)),
      urgency: parseFloat(urgency.toFixed(1)),
      frequency: parseFloat(frequency.toFixed(1)),
    },
    confidence: parseFloat(confidence.toFixed(1)),
    reasoning: `Analyzed ${totalPosts} relevant discussions across ${RELEVANT_SUBREDDITS.length} subreddits. Found ${totalComments} comments and ${urgencyCount} urgency indicators.`,
  };
};

// Fallback to mock analysis
const getMockAnalysis = (businessIdea) => ({
  score: 7.5,
  breakdown: {
    clarity: 2.5,
    evidence: 2.0,
    urgency: 1.5,
    frequency: 1.5,
  },
  confidence: 0.8,
  reasoning: "Mock analysis - Reddit API research failed",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

exports.handler = async (event) => {
  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const { businessIdea } = JSON.parse(event.body || "{}");

    if (!businessIdea) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing required parameter: businessIdea",
        }),
      };
    }

    let analysis;
    try {
      // Get Reddit token and search for discussions
      const token = await getRedditToken();
      const searchResults = await searchReddit(businessIdea, token);
      analysis = analyzeRedditData(searchResults);
    } catch (error) {
      console.error("Reddit API error:", error);
      analysis = getMockAnalysis(businessIdea);
    }

    // Add metadata
    const fullAnalysis = {
      analysisId: `pd-${Date.now()}`,
      timestamp: new Date().toISOString(),
      businessIdea,
      ...analysis,
    };

    // Store in DynamoDB
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    await dynamoClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(fullAnalysis),
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(fullAnalysis),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
