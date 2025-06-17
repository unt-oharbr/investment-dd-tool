const {
  APIGatewayClient,
  GetAccountCommand,
  UpdateAccountCommand,
} = require("@aws-sdk/client-api-gateway");
const https = require("https");
const url = require("url");

const apiGateway = new APIGatewayClient();

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    if (event.RequestType === "Delete") {
      await sendResponse(event, "SUCCESS");
      return;
    }

    const { RoleArn } = event.ResourceProperties;

    // Get current account settings
    const getAccountResponse = await apiGateway.send(new GetAccountCommand({}));
    console.log("Current account settings log:", getAccountResponse);

    // Update account settings
    const updateAccountResponse = await apiGateway.send(
      new UpdateAccountCommand({
        patchOperations: [
          {
            op: "replace",
            path: "/cloudwatchRoleArn",
            value: RoleArn,
          },
        ],
      })
    );
    console.log("Updated account settings:", updateAccountResponse);

    // Wait for the update to propagate
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Verify the update
    const verifyResponse = await apiGateway.send(new GetAccountCommand({}));
    console.log("Verified account settings:", verifyResponse);

    if (verifyResponse.cloudwatchRoleArn === RoleArn) {
      await sendResponse(event, "SUCCESS");
    } else {
      throw new Error("Account update verification failed");
    }
  } catch (error) {
    console.error("Error updating API Gateway account:", error);
    await sendResponse(event, "FAILED", error.message);
  }
};

async function sendResponse(event, status, reason = "") {
  const responseBody = {
    Status: status,
    Reason: reason,
    PhysicalResourceId: event.PhysicalResourceId || event.LogicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  console.log("Sending response:", responseBody);

  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: "PUT",
    headers: {
      "content-type": "",
      "content-length": JSON.stringify(responseBody).length,
    },
  };

  return new Promise((resolve, reject) => {
    const request = https.request(options, (response) => {
      console.log("Status code:", response.statusCode);
      console.log("Status message:", response.statusMessage);
      resolve();
    });

    request.on("error", (error) => {
      console.error("Error sending response:", error);
      reject(error);
    });

    request.write(JSON.stringify(responseBody));
    request.end();
  });
}
