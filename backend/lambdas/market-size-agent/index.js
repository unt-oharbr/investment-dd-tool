const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const axios = require("axios");

const dynamoClient = new DynamoDBClient();

// Census API configuration
const CENSUS_API_BASE = "https://api.census.gov/data";
const CENSUS_API_KEY = process.env.CENSUS_API_KEY;

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

// Market size calculation functions
const calculateTAM = async (businessIdea) => {
  try {
    // Get total US population and household income data
    const [population, income] = await Promise.all([
      axios.get(
        `${CENSUS_API_BASE}/2020/dec/pl?get=P1_001N&for=us:*&key=${CENSUS_API_KEY}`
      ),
      axios.get(
        `${CENSUS_API_BASE}/2021/acs/acs1?get=B19013_001E&for=us:*&key=${CENSUS_API_KEY}`
      ),
    ]);

    const totalPopulation = parseInt(population.data[1][0]);
    const medianIncome = parseInt(income.data[1][0]);

    // Calculate TAM based on population and income
    // This is a simplified calculation - you might want to adjust based on your specific market
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
    console.error("Error calculating TAM:", error);
    throw error;
  }
};

const calculateSAM = async (tam) => {
  try {
    // Get internet access and technology adoption data
    const internetAccess = await axios.get(
      `${CENSUS_API_BASE}/2021/acs/acs1?get=B28002_001E,B28002_002E&for=us:*&key=${CENSUS_API_KEY}`
    );

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
    console.error("Error calculating SAM:", error);
    throw error;
  }
};

const calculateSOM = async (sam) => {
  try {
    // Get business formation and growth data
    const businessData = await axios.get(
      `${CENSUS_API_BASE}/2021/abscb?get=EMP,ESTAB&for=us:*&key=${CENSUS_API_KEY}`
    );

    const totalEstablishments = parseInt(businessData.data[1][1]);
    const marketShare = 0.01; // Assume 1% market share for SOM calculation
    const som = sam * marketShare;

    return {
      value: som,
      score: Math.min(2, marketShare * 10 * 2), // Score based on realistic market capture
      details: {
        totalEstablishments,
        assumedMarketShare: marketShare,
        unit: "millions USD",
      },
    };
  } catch (error) {
    console.error("Error calculating SOM:", error);
    throw error;
  }
};

const calculateMarketGrowth = async () => {
  try {
    // Get historical business growth data
    const growthData = await axios.get(
      `${CENSUS_API_BASE}/2021/abscb?get=EMP,ESTAB&for=us:*&key=${CENSUS_API_KEY}`
    );

    // Calculate year-over-year growth
    const currentYear = parseInt(growthData.data[1][0]);
    const previousYear = parseInt(growthData.data[1][1]);
    const growthRate = (currentYear - previousYear) / previousYear;

    return {
      value: growthRate,
      score: Math.min(2, growthRate * 10 * 2), // Score based on growth rate
      details: {
        currentYear,
        previousYear,
        growthRate,
        unit: "percentage",
      },
    };
  } catch (error) {
    console.error("Error calculating market growth:", error);
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
    const tam = await calculateTAM(businessIdea);
    const sam = await calculateSAM(tam.value);
    const som = await calculateSOM(sam.value);
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
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    await dynamoClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: marshall(analysis),
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(analysis),
    };
  } catch (error) {
    console.error("Error:", error);
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
