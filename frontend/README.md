# Sutra-Code Frontend

React TypeScript frontend for the Sutra-Code Socratic AI Mentor system.

## Features

- **Real-time Chat Interface**: WebSocket-powered chat with the Socratic AI Mentor
- **22 Language Support**: Full support for Indian languages including Hindi, Tamil, Telugu, Bengali, and more
- **Cultural Context**: Programming concepts explained through familiar Indian contexts (cricket, mandi, festivals, etc.)
- **Voice Integration**: Voice recording and processing capabilities
- **Authentication**: Secure authentication with AWS Cognito
- **Responsive Design**: Mobile-first design optimized for Indian students' devices
- **Offline Support**: Basic functionality works offline with cached content

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Query** for API state management
- **Socket.io** for real-time communication
- **AWS SDK** for authentication and services
- **Framer Motion** for animations

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- AWS account with Cognito configured

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```
REACT_APP_API_GATEWAY_URL=https://your-api-gateway-url
REACT_APP_WEBSOCKET_URL=wss://your-websocket-url
REACT_APP_AWS_REGION=ap-south-1
REACT_APP_USER_POOL_ID=your-user-pool-id
REACT_APP_CLIENT_ID=your-client-id
REACT_APP_IDENTITY_POOL_ID=your-identity-pool-id
```

3. Start the development server:
```bash
npm start
```

The app will be available at `http://localhost:3000`.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build` folder.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── chat/           # Chat-specific components
│   └── common/         # Common UI components
├── contexts/           # React contexts for state management
├── hooks/              # Custom React hooks
├── pages/              # Page components
├── services/           # API and external service integrations
├── types/              # TypeScript type definitions
├── constants/          # App constants and configuration
└── utils/              # Utility functions
```

## Key Components

### Chat System
- `ChatPage`: Main chat interface
- `ChatMessage`: Individual message component with cultural analogies
- `ChatInput`: Message input with voice recording support
- `ChatHeader`: Header with session management

### Authentication
- `SignInPage`: User authentication
- `SignUpPage`: User registration with DPDP Act 2023 compliance
- `AuthContext`: Authentication state management

### Language Support
- `LanguageContext`: Multi-language support
- `LanguageSelector`: Language switching component
- Support for 22 Indian languages with native scripts

### Services
- `authService`: AWS Cognito authentication
- `apiService`: Backend API communication
- `websocketService`: Real-time communication

## Features in Detail

### Socratic Chat Interface
The chat interface implements the core Socratic methodology:
- Questions instead of direct answers
- Cultural analogies for better understanding
- Progressive difficulty based on student responses
- Real-time feedback and guidance

### Cultural Context Integration
Programming concepts are explained through familiar Indian contexts:
- **Sorting**: Cricket team batting order
- **Searching**: Mandi vendor price discovery
- **Recursion**: Festival preparation delegation
- **Graphs**: Railway network connections
- **Queues**: Temple darshan lines

### Voice Integration
- Voice recording with WebRTC
- Integration with Bhashini API for Indian language STT
- Voice message processing and transcription
- Fallback to text input when voice is unavailable

### Responsive Design
- Mobile-first approach for smartphone users
- Optimized for low-bandwidth connections
- Progressive Web App (PWA) capabilities
- Offline functionality with cached content

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_API_GATEWAY_URL` | Backend API URL | Yes |
| `REACT_APP_WEBSOCKET_URL` | WebSocket server URL | Yes |
| `REACT_APP_AWS_REGION` | AWS region (ap-south-1) | Yes |
| `REACT_APP_USER_POOL_ID` | Cognito User Pool ID | Yes |
| `REACT_APP_CLIENT_ID` | Cognito Client ID | Yes |
| `REACT_APP_IDENTITY_POOL_ID` | Cognito Identity Pool ID | Yes |

## Development

### Available Scripts

- `npm start`: Start development server
- `npm run build`: Build for production
- `npm test`: Run tests
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier

### Code Style

The project uses:
- ESLint for code linting
- Prettier for code formatting
- TypeScript for type safety
- Tailwind CSS for consistent styling

### Testing

```bash
npm test
```

Tests are written using Jest and React Testing Library.

## Deployment

The frontend can be deployed to:
- AWS S3 + CloudFront
- Vercel
- Netlify
- Any static hosting service

For AWS deployment:
1. Build the project: `npm run build`
2. Upload the `build` folder to S3
3. Configure CloudFront distribution
4. Set up custom domain (optional)

## Performance Optimization

- Code splitting with React.lazy()
- Image optimization and lazy loading
- Service worker for caching
- Bundle size optimization
- CDN integration for static assets

## Accessibility

The app follows WCAG 2.1 AA guidelines:
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management
- Semantic HTML structure

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation wiki

---

Built with ❤️ for Viksit Bharat 2047