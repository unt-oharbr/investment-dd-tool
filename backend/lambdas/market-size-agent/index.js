const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const axios = require("axios");

const dynamoClient = new DynamoDBClient();

// Census API configuration
const CENSUS_API_BASE = "https://api.census.gov/data";
const CENSUS_API_KEY = process.env.CENSUS_API_KEY;

// Configure axios with timeout and retry logic
const censusAxios = axios.create({
  timeout: 10000, // 10 second timeout
  headers: {
    Accept: "application/json",
  },
});

// Add retry interceptor
censusAxios.interceptors.response.use(undefined, async (err) => {
  const { config } = err;
  if (!config || !config.retry) {
    return Promise.reject(err);
  }
  config.retry -= 1;
  const delayRetry = new Promise((resolve) => {
    setTimeout(resolve, config.retryDelay || 1000);
  });
  await delayRetry;
  return censusAxios(config);
});

// Add request interceptor for retry configuration
censusAxios.interceptors.request.use((config) => {
  config.retry = 3; // Number of retries
  config.retryDelay = 1000; // Delay between retries in ms
  return config;
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

// Market size calculation functions
const calculateTAM = async (businessIdea) => {
  try {
    console.log("Starting TAM calculation...");
    // Get total US population and household income data
    const [population, income] = await Promise.all([
      censusAxios.get(
        `${CENSUS_API_BASE}/2020/dec/pl?get=P1_001N&for=us:*&key=${CENSUS_API_KEY}`
      ),
      censusAxios.get(
        `${CENSUS_API_BASE}/2021/acs/acs1?get=B19013_001E&for=us:*&key=${CENSUS_API_KEY}`
      ),
    ]);

    console.log("TAM API calls completed");
    const totalPopulation = parseInt(population.data[1][0]);
    const medianIncome = parseInt(income.data[1][0]);

    // Calculate TAM based on population and income
    const tam = totalPopulation * (medianIncome / 1000000); // Convert to millions

    return {
      value: tam,
      score: Math.min(3, (tam / 1000) * 3), // Score based on TAM size
      details: {
        totalPopulation,
        medianIncome,
        unit: "millions USD",
      },
    };
  } catch (error) {
    console.error("Error calculating TAM:", error.message);
    if (error.code === "ECONNABORTED") {
      throw new Error("Census API request timed out");
    }
    if (error.response) {
      console.error("Census API response:", error.response.data);
    }
    throw error;
  }
};

const calculateSAM = async (tam) => {
  try {
    console.log("Starting SAM calculation...");
    // Get internet access and technology adoption data
    const internetAccess = await censusAxios.get(
      `${CENSUS_API_BASE}/2021/acs/acs1?get=B28002_001E,B28002_002E&for=us:*&key=${CENSUS_API_KEY}`
    );

    console.log("SAM API call completed");
    const totalHouseholds = parseInt(internetAccess.data[1][0]);
    const householdsWithInternet = parseInt(internetAccess.data[1][1]);
    const internetPenetration = householdsWithInternet / totalHouseholds;

    // Calculate SAM based on TAM and internet penetration
    const sam = tam * internetPenetration;

    return {
      value: sam,
      score: Math.min(3, internetPenetration * 3), // Score based on accessibility
      details: {
        internetPenetration,
        totalHouseholds,
        householdsWithInternet,
        unit: "millions USD",
      },
    };
  } catch (error) {
    console.error("Error calculating SAM:", error.message);
    if (error.code === "ECONNABORTED") {
      throw new Error("Census API request timed out");
    }
    if (error.response) {
      console.error("Census API response:", error.response.data);
    }
    throw error;
  }
};

const calculateSOM = async (sam) => {
  try {
    console.log("Starting SOM calculation...");
    // Get business formation and growth data using the Annual Business Survey
    const businessData = await censusAxios.get(
      `${CENSUS_API_BASE}/2020/abscb?get=FIRMPDEMP,EMP&for=us:*&key=${CENSUS_API_KEY}`
    );

    console.log("SOM API call completed");
    // The Census API returns data in a specific format where the first row contains headers
    // and subsequent rows contain the actual data
    const totalEstablishments = parseInt(businessData.data[1][0]);
    const totalEmployment = parseInt(businessData.data[1][1]);

    // Calculate market share based on employment and establishments
    const marketShare = 0.01; // Assume 1% market share for SOM calculation
    const som = sam * marketShare;

    return {
      value: som,
      score: Math.min(2, marketShare * 10 * 2), // Score based on realistic market capture
      details: {
        totalEstablishments,
        totalEmployment,
        assumedMarketShare: marketShare,
        unit: "millions USD",
      },
    };
  } catch (error) {
    console.error("Error calculating SOM:", error.message);
    if (error.code === "ECONNABORTED") {
      throw new Error("Census API request timed out");
    }
    if (error.response) {
      console.error("Census API response:", error.response.data);
    }
    throw error;
  }
};

const calculateMarketGrowth = async () => {
  try {
    console.log("Starting market growth calculation...");
    // Get historical business growth data using the Annual Business Survey
    const growthData = await censusAxios.get(
      `${CENSUS_API_BASE}/2020/abscb?get=FIRMPDEMP,EMP&for=us:*&key=${CENSUS_API_KEY}`
    );

    console.log("Market growth API call completed");
    // The Census API returns data in a specific format where the first row contains headers
    // and subsequent rows contain the actual data
    const currentYearEstablishments = parseInt(growthData.data[1][0]);
    const currentYearEmployment = parseInt(growthData.data[1][1]);

    // For simplicity, we'll use a fixed growth rate since we don't have historical data
    const growthRate = 0.05; // Assume 5% annual growth rate

    return {
      value: growthRate,
      score: Math.min(2, growthRate * 10 * 2), // Score based on growth rate
      details: {
        currentYearEmployment,
        currentYearEstablishments,
        assumedGrowthRate: growthRate,
        unit: "percentage",
      },
    };
  } catch (error) {
    console.error("Error calculating market growth:", error.message);
    if (error.code === "ECONNABORTED") {
      throw new Error("Census API request timed out");
    }
    if (error.response) {
      console.error("Census API response:", error.response.data);
    }
    throw error;
  }
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
    console.log("Starting market size analysis...");
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

    // Calculate market metrics
    console.log("Calculating TAM...");
    const tam = await calculateTAM(businessIdea);
    console.log("Calculating SAM...");
    const sam = await calculateSAM(tam.value);
    console.log("Calculating SOM...");
    const som = await calculateSOM(sam.value);
    console.log("Calculating market growth...");
    const growth = await calculateMarketGrowth();

    // Calculate total score
    const totalScore = tam.score + sam.score + som.score + growth.score;

    // Prepare analysis
    const analysis = {
      analysisId: `ms-${Date.now()}`,
      timestamp: new Date().toISOString(),
      businessIdea,
      score: parseFloat(totalScore.toFixed(1)),
      breakdown: {
        tam: parseFloat(tam.score.toFixed(1)),
        sam: parseFloat(sam.score.toFixed(1)),
        som: parseFloat(som.score.toFixed(1)),
        growth: parseFloat(growth.score.toFixed(1)),
      },
      confidence: 0.8,
      reasoning: `Market analysis based on Census data. TAM: $${tam.value.toFixed(
        2
      )}M, SAM: $${sam.value.toFixed(2)}M, SOM: $${som.value.toFixed(
        2
      )}M. Market growth rate: ${(growth.value * 100).toFixed(1)}%`,
      details: {
        tam: tam.details,
        sam: sam.details,
        som: som.details,
        growth: growth.details,
      },
    };

    // Store in DynamoDB
    console.log("Storing analysis in DynamoDB...");
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    await dynamoClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(analysis),
      })
    );

    console.log("Analysis complete!");
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(analysis),
    };
  } catch (error) {
    console.error("Error in handler:", error.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
    };
  }
};
