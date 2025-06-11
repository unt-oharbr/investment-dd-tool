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
