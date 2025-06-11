#!/bin/bash

# Investment DD Tool - Complete Project Setup Script for macOS
# Run this script in your project root directory

set -e  # Exit on any error

echo "🚀 Setting up Investment DD Tool project structure..."

# Create complete folder structure
echo "📁 Creating folder structure..."
mkdir -p {frontend/{src/{components/{common,forms,results,dashboard},services,store/{slices,middleware},utils},public},backend/{lambdas/{problem-definition-agent,market-size-agent,competitor-research-agent,solution-analysis-agent,customer-profile-agent,market-validation-agent,trust-credibility-agent,purchase-behavior-agent,investment-readiness-agent,pmf-score-calculator,websocket-handler},shared/{utils,types},infrastructure,tests},aws/{cloudformation,step-functions},shared/{types,utils},docs,.github/workflows,.vscode}

# Root package.json
echo "📦 Creating root package.json..."
cat > package.json << 'EOF'
{
  "name": "investment-dd-tool",
  "version": "1.0.0",
  "description": "AI-powered investment due diligence tool with AWS Lambda + Claude",
  "main": "index.js",
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run local:lambdas\"",
    "dev:frontend": "cd frontend && npm run dev",
    "local:lambdas": "cd backend && sam local start-api --port 3001",
    "build": "npm run build:frontend && npm run build:lambdas",
    "build:frontend": "cd frontend && npm run build",
    "build:lambdas": "cd backend && sam build",
    "test": "npm run test:lambdas && npm run test:frontend",
    "test:lambdas": "cd backend && npm test",
    "test:frontend": "cd frontend && npm test",
    "deploy:dev": "./aws/deploy.sh dev us-east-1",
    "deploy:prod": "./aws/deploy.sh prod us-east-1",
    "logs": "aws logs tail /aws/lambda/investment-dd --follow"
  },
  "keywords": ["investment", "due-diligence", "aws-lambda", "claude-ai", "serverless"],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
EOF

# Backend package.json
echo "📦 Creating backend package.json..."
cat > backend/package.json << 'EOF'
{
  "name": "investment-dd-backend",
  "version": "1.0.0",
  "description": "AWS Lambda functions for investment DD tool",
  "main": "index.js",
  "scripts": {
    "test": "jest --watchAll=false",
    "test:watch": "jest --watch",
    "build": "sam build",
    "deploy": "sam deploy --guided",
    "local": "sam local start-api --port 3001",
    "invoke:local": "sam local invoke",
    "logs": "sam logs -n ProblemDefinitionAgent --stack-name investment-dd-dev --tail"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "@aws-sdk/client-dynamodb": "^3.400.0",
    "@aws-sdk/client-step-functions": "^3.400.0",
    "@aws-sdk/client-apigatewaymanagementapi": "^3.400.0",
    "aws-lambda": "^1.0.7",
    "axios": "^1.5.0",
    "cheerio": "^1.0.0-rc.12",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "jest": "^29.6.2",
    "@types/node": "^20.5.0",
    "@types/aws-lambda": "^8.10.119",
    "aws-sdk-mock": "^5.8.0"
  }
}
EOF

# Frontend package.json
echo "📦 Creating frontend package.json..."
cat > frontend/package.json << 'EOF'
{
  "name": "investment-dd-frontend",
  "version": "1.0.0",
  "description": "React frontend for investment due diligence tool",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.15.0",
    "@mui/material": "^5.14.5",
    "@mui/icons-material": "^5.14.3",
    "@emotion/react": "^11.11.1",
    "@emotion/styled": "^11.11.0",
    "@reduxjs/toolkit": "^1.9.5",
    "react-redux": "^8.1.2",
    "recharts": "^2.8.0",
    "aws-sdk": "^2.1450.0",
    "axios": "^1.5.0",
    "formik": "^2.4.3",
    "yup": "^1.2.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.4",
    "vite": "^4.4.9",
    "vitest": "^0.34.3",
    "@testing-library/react": "^13.4.0",
    "@testing-library/jest-dom": "^6.1.2",
    "eslint": "^8.47.0",
    "eslint-plugin-react": "^7.33.2",
    "prettier": "^3.0.2"
  }
}
EOF

# Cursor configuration
echo "⚙️  Creating Cursor configuration..."
cat > .cursorrules << 'EOF'
# Investment Due Diligence Tool - AWS Lambda + Claude Architecture

# Project Context
You are working on an Investment Due Diligence Tool with AWS Lambda + Claude API.
- Backend: AWS Lambda functions with Claude API for market research agents
- Frontend: React with Material-UI and Redux for state management  
- Database: DynamoDB for data persistence
- Orchestration: AWS Step Functions to coordinate Lambda agents
- Deployment: Full AWS serverless stack

# Architecture Principles
- Each agent is a separate Lambda function that returns scored results (0-10)
- Free data sources only (Reddit API, Census Bureau, Google Patents, etc.)
- Real-time progress updates via WebSocket API Gateway
- Comprehensive PMF (Product-Market Fit) scoring system

# Lambda Function Patterns
Each agent Lambda should:
1. Accept business idea input via event parameter
2. Research using free external APIs
3. Use Claude API for analysis and scoring
4. Return structured JSON with score, breakdown, confidence, reasoning
5. Include comprehensive error handling
6. Log progress for monitoring

# When generating Lambda functions:
1. Always include proper error handling and try/catch blocks
2. Add comprehensive CloudWatch logging
3. Include input validation for event parameters
4. Use AWS SDK v3 with proper client initialization
5. Implement timeout handling
6. Follow established Lambda function structure
7. Include relevant unit tests
8. Consider cold start optimization

# When generating React components:
1. Use Material-UI components consistently
2. Integrate with AWS API Gateway via axios
3. Handle loading states for asynchronous Lambda calls
4. Display real-time progress from WebSocket updates
5. Show detailed scoring breakdowns
6. Implement error boundaries for AWS service failures
EOF

# VS Code settings
echo "⚙️  Creating VS Code settings..."
cat > .vscode/settings.json << 'EOF'
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.associations": {
    "*.jsx": "javascriptreact",
    "*.tsx": "typescriptreact",
    "*.yml": "yaml",
    "*.yaml": "yaml"
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  },
  "editor.suggest.snippetsPreventQuickSuggestions": false,
  "editor.inlineSuggest.enabled": true,
  "github.copilot.enable": {
    "*": true,
    "yaml": true,
    "plaintext": false,
    "markdown": false
  },
  "aws.profile": "default",
  "aws.region": "us-east-1"
}
EOF

# VS Code launch configuration
echo "⚙️  Creating VS Code launch configuration..."
cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Lambda Locally",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/lambdas/problem-definition-agent/index.js",
      "env": {
        "NODE_ENV": "development",
        "AWS_REGION": "us-east-1"
      },
      "envFile": "${workspaceFolder}/backend/.env",
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Frontend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/frontend/node_modules/.bin/vite",
      "args": ["--port", "5173"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}/frontend"
    }
  ]
}
EOF

# Environment files
echo "🔑 Creating environment files..."
cat > backend/.env.example << 'EOF'
# Claude API
ANTHROPIC_API_KEY=your_claude_api_key_here

# Free External APIs
NEWSAPI_ORG_KEY=your_newsapi_key_here
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
CENSUS_API_KEY=your_census_api_key
FRED_API_KEY=your_fred_api_key

# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default
DYNAMODB_TABLE_NAME=investment-dd-analyses-dev

# Development
NODE_ENV=development
LOG_LEVEL=debug
EOF

cat > frontend/.env.example << 'EOF'
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/Prod
VITE_WS_URL=wss://your-websocket-api-id.execute-api.us-east-1.amazonaws.com/dev
VITE_ENVIRONMENT=development
VITE_AWS_REGION=us-east-1
EOF

# Copy env examples to actual env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# SAM Template
echo "☁️  Creating SAM template..."
cat > backend/template.yaml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Investment DD Tool - Serverless Backend

Globals:
  Function:
    Timeout: 900
    MemorySize: 512
    Runtime: nodejs18.x
    Environment:
      Variables:
        ANTHROPIC_API_KEY: !Ref AnthropicApiKey
        REDDIT_CLIENT_ID: !Ref RedditClientId
        REDDIT_CLIENT_SECRET: !Ref RedditClientSecret
        CENSUS_API_KEY: !Ref CensusApiKey
        NEWSAPI_ORG_KEY: !Ref NewsApiKey
        DYNAMODB_TABLE_NAME: !Ref AnalysesTable

Parameters:
  AnthropicApiKey:
    Type: String
    NoEcho: true
  RedditClientId:
    Type: String
    NoEcho: true
  RedditClientSecret:
    Type: String
    NoEcho: true
  CensusApiKey:
    Type: String
  NewsApiKey:
    Type: String
    NoEcho: true

Resources:
  # DynamoDB Tables
  AnalysesTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: investment-dd-analyses
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: analysisId
          AttributeType: S
      KeySchema:
        - AttributeName: analysisId
          KeyType: HASH

  # Lambda Functions
  ProblemDefinitionAgent:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: problem-definition-agent
      CodeUri: lambdas/problem-definition-agent/
      Handler: index.handler
      Events:
        Api:
          Type: Api
          Properties:
            Path: /agents/problem-definition
            Method: post

  MarketSizeAgent:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: market-size-agent
      CodeUri: lambdas/market-size-agent/
      Handler: index.handler

Outputs:
  ApiGatewayUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${ServerlessRestApi}.execute-api.${AWS::Region}.amazonaws.com/Prod/'
EOF

# GitHub workflow
echo "🔄 Creating GitHub Actions workflow..."
cat > .github/workflows/ci-cd.yml << 'EOF'
name: Investment DD Tool - Serverless CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  NODE_VERSION: '18'
  AWS_REGION: 'us-east-1'
  PYTHON_VERSION: '3.9'

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'
    
    - name: Setup Python & SAM
      uses: actions/setup-python@v4
      with:
        python-version: ${{ env.PYTHON_VERSION }}
    
    - name: Install AWS SAM CLI
      uses: aws-actions/setup-sam@v2
    
    - name: Install Dependencies
      run: |
        npm ci
        cd backend && npm ci
        cd ../frontend && npm ci
    
    - name: Run Lambda Unit Tests
      run: |
        cd backend && npm test
    
    - name: Run Frontend Tests
      run: |
        cd frontend && npm test
    
    - name: Validate SAM Template
      run: |
        cd backend && sam validate

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS Credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Deploy Backend
      run: |
        cd backend && sam build && sam deploy --no-confirm-changeset
EOF

# Deployment script
echo "🚀 Creating deployment script..."
cat > aws/deploy.sh << 'EOF'
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
EOF

chmod +x aws/deploy.sh

# Basic Lambda function template
echo "⚡ Creating basic Lambda function template..."
mkdir -p backend/lambdas/problem-definition-agent
cat > backend/lambdas/problem-definition-agent/index.js << 'EOF'
const { AnthropicAPI } = require('@anthropic-ai/sdk');

const anthropic = new AnthropicAPI({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  try {
    const { businessIdea, description } = JSON.parse(event.body || '{}');
    
    if (!businessIdea) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'businessIdea is required' })
      };
    }
    
    // TODO: Implement Reddit API research
    // TODO: Implement Claude analysis
    
    // Mock response for now
    const mockResult = {
      score: 7.5,
      breakdown: {
        clarity: 2.5,
        evidence: 2.0,
        urgency: 1.5,
        frequency: 1.5
      },
      confidence: 0.8,
      reasoning: "This is a mock response. Will implement real analysis in Task 4."
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(mockResult)
    };
    
  } catch (error) {
    console.error('Error in ProblemDefinitionAgent:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
EOF

# Basic package.json for Lambda function
cat > backend/lambdas/problem-definition-agent/package.json << 'EOF'
{
  "name": "problem-definition-agent",
  "version": "1.0.0",
  "description": "Problem Definition Agent for Investment DD",
  "main": "index.js",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.0",
    "axios": "^1.5.0"
  }
}
EOF

# Test event file
mkdir -p backend/test-events
cat > backend/test-events/problem-event.json << 'EOF'
{
  "body": "{\"businessIdea\": \"AI-powered expense tracking for small businesses\", \"description\": \"A mobile app that uses AI to automatically categorize expenses and generate insights for small business owners.\"}"
}
EOF

# Frontend Vite config
echo "⚙️  Creating frontend Vite config..."
cat > frontend/vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
EOF

# Basic React files
echo "⚛️  Creating basic React files..."
cat > frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Investment DD Tool</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat > frontend/src/main.jsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

cat > frontend/src/App.jsx << 'EOF'
import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Typography, Box } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h2" component="h1" gutterBottom>
            Investment Due Diligence Tool
          </Typography>
          <Typography variant="h5" component="h2" gutterBottom>
            AI-Powered Product-Market Fit Analysis
          </Typography>
          <Typography variant="body1">
            Ready for development! 🚀
          </Typography>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
EOF

# README
echo "📝 Creating README..."
cat > README.md << 'EOF'
# Investment Due Diligence Tool

AI-powered investment due diligence tool with comprehensive Product-Market Fit scoring using AWS Lambda + Claude API.

## Quick Start

1. Install dependencies: `npm install`
2. Configure AWS: `aws configure`
3. Set up environment: Edit `backend/.env` with your API keys
4. Deploy backend: `cd backend && sam build && sam deploy --guided`
5. Start frontend: `cd frontend && npm run dev`

## Architecture

- **Backend**: AWS Lambda functions with Claude API
- **Frontend**: React with Material-UI
- **Database**: DynamoDB
- **Orchestration**: AWS Step Functions
- **Deployment**: AWS SAM

## Development

- `npm run dev` - Start local development
- `npm run test` - Run all tests
- `npm run deploy:dev` - Deploy to development environment

See [tasks.md](docs/tasks.md) for detailed development plan.
EOF

# Git ignore
echo "🚫 Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
*/node_modules/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/
*/dist/
*/build/

# AWS SAM
.aws-sam/
samconfig.toml

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Runtime
*.pid
*.seed
*.pid.lock

# Coverage
coverage/
*.lcov

# Cache
.cache/
.parcel-cache/
EOF

echo ""
echo "✅ Project structure created successfully!"
echo ""
echo "📁 Project structure:"
echo "$(find . -type d -name node_modules -prune -o -type d -print | head -20 | sort)"
echo ""
echo "🎯 Next steps:"
echo "1. Edit backend/.env with your Claude API key"
echo "2. Run: npm install"
echo "3. Run: cd backend && npm install"
echo "4. Run: cd frontend && npm install"
echo "5. Configure AWS: aws configure"
echo "6. Start Task 1: Open Cursor and begin development!"
echo ""
echo "🚀 Ready to build your investment DD tool!"

