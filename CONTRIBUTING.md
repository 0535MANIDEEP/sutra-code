# 🤝 Contributing to Sutra-Code

Thank you for your interest in contributing to Sutra-Code! We're building the future of programming education in India, and we'd love your help.

## 🎯 **Our Mission**

Sutra-Code aims to transform Indian programming education by:
- Preventing copy-paste culture through Socratic questioning
- Building genuine problem-solving skills
- Integrating authentic Indian cultural contexts
- Supporting all 22 official Indian languages

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+ and npm
- Git
- Basic knowledge of TypeScript/React
- Understanding of AWS services (for backend contributions)

### **Development Setup**
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/0535MANIDEEP/sutra-code.git
cd sutra-code

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Set up environment
cp frontend/.env.example frontend/.env

# Start development
cd frontend && npm start
```

## 📋 **How to Contribute**

### **1. Types of Contributions**

#### **🐛 Bug Reports**
- Use GitHub Issues with the "bug" label
- Include steps to reproduce
- Provide system information
- Add screenshots if applicable

#### **💡 Feature Requests**
- Use GitHub Issues with the "enhancement" label
- Explain the educational value
- Consider cultural relevance for Indian learners
- Provide use cases and examples

#### **📝 Code Contributions**
- Fork the repository
- Create a feature branch
- Make your changes
- Add tests
- Submit a pull request

#### **🌍 Localization**
- Help translate to Indian languages
- Improve cultural analogies
- Add region-specific contexts
- Validate language accuracy

#### **📚 Documentation**
- Improve README and guides
- Add code comments
- Create tutorials
- Write educational content

### **2. Development Workflow**

#### **Branch Naming**
```bash
feature/socratic-engine-improvement
bugfix/authentication-issue
docs/api-documentation
localization/hindi-translation
```

#### **Commit Messages**
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```bash
feat: add voice interaction for Tamil language
fix: resolve authentication timeout issue
docs: update API documentation
test: add property-based tests for analogies
```

#### **Pull Request Process**
1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write clean, documented code
   - Follow existing code style
   - Add appropriate tests

3. **Test Your Changes**
   ```bash
   npm test                    # Run all tests
   npm run test:unit          # Unit tests
   npm run test:integration   # Integration tests
   ```

4. **Submit Pull Request**
   - Clear title and description
   - Reference related issues
   - Include screenshots for UI changes
   - Ensure all checks pass

## 🎨 **Code Style Guidelines**

### **TypeScript/JavaScript**
- Use TypeScript for type safety
- Follow ESLint configuration
- Use Prettier for formatting
- Prefer functional components
- Use meaningful variable names

```typescript
// Good
const generateCulturalAnalogy = (concept: string, region: string): CulturalAnalogy => {
  // Implementation
};

// Avoid
const genAnal = (c: string, r: string) => {
  // Implementation
};
```

### **React Components**
- Use functional components with hooks
- Implement proper error boundaries
- Add accessibility attributes
- Support multiple languages

```tsx
// Good
interface SocraticQuestionProps {
  question: string;
  culturalContext: string;
  language: string;
  onResponse: (response: string) => void;
}

export const SocraticQuestion: React.FC<SocraticQuestionProps> = ({
  question,
  culturalContext,
  language,
  onResponse
}) => {
  // Component implementation
};
```

### **AWS Lambda Functions**
- Use TypeScript
- Implement proper error handling
- Add comprehensive logging
- Follow security best practices

```typescript
// Good
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Validate input
    const { studentId, question } = JSON.parse(event.body || '{}');
    
    if (!studentId || !question) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Process request
    const response = await processSocraticQuestion(studentId, question);
    
    return {
      statusCode: 200,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

## 🧪 **Testing Guidelines**

### **Test Types**
- **Unit Tests** - Individual functions and components
- **Integration Tests** - API endpoints and workflows
- **Property-Based Tests** - Universal correctness properties
- **Security Tests** - Authentication and authorization

### **Writing Tests**
```typescript
// Unit Test Example
describe('CulturalAnalogyGenerator', () => {
  it('should generate cricket analogy for sorting', () => {
    const analogy = generateCulturalAnalogy('sorting', 'cricket');
    expect(analogy.context).toContain('batting order');
    expect(analogy.concept).toBe('sorting');
  });
});

// Property-Based Test Example
describe('Socratic Engine Properties', () => {
  it('should always return a question for valid input', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1 }),
      fc.string({ minLength: 1 }),
      (studentId, question) => {
        const response = processSocraticQuestion(studentId, question);
        return response.guidingQuestion.length > 0;
      }
    ));
  });
});
```

## 🌍 **Cultural Contributions**

### **Adding Cultural Analogies**
When adding new cultural contexts:

1. **Authenticity** - Use genuine Indian experiences
2. **Inclusivity** - Consider diverse regional contexts
3. **Accuracy** - Ensure technical correctness
4. **Respect** - Maintain cultural sensitivity

```typescript
// Example: Adding a new cultural context
const culturalContexts = {
  mumbai: {
    localTrains: {
      concept: 'queues',
      analogy: 'Local train boarding follows queue discipline during peak hours',
      explanation: 'Just like passengers wait in line for trains, queue data structure follows FIFO principle'
    }
  }
};
```

### **Language Localization**
- Use native speakers for translations
- Maintain technical accuracy
- Consider regional variations
- Test with actual users

## 🔒 **Security Guidelines**

### **Data Protection**
- Never commit sensitive data
- Use environment variables for secrets
- Implement proper encryption
- Follow DPDP Act 2023 requirements

### **Authentication**
- Validate all inputs
- Implement proper session management
- Use secure communication (HTTPS)
- Add audit logging

## 📚 **Educational Guidelines**

### **Socratic Method**
- Ask guiding questions, don't give direct answers
- Build on student's existing knowledge
- Use appropriate difficulty progression
- Encourage critical thinking

### **Cultural Integration**
- Use familiar Indian contexts
- Respect cultural diversity
- Avoid stereotypes
- Make learning relatable

## 🏆 **Recognition**

### **Contributors**
All contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation
- Special recognition for significant contributions

### **Types of Recognition**
- **Code Contributors** - Technical improvements
- **Cultural Contributors** - Analogies and localization
- **Educational Contributors** - Pedagogical improvements
- **Community Contributors** - Documentation and support

## 📞 **Getting Help**

### **Questions?**
- **GitHub Discussions** - General questions and ideas
- **GitHub Issues** - Bug reports and feature requests
- **Email** - sutra.code.ai@gmail.com for sensitive matters

### **Code Review**
- All contributions go through code review
- Maintainers will provide constructive feedback
- Be patient and responsive to feedback
- Learn from the review process

## 🎯 **Contribution Areas**

### **High Priority**
- [ ] Voice interaction improvements
- [ ] Cultural analogy expansion
- [ ] Performance optimizations
- [ ] Mobile responsiveness
- [ ] Accessibility improvements

### **Medium Priority**
- [ ] Additional language support
- [ ] Advanced analytics
- [ ] Integration improvements
- [ ] Documentation updates

### **Good First Issues**
Look for issues labeled `good-first-issue` for beginner-friendly contributions.

## 📋 **Code of Conduct**

### **Our Standards**
- Be respectful and inclusive
- Focus on educational impact
- Maintain professional communication
- Respect cultural diversity
- Support fellow contributors

### **Unacceptable Behavior**
- Harassment or discrimination
- Inappropriate content
- Spam or self-promotion
- Violation of privacy
- Disrespectful communication

## 🚀 **Release Process**

### **Versioning**
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** - Breaking changes
- **MINOR** - New features
- **PATCH** - Bug fixes

### **Release Schedule**
- **Major releases** - Quarterly
- **Minor releases** - Monthly
- **Patch releases** - As needed

---

## 🙏 **Thank You**

Your contributions help build the future of programming education in India. Every bug fix, feature addition, cultural analogy, and documentation improvement makes a difference in a student's learning journey.

Together, we're creating a more inclusive, culturally-aware, and effective way to learn programming. Thank you for being part of this mission!

---

<div align="center">

**Questions? Need help getting started?**

[💬 Start a Discussion](https://github.com/0535MANIDEEP/sutra-code/discussions) | [🐛 Report an Issue](https://github.com/0535MANIDEEP/sutra-code/issues) | [📧 Email Us](mailto:sutra.code.ai@gmail.com)

</div>