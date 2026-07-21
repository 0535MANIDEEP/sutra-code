# Sutra-Code — Socratic AI Mentor

AI-powered educational platform that teaches programming through Socratic questioning and Indian cultural analogies. Prevents copy-paste culture by guiding students to genuine understanding through guided questions, faded scaffolds, and voice-based viva examinations.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS |
| State | React Context, React Query |
| Forms | React Hook Form, Zod |
| UI | Headless UI, Heroicons, Recharts |
| Animations | Framer Motion |
| Real-time | Socket.io Client |
| Backend | AWS CDK (TypeScript) |
| Compute | AWS Lambda (Node.js 18.x) |
| Database | AWS DynamoDB (9 tables, encrypted) |
| Storage | AWS S3 (audio recordings) |
| Auth | AWS Cognito (User Pool + Identity Pool) |
| API | AWS API Gateway (REST) |
| AI | AWS Bedrock (Claude 3 Haiku), Bhashini API |
| Security | AWS KMS, SQS Dead Letter Queues |
| Monitoring | CloudWatch Logs (7-year retention) |
| Testing | Jest, Fast-check (property-based) |

## Features

### Socratic Engine
- Guided questioning instead of direct answers
- Friction level tracking per student
- Conceptual depth measurement
- Session-based conversation context

### Cultural Analogy Generator
- Programming concepts mapped to Indian contexts (cricket, cooking, mandi markets)
- Difficulty-adaptive analogies (beginner, intermediate, advanced)
- Cached analogies for performance

### Faded Scaffolds
- Strategic fill-in-the-blank code templates
- Competency-based scaffold fading
- Progressive difficulty adjustment
- Struggle log tracking

### Voice Viva Processor
- Oral examination via voice input
- Multilingual support through Bhashini API (22 Indian languages)
- Speech-to-text and text-to-speech processing
- Audio storage in S3

### Security and Compliance
- DPDP Act 2023 compliant
- End-to-end encryption via AWS KMS
- Consent management system
- Comprehensive audit logging
- Session management with automatic timeouts
- Multi-factor authentication via Cognito

## Architecture

```
sutra-code/
├── frontend/                  # React + TypeScript SPA
│   └── src/
│       ├── pages/             # Landing, auth, chat, profile, recruiter
│       ├── components/        # Reusable UI components
│       ├── services/          # API and WebSocket services
│       ├── contexts/          # Auth and app contexts
│       └── types/             # TypeScript definitions
├── lambda/                    # AWS Lambda functions
│   ├── auth/                  # JWT validator
│   ├── socratic-engine/       # Core Socratic AI logic
│   ├── cultural-analogy-generator/
│   ├── faded-scaffolds-generator/
│   ├── voice-viva-processor/
│   ├── session-manager/
│   ├── consent-manager/
│   ├── audit-logger/
│   └── service-integration-verifier/
├── lib/                       # AWS CDK infrastructure
│   └── sutra-code-stack.ts    # Full stack definition
├── test/                      # Unit, integration, security tests
└── scripts/                   # Deployment scripts
```

## Setup

### Demo Mode (No AWS Required)

```bash
git clone https://github.com/0535MANIDEEP/sutra-code.git
cd sutra-code
npm install
cd frontend && npm install && cd ..
cd frontend
npm start
```

Visit `http://localhost:3000`.

### Production Deployment

```bash
# Requires AWS CLI configured
aws configure

# Deploy CDK infrastructure
npm run deploy:prod

# Build and serve frontend
cd frontend
npm run build
```

## Environment Variables

Frontend (`frontend/.env`):

```env
REACT_APP_API_GATEWAY_URL=https://your-api-gateway-url.execute-api.ap-south-1.amazonaws.com
REACT_APP_AWS_REGION=ap-south-1
REACT_APP_USER_POOL_ID=ap-south-1_xxxxxxxxx
REACT_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_IDENTITY_POOL_ID=ap-south-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/socratic/ask` | Main Socratic questioning |
| GET | `/v1/socratic/context/:sessionId` | Get conversation context |
| POST | `/v1/analogies/generate` | Generate cultural analogy |
| POST | `/v1/scaffolds/generate` | Generate faded scaffold |
| POST | `/v1/voice/process` | Process voice viva input |
| POST | `/auth/validate` | JWT token validation |
| GET | `/v1/profiles/:studentId` | Get student profile |
| POST | `/v1/security/consent/grant` | Grant data consent |
| POST | `/v1/security/session/create` | Create secure session |
| GET | `/v1/health/check` | Service health check |

## Deployed URL

[https://sutra-code.vercel.app](https://sutra-code.vercel.app)
