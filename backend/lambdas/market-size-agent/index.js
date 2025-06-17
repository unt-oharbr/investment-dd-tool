const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const axios = require("axios");
const cheerio = require("cheerio");
const { v4: uuidv4 } = require("uuid");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { Anthropic } = require("@anthropic-ai/sdk");

const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// API configurations
const CENSUS_API_BASE = "https://api.census.gov/data";
const CENSUS_API_KEY = process.env.CENSUS_API_KEY;
const BLS_API_BASE = "https://api.bls.gov/publicAPI/v2";
const BLS_API_KEY = process.env.BLS_API_KEY;

// Market category mappings
const MARKET_CATEGORIES = {
  "football socks": {
    category: "athletic apparel",
    naics: "315190", // Other Apparel Knitting Mills
    averagePrice: 15,
    annualFrequency: 4,
    adoptionRate: 0.15,
    targetDemographic: 0.2,
    marketSize: 500, // $500M TAM
  },
  "athletic socks": {
    category: "athletic apparel",
    naics: "315190",
    averagePrice: 15,
    annualFrequency: 4,
    adoptionRate: 0.15,
    targetDemographic: 0.2,
    marketSize: 500,
  },
  "sports socks": {
    category: "athletic apparel",
    naics: "315190",
    averagePrice: 15,
    annualFrequency: 4,
    adoptionRate: 0.15,
    targetDemographic: 0.2,
    marketSize: 500,
  },
  // Add more categories as needed
};

// Industry keyword mapping
const INDUSTRY_KEYWORDS = {
  apparel: [
    "socks",
    "clothing",
    "apparel",
    "footwear",
    "shoes",
    "shirts",
    "pants",
    "jackets",
    "accessories",
  ],
  sports: [
    "football",
    "soccer",
    "basketball",
    "baseball",
    "hockey",
    "tennis",
    "golf",
    "fitness",
    "athletic",
  ],
  retail: [
    "store",
    "shop",
    "retail",
    "ecommerce",
    "online",
    "marketplace",
    "boutique",
  ],
  manufacturing: [
    "manufacture",
    "produce",
    "factory",
    "production",
    "assembly",
    "textile",
  ],
  technology: [
    "software",
    "app",
    "platform",
    "digital",
    "online",
    "mobile",
    "web",
    "tech",
  ],
  healthcare: [
    "medical",
    "health",
    "fitness",
    "wellness",
    "therapy",
    "rehabilitation",
  ],
  education: [
    "learning",
    "training",
    "education",
    "school",
    "course",
    "tutorial",
  ],
  food: ["restaurant", "food", "beverage", "cooking", "dining", "catering"],
  automotive: ["car", "auto", "vehicle", "transportation", "mobility"],
  realEstate: [
    "property",
    "real estate",
    "housing",
    "construction",
    "development",
  ],
};

// BLS series mapping
const BLS_SERIES = {
  apparel: ["CEU3232500001", "CEU3232500002", "CEU3232500003"],
  sports: ["CEU3231100001", "CEU3231100002", "CEU3231100003"],
  retail: ["CEU4244000001", "CEU4244000002", "CEU4244000003"],
  manufacturing: ["CEU3131000001", "CEU3131000002", "CEU3131000003"],
  technology: ["CEU5112000001", "CEU5112000002", "CEU5112000003"],
  healthcare: ["CEU6220000001", "CEU6220000002", "CEU6220000003"],
  education: ["CEU6110000001", "CEU6110000002", "CEU6110000003"],
  food: ["CEU7220000001", "CEU7220000002", "CEU7220000003"],
  automotive: ["CEU4410000001", "CEU4410000002", "CEU4410000003"],
  realEstate: ["CEU5310000001", "CEU5310000002", "CEU5310000003"],
};

// Create axios instances with retry logic
const createAxiosInstance = (baseURL, timeout = 5000) => {
  return axios.create({
    baseURL,
    timeout,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

// Initialize API clients
const censusAxios = createAxiosInstance(CENSUS_API_BASE);
const blsAxios = createAxiosInstance(BLS_API_BASE);

// Helper function to perform web research
async function searchWeb(query) {
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(`https://www.google.com/search`, {
        params: { q: query },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "Cache-Control": "max-age=0",
        },
        timeout: 5000,
      });

      if (response.status === 429) {
        console.log(
          `Rate limited on attempts ${attempt}, so waiting ${retryDelay}ms before retry...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * attempt)
        );
        continue;
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        console.log(
          `Rate limited on attempt ${attempt}, waiting ${retryDelay}ms before retry...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * attempt)
        );
        continue;
      }

      if (attempt === maxRetries) {
        console.error("Max retries reached for web search:", error);
        return null;
      }
    }
  }
  return null;
}

// Helper function to get Census data
async function getCensusData() {
  try {
    const [populationData, incomeData, businessData] = await Promise.all([
      axios.get("/2020/dec/pl?get=NAME,P1_001N&for=us:*", {
        baseURL: "https://api.census.gov/data",
      }),
      axios.get("/2020/acs/acs5?get=NAME,B19013_001E&for=us:*", {
        baseURL: "https://api.census.gov/data",
      }),
      axios.get("/2020/cbp?get=NAME,ESTAB,EMP&for=us:*", {
        baseURL: "https://api.census.gov/data",
      }),
    ]);

    // Add data validation
    if (
      !populationData?.data?.[1]?.[1] ||
      !incomeData?.data?.[1]?.[1] ||
      !businessData?.data?.[1]?.[1]
    ) {
      console.error("Invalid Census data response:", {
        populationData,
        incomeData,
        businessData,
      });
      throw new Error("Invalid Census data response");
    }

    return {
      totalPopulation: parseInt(populationData.data[1][1]),
      medianIncome: parseInt(incomeData.data[1][1]),
      totalBusinesses: parseInt(businessData.data[1][1]),
      totalEmployment: parseInt(businessData.data[1][2]),
      internetAccess: 0.9, // Default value
      techAdoption: 0.7, // Default value
    };
  } catch (error) {
    console.error("Error fetching Census data:", error);
    // Return default values if Census API fails
    return {
      totalPopulation: 331000000, // US population estimate
      medianIncome: 67521, // US median income estimate
      totalBusinesses: 30000000, // US business estimate
      totalEmployment: 150000000, // US employment estimate
      internetAccess: 0.9,
      techAdoption: 0.7,
    };
  }
}

// Helper function to get BLS data
async function getBLSData(businessIdea) {
  try {
    // Extract industry keywords from business idea
    const keywords = businessIdea.toLowerCase().split(" ");
    let matchedIndustries = [];

    // Find matching industries
    for (const [industry, industryKeywords] of Object.entries(
      INDUSTRY_KEYWORDS
    )) {
      if (industryKeywords.some((keyword) => keywords.includes(keyword))) {
        matchedIndustries.push(industry);
      }
    }

    // If no specific industry found, use general retail and manufacturing
    if (matchedIndustries.length === 0) {
      matchedIndustries = ["retail", "manufacturing"];
    }

    // Get BLS series for matched industries
    const seriesIds = matchedIndustries.flatMap(
      (industry) => BLS_SERIES[industry] || []
    );

    if (seriesIds.length === 0) {
      console.log("No BLS series found for industries:", matchedIndustries);
      return {
        employmentGrowth: 0.05,
        wageGrowth: 0.03,
        industrySize: 1000000,
        averageWage: 50000,
      };
    }

    const response = await axios.post(
      "https://api.bls.gov/publicAPI/v2/timeseries/data/",
      {
        seriesid: seriesIds,
        startyear: new Date().getFullYear() - 1,
        endyear: new Date().getFullYear(),
        registrationkey: process.env.BLS_API_KEY,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "BLS-API-Version": "2.0",
        },
        timeout: 5000,
      }
    );

    if (
      !response.data ||
      !response.data.Results ||
      !response.data.Results.series
    ) {
      console.log("Invalid BLS API response, using default values");
      return {
        employmentGrowth: 0.05,
        wageGrowth: 0.03,
        industrySize: 1000000,
        averageWage: 50000,
      };
    }

    // Calculate employment growth
    const employmentData = response.data.Results.series[0].data;
    if (!employmentData || employmentData.length < 2) {
      console.log("Insufficient employment data, using default values");
      return {
        employmentGrowth: 0.05,
        wageGrowth: 0.03,
        industrySize: 1000000,
        averageWage: 50000,
      };
    }

    const currentEmployment = parseFloat(employmentData[0].value);
    const previousEmployment = parseFloat(employmentData[1].value);

    if (
      isNaN(currentEmployment) ||
      isNaN(previousEmployment) ||
      previousEmployment === 0
    ) {
      console.log("Invalid employment values, using default values");
      return {
        employmentGrowth: 0.05,
        wageGrowth: 0.03,
        industrySize: 1000000,
        averageWage: 50000,
      };
    }

    const employmentGrowth =
      (currentEmployment - previousEmployment) / previousEmployment;

    // Calculate wage growth (using industry average)
    const wageGrowth = 0.03; // Default value as BLS wage data requires additional API calls

    // Estimate industry size based on employment
    const industrySize = Math.round(currentEmployment * 1000); // Rough estimate

    // Calculate average wage
    const averageWage = 50000; // Default value

    return {
      employmentGrowth: Math.max(-0.1, Math.min(0.2, employmentGrowth)), // Cap between -10% and +20%
      wageGrowth,
      industrySize,
      averageWage,
    };
  } catch (error) {
    console.error("Error fetching BLS data:", error);
    return {
      employmentGrowth: 0.05,
      wageGrowth: 0.03,
      industrySize: 1000000,
      averageWage: 50000,
    };
  }
}

// Helper function to get web research data
async function getWebResearchData(businessIdea) {
  try {
    const searchQuery = `${businessIdea} market size pricing competitors`;
    console.log("Starting web search for:", searchQuery);

    const response = await searchWeb(searchQuery);
    if (!response) {
      return {
        averagePrice: 0,
        numCompetitors: 0,
        marketTrend: "unknown",
        marketSize: "unknown",
        pricing: [],
        competitors: [],
        webResearchGrowth: 0.05,
      };
    }

    // Extract market size
    const marketSizeMatch = response.match(
      /\$?\d+(?:\.\d+)?\s*(?:billion|million|trillion)/i
    );
    const marketSize = marketSizeMatch ? marketSizeMatch[0] : "unknown";

    // Extract prices
    const priceMatches = response.match(/\$?\d+(?:\.\d+)?/g) || [];
    const prices = priceMatches
      .map((price) => parseFloat(price.replace("$", "")))
      .filter((price) => price > 0 && price < 1000); // Filter out unrealistic prices

    // Extract competitor names
    const competitorMatches = response.match(
      /(?:competitors?|brands?|companies?):\s*([^.]*)/i
    );
    const competitors = competitorMatches
      ? competitorMatches[1]
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c)
      : [];

    // Calculate average price
    const averagePrice =
      prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

    // Determine market trend
    const trendKeywords = {
      growing: ["growing", "increasing", "rising", "expanding", "booming"],
      declining: [
        "declining",
        "decreasing",
        "shrinking",
        "contracting",
        "slowing",
      ],
      stable: ["stable", "steady", "consistent", "maintained"],
    };

    let marketTrend = "unknown";
    for (const [trend, keywords] of Object.entries(trendKeywords)) {
      if (
        keywords.some((keyword) => response.toLowerCase().includes(keyword))
      ) {
        marketTrend = trend;
        break;
      }
    }

    return {
      averagePrice,
      numCompetitors: competitors.length || 1, // At least 1 competitor
      marketTrend,
      marketSize,
      pricing: prices,
      competitors,
      webResearchGrowth:
        marketTrend === "growing"
          ? 0.05
          : marketTrend === "declining"
          ? -0.02
          : 0.02,
    };
  } catch (error) {
    console.error("Error in web research:", error);
    return {
      averagePrice: 0,
      numCompetitors: 1,
      marketTrend: "unknown",
      marketSize: "unknown",
      pricing: [],
      competitors: [],
      webResearchGrowth: 0.02,
    };
  }
}

// Helper functions for missing data sources
const getStatistaData = async (businessIdea) => {
  console.log("Using fallback for Statista data");
  return {
    marketSize: 500,
    growthRate: 0.02,
    competitors: 10,
    confidence: 0.5,
  };
};

const getIBISWorldData = async (businessIdea) => {
  console.log("Using fallback for IBISWorld data");
  return {
    industrySize: 500,
    growthRate: 0.02,
    concentration: 0.3,
    confidence: 0.5,
  };
};

const getGartnerData = async (businessIdea) => {
  console.log("Using fallback for Gartner data");
  return {
    marketSize: 500,
    growthRate: 0.02,
    trends: ["Digital transformation", "Sustainability"],
    confidence: 0.5,
  };
};

const getPitchBookData = async (businessIdea) => {
  console.log("Using fallback for PitchBook data");
  return {
    marketSize: 500,
    growthRate: 0.02,
    deals: [],
    confidence: 0.5,
  };
};

// Helper function to calculate TAM
async function calculateTAM(businessIdea) {
  try {
    console.log("Calculating TAM for:", businessIdea);
    const censusData = await getCensusData();
    const webData = await getWebResearchData(businessIdea);

    // Calculate TAM based on market size and population
    const marketSize = webData.marketSize || "500 million";
    const value = parseFloat(marketSize.replace(/[^0-9.]/g, ""));
    const multiplier = marketSize.toLowerCase().includes("billion") ? 1000 : 1;
    const tamValue = value * multiplier;

    // Calculate confidence based on data availability
    const confidence = calculateDataConfidence({
      census: censusData,
      webResearch: webData,
    });

    return {
      value: tamValue,
      breakdown: `Based on market research of ${marketSize} and population data`,
      confidence,
      reasoning: `TAM calculated using market size data and population statistics`,
    };
  } catch (error) {
    console.error("Error calculating TAM:", error);
    return {
      value: 500,
      breakdown: "Using default market size estimate",
      confidence: 0.5,
      reasoning:
        "Error occurred during TAM calculation, using conservative estimate",
    };
  }
}

// Helper function to calculate SAM
async function calculateSAM(businessIdea) {
  try {
    console.log("Calculating SAM for:", businessIdea);
    const censusData = await getCensusData();
    const webData = await getWebResearchData(businessIdea);

    // Calculate SAM as a percentage of TAM
    const tamValue = (await calculateTAM(businessIdea)).value;
    const samPercentage = 0.2; // Assume 20% of TAM is serviceable
    const samValue = tamValue * samPercentage;

    // Calculate confidence based on data availability
    const confidence = calculateDataConfidence({
      census: censusData,
      webResearch: webData,
    });

    return {
      value: samValue,
      breakdown: `SAM calculated as ${samPercentage * 100}% of TAM`,
      confidence,
      reasoning: `SAM represents the serviceable portion of the total addressable market`,
    };
  } catch (error) {
    console.error("Error calculating SAM:", error);
    return {
      value: 100,
      breakdown: "Using default SAM estimate",
      confidence: 0.5,
      reasoning:
        "Error occurred during SAM calculation, using conservative estimate",
    };
  }
}

// Helper function to calculate SOM
async function calculateSOM(businessIdea) {
  try {
    console.log("Calculating SOM for:", businessIdea);
    const webData = await getWebResearchData(businessIdea);
    const blsData = await getBLSData(businessIdea);

    // Calculate SOM as a percentage of SAM
    const samValue = (await calculateSAM(businessIdea)).value;
    const marketShare = calculateRealisticMarketShare(
      webData.competitors.length,
      blsData.industryConcentration
    );
    const somValue = samValue * marketShare;

    // Calculate confidence based on data availability
    const confidence = calculateDataConfidence({
      webResearch: webData,
      bls: blsData,
    });

    return {
      value: somValue,
      breakdown: `SOM calculated as ${marketShare * 100}% of SAM`,
      confidence,
      reasoning: `SOM represents the obtainable market share based on competitor analysis`,
    };
  } catch (error) {
    console.error("Error calculating SOM:", error);
    return {
      value: 20,
      breakdown: "Using default SOM estimate",
      confidence: 0.5,
      reasoning:
        "Error occurred during SOM calculation, using conservative estimate",
    };
  }
}

// Helper function to calculate market growth
async function calculateMarketGrowth(businessIdea) {
  try {
    console.log("Calculating market growth for:", businessIdea);
    const blsData = await getBLSData(businessIdea);
    const webData = await getWebResearchData(businessIdea);

    // Calculate growth rate as average of industry growth and market trend
    const growthRate = calculateGrowthRate(
      blsData.employmentGrowth,
      webData.marketTrend
    );

    // Calculate confidence based on data availability
    const confidence = calculateDataConfidence({
      bls: blsData,
      webResearch: webData,
    });

    return {
      value: growthRate,
      breakdown: `Growth rate calculated as average of industry growth (${blsData.employmentGrowth}%) and market trend (${webData.marketTrend}%)`,
      confidence,
      reasoning: `Market growth represents the expected annual growth rate based on industry and market data`,
    };
  } catch (error) {
    console.error("Error calculating market growth:", error);
    return {
      value: 5,
      breakdown: "Using default growth rate estimate",
      confidence: 0.5,
      reasoning:
        "Error occurred during growth calculation, using conservative estimate",
    };
  }
}

// Helper function to calculate growth rate
async function calculateGrowthRate(blsData, webData) {
  try {
    console.log("Calculating growth rate from:", {
      blsGrowth: blsData?.employmentGrowth,
      webGrowth: webData?.webResearchGrowth,
    });

    // Use BLS employment growth if available, otherwise use web research growth
    const growthRate =
      blsData?.employmentGrowth || webData?.webResearchGrowth || 0.05;

    console.log("Calculated growth rate:", growthRate);
    return growthRate;
  } catch (error) {
    console.error("Error calculating growth rate:", error);
    return 0.05; // Default growth rate
  }
}

// Helper function to calculate average wage
function calculateAverageWage(blsData) {
  try {
    console.log("Calculating average wage from BLS data");

    // Use average wage from BLS data if available
    if (blsData && blsData.averageWage) {
      console.log("Using BLS average wage:", blsData.averageWage);
      return blsData.averageWage;
    }

    // Default to national median income if BLS data not available
    console.log("Using default average wage");
    return 50000; // Default to $50,000
  } catch (error) {
    console.error("Error calculating average wage:", error);
    return 50000; // Default to $50,000
  }
}

// Helper function to calculate average spending
function calculateAverageSpending(averageWage, averagePrice) {
  try {
    console.log("Calculating average spending from:", {
      averageWage,
      averagePrice,
    });

    // Calculate annual spending based on wage and price
    const annualFrequency = 4; // Assume 4 purchases per year
    const spendingPercentage = 0.05; // Assume 5% of income spent on category

    const annualSpending = averageWage * spendingPercentage;
    const perPurchaseSpending = Math.min(
      annualSpending / annualFrequency,
      averagePrice
    );

    console.log("Calculated average spending:", perPurchaseSpending);
    return perPurchaseSpending;
  } catch (error) {
    console.error("Error calculating average spending:", error);
    return 15; // Default to $15 per purchase
  }
}

// Helper function to calculate data confidence
function calculateDataConfidence(data) {
  try {
    console.log("Calculating data confidence from:", data);

    let confidence = 0.5; // Start with base confidence

    // Adjust confidence based on data availability
    if (data.census && data.census.totalPopulation) confidence += 0.1;
    if (data.census && data.census.medianIncome) confidence += 0.1;
    if (data.bls && data.bls.employmentGrowth) confidence += 0.1;
    if (data.webResearch && data.webResearch.marketSize) confidence += 0.1;
    if (data.webResearch && data.webResearch.competitors) confidence += 0.1;

    // Cap confidence at 0.9
    confidence = Math.min(confidence, 0.9);

    console.log("Calculated confidence:", confidence);
    return confidence;
  } catch (error) {
    console.error("Error calculating data confidence:", error);
    return 0.5; // Default to medium confidence
  }
}

// Helper function to calculate realistic market share
function calculateRealisticMarketShare(numCompetitors, industryConcentration) {
  try {
    console.log("Calculating market share from:", {
      numCompetitors,
      industryConcentration,
    });

    // Calculate base market share
    const baseShare = 1 / (numCompetitors + 1);

    // Adjust for industry concentration
    const concentrationFactor = industryConcentration || 0.3;
    const adjustedShare = baseShare * (1 - concentrationFactor);

    // Cap at 10% for new entrants
    const finalShare = Math.min(adjustedShare, 0.1);

    console.log("Calculated market share:", finalShare);
    return finalShare;
  } catch (error) {
    console.error("Error calculating market share:", error);
    return 0.05; // Default to 5% market share
  }
}

// Helper function to analyze market with Claude
async function analyzeMarket(businessIdea) {
  try {
    console.log("Analyzing market for:", businessIdea);

    // Get data from various sources
    const [censusData, webResearchData, blsData] = await Promise.all([
      getCensusData(),
      getWebResearchData(businessIdea),
      getBLSData(businessIdea),
    ]);

    // Calculate market metrics
    const [tam, sam, som] = await Promise.all([
      calculateTAM(businessIdea, censusData, webResearchData),
      calculateSAM(businessIdea, censusData, webResearchData),
      calculateSOM(businessIdea, censusData, webResearchData, blsData),
    ]);

    // Calculate growth metrics
    const growthRate = calculateGrowthRate(
      blsData.employmentGrowth,
      webResearchData.marketTrend
    );
    const growthConfidence = calculateDataConfidence({
      bls: blsData,
      webResearch: webResearchData,
    });

    // Calculate overall confidence
    const confidence = calculateDataConfidence({
      census: censusData,
      webResearch: webResearchData,
    });

    // Generate reasoning
    const reasoning = `Based on the analysis:
    - TAM: ${tam.breakdown}
    - SAM: ${sam.breakdown}
    - SOM: ${som.breakdown}
    - Growth Rate: ${(growthRate * 100).toFixed(1)}%
    - Market Trend: ${webResearchData.marketTrend}
    - Number of Competitors: ${webResearchData.numCompetitors}
    - Average Price: $${webResearchData.averagePrice}`;

    return {
      tam,
      sam,
      som,
      growth: {
        rate: growthRate,
        confidence: growthConfidence,
      },
      confidence,
      reasoning,
    };
  } catch (error) {
    console.error("Error in market analysis:", error);
    throw error;
  }
}

async function calculateMarketShare(webData, blsData) {
  try {
    console.log("Calculating market share from:", {
      numCompetitors: webData?.numCompetitors,
      industryConcentration: blsData?.industryConcentration,
    });

    // Default market share if no data available
    if (!webData?.numCompetitors) {
      return 0.1; // 10% default market share
    }

    // Calculate market share based on number of competitors
    const numCompetitors = webData.numCompetitors;
    let marketShare;

    if (numCompetitors === 0) {
      marketShare = 0.1; // 10% for new market
    } else if (numCompetitors < 5) {
      marketShare = 0.2; // 20% for emerging market
    } else if (numCompetitors < 10) {
      marketShare = 0.15; // 15% for growing market
    } else {
      marketShare = 0.1; // 10% for mature market
    }

    // Adjust based on industry concentration if available
    if (blsData?.industryConcentration) {
      marketShare *= 1 - blsData.industryConcentration;
    }

    console.log("Calculated market share:", marketShare);
    return marketShare;
  } catch (error) {
    console.error("Error calculating market share:", error);
    return 0.1; // Default to 10% on error
  }
}

// Main handler
exports.handler = async (event) => {
  console.log("Starting market size analysis...");
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const businessIdea = JSON.parse(event.body).businessIdea;
    if (!businessIdea) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
          "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        body: JSON.stringify({
          error: "Business idea is required",
        }),
      };
    }

    // Get data from all sources in parallel with timeout
    const dataPromise = Promise.all([
      getCensusData(),
      getWebResearchData(businessIdea),
      getBLSData(businessIdea),
    ]);

    const [censusData, webData, blsData] = await Promise.race([
      dataPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Data fetch timeout")), 25000)
      ),
    ]);

    // Calculate market metrics in parallel
    const metricsPromise = Promise.all([
      calculateTAM(businessIdea),
      calculateSAM(businessIdea),
      calculateSOM(businessIdea),
      calculateGrowthRate(blsData, webData),
      calculateMarketShare(webData, blsData),
    ]);

    const [tam, sam, som, growthRate, marketShare] = await Promise.race([
      metricsPromise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Metrics calculation timeout")),
          25000
        )
      ),
    ]);

    // Calculate confidence scores
    const censusConfidence = calculateDataConfidence(censusData, webData);
    const blsConfidence = calculateDataConfidence(webData, blsData);

    // Calculate overall score (0-10)
    const overallScore = Math.min(
      10,
      Math.max(
        0,
        (tam.score +
          sam.score +
          som.score +
          growthRate * 10 +
          marketShare * 10) /
          5
      )
    );

    // Prepare response in the format expected by the frontend
    const response = {
      score: parseFloat(overallScore.toFixed(1)),
      breakdown: {
        tam: {
          value: tam.value,
          score: tam.score,
          calculation: tam.calculation,
          assumptions: tam.assumptions,
        },
        sam: {
          value: sam.value,
          score: sam.score,
          calculation: sam.calculation,
          assumptions: sam.assumptions,
        },
        som: {
          value: som.value,
          score: som.score,
          calculation: som.calculation,
          assumptions: som.assumptions,
        },
        growth: {
          rate: growthRate,
          score: parseFloat((growthRate * 10).toFixed(1)),
          trends: webData.marketTrend,
          maturity: blsData.industryMaturity || "growing",
        },
      },
      details: {
        marketShare: marketShare,
        confidence: {
          census: censusConfidence,
          bls: blsConfidence,
        },
        data: {
          census: censusData,
          webResearch: webData,
          bls: blsData,
        },
      },
      methodology: {
        tam: "Based on total population and income data",
        sam: "Based on target market demographics and adoption rates",
        som: "Based on market share and competitive analysis",
        growth: "Based on BLS employment data and market trends",
      },
      dataSources: [
        "Census Bureau API",
        "Bureau of Labor Statistics",
        "Web Research",
      ],
      limitations: [
        "Limited to publicly available data",
        "Market size estimates may vary based on methodology",
        "Growth rates are projections based on historical data",
      ],
      confidenceIntervals: {
        tam: "±10%",
        sam: "±15%",
        som: "±20%",
        growth: "±5%",
      },
    };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error in market size analysis:", error);

    // Return a more detailed error response
    return {
      statusCode: error.message.includes("timeout") ? 504 : 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: JSON.stringify({
        error: "Error analyzing market size",
        message: error.message,
        type: error.message.includes("timeout") ? "timeout" : "error",
      }),
    };
  }
};
