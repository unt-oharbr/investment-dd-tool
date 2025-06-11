const {
  DynamoDBClient,
  DescribeTableCommand,
} = require("@aws-sdk/client-dynamodb");

const dynamoClient = new DynamoDBClient();

const handler = async (event) => {
  console.log("Health check called");

  try {
    // Test DynamoDB connection
    const tableName = process.env.DYNAMODB_TABLE_NAME;
    const describeTableCommand = new DescribeTableCommand({
      TableName: tableName,
    });

    const tableStatus = await dynamoClient.send(describeTableCommand);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,GET",
      },
      body: JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        dynamodb: {
          tableName: tableName,
          status: tableStatus.Table.TableStatus,
          itemCount: tableStatus.Table.ItemCount,
        },
      }),
    };
  } catch (error) {
    console.error("Health check error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "OPTIONS,GET",
      },
      body: JSON.stringify({
        status: "error",
        message: "Internal server error",
        dynamodb: {
          error: error.message,
        },
      }),
    };
  }
};

module.exports = { handler };
