const axios = require("axios");
const cheerio = require("cheerio");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { Anthropic } = require("@anthropic-ai/sdk");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

// Initialize clients
const docClient = new DynamoDBDocumentClient(new DynamoDBClient(), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
const secretsClient = new SecretsManagerClient();

// Function to get secret value
async function getSecret(secretName) {
  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });
    const response = await secretsClient.send(command);
    return response.SecretString;
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error);
    throw error;
  }
}

// Initialize Anthropic client with secret
let anthropic;
async function initializeAnthropic() {
  try {
    const apiKey = await getSecret("/investment-dd/anthropic-api-key");
    console.log("Successfully retrieved Anthropic API key");
    anthropic = new Anthropic({
      apiKey: apiKey,
    });
  } catch (error) {
    console.error("Failed to initialize Anthropic client:", error);
    throw error;
  }
}

// Constants
const USER_AGENT = "Investment-DD-Tool/1.0 (Research Agent)";
const DELAY_MS = 2000;
const MAX_RETRIES = 5;
const MAX_COMPETITORS = 10;
const MAX_SEARCH_QUERIES = 5;
const MAX_REDDIT_POSTS = 50;

// Helper function to get Reddit access token
async function getRedditToken(retryCount = 0) {
  try {
    console.log("Getting Reddit access token...");
    const clientId = await getSecret("/investment-dd/reddit-client-id");
    const clientSecret = await getSecret("/investment-dd/reddit-client-secret");

    if (!clientId || !clientSecret) {
      throw new Error("Missing Reddit API credentials");
    }

    const response = await axios.post(
      "https://www.reddit.com/api/v1/access_token",
      "grant_type=client_credentials",
      {
        auth: {
          username: clientId,
          password: clientSecret,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
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
      }
    }

    if (retryCount < MAX_RETRIES) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers["retry-after"] || 60;
        console.log(
          `Reddit API rate limit exceeded. Retrying after ${retryAfter} seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return getRedditToken(retryCount + 1);
      }

      const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
      console.log(`Retrying in ${backoffMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
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
    "stocks",
    "finance",
    "technology",
    "producthunt",
    "indiehackers",
  ];

  const results = [];
  let rateLimitReset = 0;

  for (const subreddit of subreddits) {
    try {
      if (rateLimitReset > 0) {
        const waitTime = rateLimitReset * 1000;
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

      if (response.data?.data?.children) {
        results.push(
          ...response.data.data.children.map((post) => ({
            title: post.data.title,
            url: `https://reddit.com${post.data.permalink}`,
            score: post.data.score,
            comments: post.data.num_comments,
            created: new Date(post.data.created_utc * 1000).toISOString(),
            subreddit: post.data.subreddit,
            author: post.data.author,
            selftext: post.data.selftext,
          }))
        );
      }
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`Subreddit ${subreddit} not found, skipping...`);
        continue;
      }

      if (error.response?.status === 429) {
        rateLimitReset = parseInt(
          error.response.headers["retry-after"] || "60"
        );
        console.log(
          `Rate limit hit for subreddit ${subreddit}. Reset in ${rateLimitReset} seconds.`
        );
        continue;
      }

      console.error(`Error searching subreddit ${subreddit}:`, error.message);
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, MAX_REDDIT_POSTS);
}

// API Configuration
const API_CONFIG = {
  reddit: {
    baseUrl: "https://oauth.reddit.com",
    headers: {
      "User-Agent": USER_AGENT,
    },
  },
  news: {
    baseUrl: "https://newsapi.org/v2",
    headers: {
      "X-Api-Key": process.env.NEWS_API_KEY,
    },
  },
  patents: {
    baseUrl: "https://patents.google.com/api",
    headers: {
      "User-Agent": USER_AGENT,
    },
  },
  trends: {
    baseUrl: "https://trends.google.com/trends/api",
    headers: {
      "User-Agent": USER_AGENT,
    },
  },
};

// Known competitors and their details (fallback data)
const KNOWN_COMPETITORS = {
  direct: [
    {
      name: "Nike",
      url: "https://www.nike.com",
      products: ["Nike Elite Football Socks", "Nike Grip Power Football Socks"],
      priceRange: "$12-$25",
      positioning: "Premium performance",
      marketShare: "35%",
      strengths: [
        "Brand recognition",
        "Professional athlete endorsements",
        "R&D capabilities",
      ],
      weaknesses: ["Higher price point", "Less focus on niche markets"],
    },
    {
      name: "Adidas",
      url: "https://www.adidas.com",
      products: ["Adidas Tiro Socks", "Adidas Traxion Socks"],
      priceRange: "$10-$20",
      positioning: "Performance and style",
      marketShare: "25%",
      strengths: [
        "Global distribution",
        "Strong retail presence",
        "Innovative materials",
      ],
      weaknesses: ["Less specialized in football", "Competing priorities"],
    },
  ],
  indirect: [
    {
      name: "Under Armour",
      url: "https://www.underarmour.com",
      products: ["UA HeatGear Socks", "UA Charged Cotton Socks"],
      priceRange: "$15-$30",
      positioning: "Technical performance",
      marketShare: "15%",
      strengths: [
        "Technical innovation",
        "Athlete-focused design",
        "Strong brand",
      ],
      weaknesses: ["Higher price point", "Broader product focus"],
    },
  ],
};

// Search terms for competitor discovery
const SEARCH_TERMS = {
  direct: [
    "football socks brands",
    "soccer socks companies",
    "athletic socks manufacturers",
    "sports socks brands",
    "performance socks companies",
  ],
  indirect: [
    "athletic wear brands",
    "sports apparel companies",
    "athletic sock manufacturers",
    "performance clothing brands",
    "sports equipment companies",
  ],
};

// Helper function to delay execution with exponential backoff
const delay = (retryCount) => {
  const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 10000);
  return new Promise((resolve) => setTimeout(resolve, backoffMs));
};

// Helper function to extract text content
const extractText = (html) => {
  const $ = cheerio.load(html);
  return $("body").text().replace(/\s+/g, " ").trim();
};

// Helper function to make API requests with retry logic
const makeRequest = async (url, options = {}, retryCount = 0) => {
  try {
    const response = await axios({
      url,
      ...options,
      headers: {
        "User-Agent": USER_AGENT,
        ...options.headers,
      },
      timeout: 10000,
    });
    return response;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const statusCode = error.response?.status;
      if (statusCode === 429 || statusCode === 503) {
        const retryAfter =
          error.response?.headers?.["retry-after"] || Math.pow(2, retryCount);
        console.log(`Rate limited, retrying after ${retryAfter} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return makeRequest(url, options, retryCount + 1);
      }
    }
    throw error;
  }
};

// Helper function to generate search queries
const generateSearchQueries = (businessIdea) => {
  const queries = new Set();
  const terms = businessIdea.toLowerCase().split(" ");

  // Add known competitors first
  [...KNOWN_COMPETITORS.direct, ...KNOWN_COMPETITORS.indirect].forEach(
    (competitor) => {
      queries.add(`site:${competitor.url} ${businessIdea}`);
    }
  );

  // Generate search queries
  Object.values(SEARCH_TERMS).forEach((category) => {
    category.forEach((template) => {
      if (queries.size >= MAX_SEARCH_QUERIES) return;
      queries.add(template);
      // Add variations
      if (
        businessIdea.includes("football") &&
        queries.size < MAX_SEARCH_QUERIES
      ) {
        queries.add(template.replace("football", "soccer"));
      }
      if (businessIdea.includes("socks") && queries.size < MAX_SEARCH_QUERIES) {
        queries.add(template.replace("socks", "sock"));
      }
    });
  });

  return Array.from(queries);
};

// Search for competitors using Google
const searchCompetitors = async (businessIdea) => {
  try {
    const queries = generateSearchQueries(businessIdea);
    const competitors = new Set();
    const competitorDetails = [];

    console.log("Generated search queries:", queries);

    // Add known competitors first
    [...KNOWN_COMPETITORS.direct, ...KNOWN_COMPETITORS.indirect].forEach(
      (competitor) => {
        competitorDetails.push(competitor);
        competitors.add(competitor.url);
      }
    );

    // Early exit if we have enough competitors
    if (competitorDetails.length >= MAX_COMPETITORS) {
      console.log("Found enough known competitors, skipping search");
      return competitorDetails;
    }

    // Search for additional competitors
    for (const query of queries) {
      if (competitorDetails.length >= MAX_COMPETITORS) {
        console.log("Reached maximum number of competitors, stopping search");
        break;
      }

      await delay(DELAY_MS);
      console.log(`Searching for: ${query}`);

      const response = await axios.get(`https://www.google.com/search`, {
        params: {
          q: query,
          num: 5, // Reduced from 10 to 5 results per query
        },
        headers: {
          "User-Agent": USER_AGENT,
        },
        timeout: 5000, // 5 second timeout for each request
      });

      const $ = cheerio.load(response.data);

      // Extract search results
      $("div.g").each((_, element) => {
        if (competitorDetails.length >= MAX_COMPETITORS) return false;

        const title = $(element).find("h3").text();
        const link = $(element).find("a").attr("href");
        const snippet = $(element).find("div.VwiC3b").text();

        if (title && link && !link.includes("google.com")) {
          const domain = new URL(link).hostname;
          if (!competitors.has(domain)) {
            competitors.add(domain);
            competitorDetails.push({
              name: domain.split(".")[0].toUpperCase(),
              url: link,
              category: "unknown",
              products: [],
              priceRange: "Unknown",
              positioning: snippet.slice(0, 100),
            });
          }
        }
      });
    }

    return competitorDetails;
  } catch (error) {
    console.error("Error searching competitors:", error);
    return [...KNOWN_COMPETITORS.direct, ...KNOWN_COMPETITORS.indirect];
  }
};

// Helper function to analyze competitor with Claude
async function analyzeCompetitor(businessIdea, competitor) {
  try {
    console.log(`Analyzing competitor: ${competitor.name}`);
    let redditData = [];

    try {
      const redditToken = await getRedditToken();
      redditData = await searchReddit(
        `${competitor.name} ${businessIdea}`,
        redditToken
      );
      console.log(
        `Found ${redditData.length} relevant Reddit posts for ${competitor.name}`
      );
    } catch (error) {
      console.error(
        `Error getting Reddit data for ${competitor.name}:`,
        error.message
      );
      // Continue execution - Reddit data is not critical
    }

    const prompt = `Analyze this competitor for a business idea about "${businessIdea}":

Competitor Details:
${JSON.stringify(competitor, null, 2)}

Relevant Reddit discussions (top 5):
${JSON.stringify(redditData.slice(0, 5), null, 2)}

Please analyze this competitor and provide a detailed assessment in the following JSON format:
{
  "score": number (0-10),
  "breakdown": {
    "marketPosition": number (0-10),
    "productQuality": number (0-10),
    "brandStrength": number (0-10),
    "pricingStrategy": number (0-10),
    "customerSatisfaction": number (0-10)
  },
  "confidence": number (0-1),
  "reasoning": string,
  "threats": string[],
  "opportunities": string[],
  "recommendations": string[]
}

Focus on:
1. How well they serve the target market
2. Their strengths and weaknesses
3. Their pricing and positioning
4. Customer feedback and satisfaction
5. Potential threats and opportunities
6. Recommendations for competing effectively`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    let analysis;
    try {
      const content = response.content[0].text;
      // Remove markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      analysis = JSON.parse(jsonStr);
    } catch (error) {
      console.error("Error parsing competitor analysis:", error);
      throw new Error("Failed to parse competitor analysis response");
    }

    return {
      ...competitor,
      analysis,
      redditData: redditData.slice(0, 5), // Include top 5 Reddit posts in the response
    };
  } catch (error) {
    console.error(`Error analyzing competitor ${competitor.name}:`, error);
    throw error;
  }
}

// Helper function to analyze competitive landscape
async function analyzeCompetitiveLandscape(businessIdea, competitors) {
  try {
    const prompt = `You are a VC partner analyzing the competitive landscape for a potential investment.
    Business Idea: "${businessIdea}"
    
    Competitor Analysis:
    ${JSON.stringify(competitors, null, 2)}

    Please provide a comprehensive competitive landscape analysis in the following structure:

    1. MARKET STRUCTURE:
    - Market concentration
    - Entry barriers
    - Competitive intensity
    - Market maturity

    2. COMPETITIVE DYNAMICS:
    - Key competitive forces
    - Market share distribution
    - Growth patterns
    - Competitive strategies

    3. OPPORTUNITY ASSESSMENT:
    - Market gaps
    - Underserved segments
    - Competitive advantages
    - Growth opportunities

    4. DEFENSIBILITY:
    - Sustainable advantages
    - Competitive moats
    - Switching costs
    - Network effects

    Format the response as a JSON object with the following structure:
    {
      "marketStructure": {
        "concentration": "string",
        "barriers": ["string"],
        "intensity": "string",
        "maturity": "string"
      },
      "dynamics": {
        "forces": ["string"],
        "shareDistribution": "string",
        "growthPatterns": "string",
        "strategies": ["string"]
      },
      "opportunity": {
        "marketGaps": ["string"],
        "underservedSegments": ["string"],
        "advantages": ["string"],
        "growthAreas": ["string"]
      },
      "defensibility": {
        "advantages": ["string"],
        "moats": ["string"],
        "switchingCosts": "string",
        "networkEffects": "string"
      },
      "score": number,
      "confidence": number,
      "reasoning": "string"
    }`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    // Clean the response text by removing markdown code blocks if present
    let cleanedText = response.content[0].text;
    if (cleanedText.includes("```json")) {
      cleanedText = cleanedText.replace(/```json\n|\n```/g, "");
    }
    if (cleanedText.includes("```")) {
      cleanedText = cleanedText.replace(/```\n|\n```/g, "");
    }

    try {
      return JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse Claude's response as JSON:", cleanedText);
      throw new Error("Failed to parse Claude's response as JSON");
    }
  } catch (error) {
    console.error("Error analyzing competitive landscape:", error);
    // Return fallback analysis
    return {
      marketStructure: {
        concentration: "Unknown",
        barriers: ["Unknown"],
        intensity: "Unknown",
        maturity: "Unknown",
      },
      dynamics: {
        forces: ["Unknown"],
        shareDistribution: "Unknown",
        growthPatterns: "Unknown",
        strategies: ["Unknown"],
      },
      opportunity: {
        marketGaps: ["Unknown"],
        underservedSegments: ["Unknown"],
        advantages: ["Unknown"],
        growthAreas: ["Unknown"],
      },
      defensibility: {
        advantages: ["Unknown"],
        moats: ["Unknown"],
        switchingCosts: "Unknown",
        networkEffects: "Unknown",
      },
      score: 5,
      confidence: 0.5,
      reasoning: "Fallback analysis due to API error",
    };
  }
}

// Main handler
exports.handler = async (event) => {
  console.log("Starting competitor research...");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // Initialize Anthropic client
    await initializeAnthropic();

    // Validate environment variables
    if (!process.env.DYNAMODB_TABLE_NAME) {
      throw new Error("DYNAMODB_TABLE_NAME environment variable is required");
    }

    // Parse request body
    const body = JSON.parse(event.body);
    const businessIdea = body.businessIdea?.trim();

    if (!businessIdea) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "http://localhost:5173",
          "Access-Control-Allow-Headers":
            "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        body: JSON.stringify({
          error: "businessIdea is required",
        }),
      };
    }

    // Generate analysis ID
    const analysisId = `comp_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Phase 1: Quick initial response with known competitors
    const initialResponse = {
      analysisId,
      status: "in_progress",
      message: "Analysis started",
      knownCompetitors: KNOWN_COMPETITORS,
      timestamp: new Date().toISOString(),
    };

    // Save initial state to DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Item: {
          analysisId,
          type: "competitor_research",
          status: "in_progress",
          businessIdea,
          knownCompetitors: KNOWN_COMPETITORS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );

    // Return quick response
    const response = {
      statusCode: 202,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: JSON.stringify(initialResponse),
    };

    // Phase 2: Start async detailed analysis
    // We don't await this to allow the function to return quickly
    (async () => {
      try {
        console.log("Starting detailed competitor analysis...");

        // Analyze known competitors
        const competitorAnalyses = [];
        for (const competitor of [
          ...KNOWN_COMPETITORS.direct,
          ...KNOWN_COMPETITORS.indirect,
        ]) {
          try {
            const analysis = await analyzeCompetitor(businessIdea, competitor);
            competitorAnalyses.push(analysis);

            // Update progress in DynamoDB
            await docClient.send(
              new PutCommand({
                TableName: process.env.DYNAMODB_TABLE_NAME,
                Item: {
                  analysisId,
                  type: "competitor_research",
                  status: "in_progress",
                  businessIdea,
                  knownCompetitors: KNOWN_COMPETITORS,
                  competitorAnalyses,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              })
            );
          } catch (error) {
            console.error(
              `Error analyzing competitor ${competitor.name}:`,
              error
            );
            // Continue with other competitors
          }
        }

        // Analyze competitive landscape
        const landscapeAnalysis = await analyzeCompetitiveLandscape(
          businessIdea,
          competitorAnalyses
        );

        // Save final results
        await docClient.send(
          new PutCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Item: {
              analysisId,
              type: "competitor_research",
              status: "completed",
              businessIdea,
              knownCompetitors: KNOWN_COMPETITORS,
              competitorAnalyses,
              landscapeAnalysis,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          })
        );

        console.log("Detailed analysis completed successfully");
      } catch (error) {
        console.error("Error in detailed analysis:", error);

        // Update status to failed
        await docClient.send(
          new PutCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME,
            Item: {
              analysisId,
              type: "competitor_research",
              status: "failed",
              businessIdea,
              error: error.message,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          })
        );
      }
    })();

    return response;
  } catch (error) {
    console.error("Error in handler:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};
