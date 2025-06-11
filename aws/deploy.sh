#!/bin/bash

# AWS Deployment Script for Investment DD Tool
set -e

PROJECT_NAME="investment-dd-tool"
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}

echo "🚀 Deploying $PROJECT_NAME to $ENVIRONMENT environment in $AWS_REGION"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI not configured. Run 'aws configure' first."
    exit 1
fi

# Deploy SAM stack
echo "📋 Deploying Lambda functions..."
cd backend
sam build
sam deploy --parameter-overrides \
    AnthropicApiKey=$ANTHROPIC_API_KEY \
    RedditClientId=$REDDIT_CLIENT_ID \
    RedditClientSecret=$REDDIT_CLIENT_SECRET \
    CensusApiKey=$CENSUS_API_KEY \
    NewsApiKey=$NEWSAPI_ORG_KEY

echo "✅ Deployment complete!"
