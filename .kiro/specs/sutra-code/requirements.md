# Requirements Document

## Problem Context: The Copy-Paste Crisis in Indian Engineering Education

**Meet Aarav** - a second-year computer science student from a Tier-2 college in Indore. He can complete coding assignments in 5 minutes using ChatGPT, but fails every technical interview because he doesn't understand the "Why" behind the code. This is the **Copy-Paste Crisis** plaguing Indian engineering education.

**The Crisis Statistics:**
- 95% of Indian CS students use AI tools for assignments (NASSCOM 2024)
- Only 25% can explain their own submitted code in interviews
- Tier-2/3 college students face additional barriers: language, limited resources, outdated pedagogy

**The Bharat Challenge:** While AI democratizes access to code, it's creating a generation of "copy-paste engineers" who lack fundamental problem-solving skills - the very skills that make Indian talent globally competitive.

## Introduction

Sutra-Code is a **Socratic AI Mentor** system designed to solve the Copy-Paste Crisis and bridge the industry-readiness gap for Indian students. Through "**Socratic Friction**" - a revolutionary pedagogical approach - the system forces students to think, struggle, and discover solutions rather than providing direct answers. This creates genuine learning that transforms students from code-copiers into problem-solvers, ensuring India's engineering talent remains globally competitive in the AI age.

## Glossary

- **Sutra_Code_System**: The complete Socratic AI Mentor platform
- **Socratic_Engine**: The core component that generates guided questions and prompts
- **Cultural_Analogy_Generator**: Component that creates culturally relevant analogies using Indian contexts
- **Faded_Scaffolds**: Incomplete code templates with strategic blanks for student completion
- **Voice_Viva**: Oral examination conducted through voice interaction
- **Struggle_Log**: Comprehensive tracking system for student learning activities
- **GitHub_Gatekeeper**: Component that controls code submission to repositories
- **Bhashini_API**: Government of India's language technology platform
- **Recruiter_Dashboard**: Interface for employers to view student portfolios
- **Student**: User of the system seeking to learn programming concepts
- **Recruiter**: Employer or hiring manager reviewing student portfolios

## Requirements

### Requirement 1: Socratic Guidance System - Preventing the Aarav Scenario

**User Story:** As a student like Aarav, I want to receive guided questions instead of direct solutions, so that I can develop genuine understanding of programming concepts and succeed in technical interviews.

**Connection to Crisis:** To prevent the Aarav scenario where students can code but can't explain, the system must force conceptual understanding before providing any implementation guidance.

#### Acceptance Criteria

1. WHEN a Student like Aarav requests a code solution, THE Socratic_Engine SHALL respond within 2 seconds with a guiding question containing zero executable code snippets, preventing copy-paste behavior
2. WHEN a Student provides an incorrect answer, THE Socratic_Engine SHALL generate a follow-up question within 1.5 seconds that addresses the specific misconception using cultural analogies
3. WHEN a Student demonstrates 80% conceptual understanding (measured via 3 consecutive correct Socratic responses), THE Socratic_Engine SHALL progress to faded scaffolding within 1 second
4. THE Socratic_Engine SHALL maintain conversation context for up to 50 interactions per session with 99.9% state consistency using DynamoDB
5. WHEN a Student attempts solution-seeking behavior (detected via NLP pattern matching), THE Socratic_Engine SHALL redirect with cultural analogies within 1 second, logging the attempt for Grit Score calculation

### Requirement 2: Cultural Analogy Integration

**User Story:** As a student from India, I want programming concepts explained through familiar cultural contexts, so that I can better understand and relate to the material.

#### Acceptance Criteria

1. WHEN a Student asks for explanation of a programming concept, THE Cultural_Analogy_Generator SHALL provide an analogy using Indian cultural references
2. THE Cultural_Analogy_Generator SHALL use contexts such as cricket, traditional markets (mandi), festivals, or regional practices
3. WHEN generating analogies, THE Cultural_Analogy_Generator SHALL ensure accuracy of both the cultural reference and the programming concept
4. THE Cultural_Analogy_Generator SHALL adapt analogies based on the complexity level of the programming concept
5. WHEN a Student indicates confusion about an analogy, THE Cultural_Analogy_Generator SHALL provide an alternative cultural reference

### Requirement 3: Faded Scaffolding System

**User Story:** As a student, I want to receive partial code templates that I must complete, so that I can practice implementation while having structural guidance.

#### Acceptance Criteria

1. WHEN a Student demonstrates conceptual understanding, THE Sutra_Code_System SHALL provide Faded_Scaffolds instead of complete code
2. THE Faded_Scaffolds SHALL contain strategic blanks that require the Student to implement key logic components
3. WHEN a Student completes a scaffold incorrectly, THE Sutra_Code_System SHALL provide hints without revealing the complete solution
4. THE Faded_Scaffolds SHALL gradually reduce support as the Student demonstrates increased competency
5. WHEN a Student successfully completes scaffolds, THE Sutra_Code_System SHALL track their progress for portfolio generation

### Requirement 4: Voice Viva Examination

**User Story:** As a student, I want to participate in voice-based examinations, so that I can demonstrate my understanding verbally before finalizing code submissions.

#### Acceptance Criteria

1. WHEN a Student completes a coding exercise with 80% scaffold completion, THE Sutra_Code_System SHALL trigger a Voice_Viva session within 2 seconds
2. THE Voice_Viva SHALL use Bhashini_API for multilingual voice interaction with <3 second STT processing and 95% accuracy for Indian accents
3. WHEN conducting a Voice_Viva, THE Sutra_Code_System SHALL ask exactly 5 conceptual questions with 30-second response time limits per question
4. THE Voice_Viva SHALL evaluate Student responses using NLP sentiment analysis achieving 90% accuracy in conceptual understanding assessment before allowing code finalization
5. WHEN a Student scores <70% on Voice_Viva (measured via Bhashini confidence scores), THE Sutra_Code_System SHALL require additional Socratic guidance before allowing progression

### Requirement 5: Grit Score Analytics - Measuring Effort, Not Just Output

**User Story:** As a recruiter, I want to see a student's **Grit Score** - a measure of their learning persistence and problem-solving resilience - so that I can identify candidates who will thrive in challenging technical roles.

#### Acceptance Criteria

1. THE Struggle_Log SHALL calculate a **Grit Score** (0-100 scale) using weighted algorithms: 40% persistence time, 25% error recovery speed, 20% question quality, 10% learning velocity, 5% authenticity detection
2. WHEN a Student makes an error, THE Struggle_Log SHALL capture **Learning Resilience Metrics** within 100ms: error classification (syntax/logic/conceptual), resolution time (milliseconds), help-seeking behavior (binary: independent/assisted)
3. THE Struggle_Log SHALL track **Deep Work Patterns** using 5-minute time windows: sustained focus periods (>20 minutes), distraction events (context switches), breakthrough moments (sudden progress acceleration)
4. WHEN a Student seeks help, THE Struggle_Log SHALL classify requests using NLP analysis: **Productive Struggle** (concept-seeking, 80% learning value) vs **Shortcut Seeking** (solution-seeking, 20% learning value)
5. THE Struggle_Log SHALL generate **Effort Visualization** dashboards updating every 30 seconds with learning journey heatmaps, progress velocity charts, and skill mastery timelines

### Requirement 6: Empowering Bharat Through Multilingual Mastery

**User Story:** As a student from Tier-2/3 cities who thinks in my native language, I want to master global technical standards in my mother tongue, so that language barriers don't limit my potential in the global tech economy.

#### Acceptance Criteria

1. THE Sutra_Code_System SHALL integrate with Bhashini_API to support exactly 22 Indian languages: Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Odia, Punjabi, Assamese, Urdu, Sanskrit, Konkani, Manipuri, Nepali, Bodo, Santhali, Maithili, Kashmiri, Sindhi, and Dogri
2. WHEN a Student from rural/semi-urban areas selects their preferred language, THE Sutra_Code_System SHALL conduct all technical discussions in that language with 95% translation accuracy, verified against Bhashini benchmarks
3. THE Sutra_Code_System SHALL provide **Cultural Code-Switching** with <500ms latency between native language explanations and English technical terms
4. WHEN explaining algorithms, THE Sutra_Code_System SHALL select region-appropriate cultural contexts based on student's IP geolocation with 90% cultural relevance accuracy
5. THE Voice_Viva SHALL support accent-aware speech recognition achieving 92% accuracy for Indian English and 88% accuracy for regional languages using Bhashini STT models

### Requirement 7: GitHub Integration and Gatekeeper

**User Story:** As a student, I want my final code to be automatically submitted to GitHub with proper documentation, so that I can build a professional portfolio.

#### Acceptance Criteria

1. WHEN a Student achieves Voice_Viva score ≥70% AND scaffold completion ≥80% AND minimum 2 hours struggle time, THE GitHub_Gatekeeper SHALL allow code submission within 5 seconds
2. THE GitHub_Gatekeeper SHALL prevent code submission using API rate limiting (1 attempt per hour) until Voice_Viva requirements are met with cryptographic verification
3. WHEN submitting code, THE GitHub_Gatekeeper SHALL include learning analytics (Grit Score, struggle patterns, cultural analogies used) as markdown documentation with 100% data completeness
4. THE GitHub_Gatekeeper SHALL create meaningful commit messages using NLP templates: "Learned [concept] via [cultural_analogy] - Grit Score: [score] - Struggle Time: [hours]"
5. WHEN code is submitted, THE GitHub_Gatekeeper SHALL update the Student's portfolio using GraphQL mutations with <2 second response time and 99.9% success rate

### Requirement 8: Recruiter Portfolio Dashboard

**User Story:** As a recruiter, I want to access comprehensive student portfolios with learning analytics, so that I can make informed hiring decisions based on genuine skill assessment.

#### Acceptance Criteria

1. THE Recruiter_Dashboard SHALL display student portfolios with 15 data points: code submissions, Grit Scores, learning velocity, cultural analogy effectiveness, Voice Viva transcripts, error recovery patterns, and 9 additional metrics
2. WHEN viewing a portfolio, THE Recruiter_Dashboard SHALL render interactive visualizations (heatmaps, progress charts, skill radars) within 3 seconds using D3.js with 99% uptime
3. THE Recruiter_Dashboard SHALL provide filtering capabilities supporting 20+ criteria: programming languages, Grit Score ranges (0-100), learning patterns, project complexity levels, with <1 second query response time
4. WHEN a Student grants permission via OAuth 2.0, THE Recruiter_Dashboard SHALL display Voice_Viva performance with Bhashini confidence scores, question-answer pairs, and conceptual understanding metrics
5. THE Recruiter_Dashboard SHALL generate comparative analytics across 1000+ students using ML algorithms, producing recruitment insights with statistical significance (p<0.05) and confidence intervals

### Requirement 9: Serverless Architecture Implementation

**User Story:** As a system administrator, I want the platform to be built on scalable serverless architecture, so that it can handle varying loads efficiently and cost-effectively.

#### Acceptance Criteria

1. THE Sutra_Code_System SHALL be implemented using AWS serverless services including Lambda, DynamoDB, and Bedrock
2. WHEN system load increases, THE Sutra_Code_System SHALL automatically scale without manual intervention
3. THE Sutra_Code_System SHALL maintain response times under 3 seconds for all user interactions
4. WHEN storing data, THE Sutra_Code_System SHALL use DynamoDB for scalable and reliable data persistence
5. THE Sutra_Code_System SHALL integrate with AWS Bedrock for Agentic Workflow using Claude 3 Haiku educational content generation

### Requirement 11: Digital Bharat Accessibility - Low Bandwidth Mode

**User Story:** As a student in rural India with unstable internet connectivity, I want to continue learning even with poor network conditions, so that my geographic location doesn't limit my educational opportunities.

#### Acceptance Criteria

1. THE Sutra_Code_System SHALL detect network conditions using AWS CloudWatch metrics and automatically switch to Low Bandwidth Mode when connection speed drops below 1 Mbps for 3 consecutive seconds
2. WHEN in Low Bandwidth Mode, THE Sutra_Code_System SHALL compress payloads using Brotli algorithm achieving 85% size reduction and serve cached responses within 800ms from AWS CloudFront edge locations
3. THE Sutra_Code_System SHALL provide **Offline Learning Packets** - 50MB downloadable modules containing 20 cultural analogies and 15 scaffold templates that function without internet connectivity
4. WHEN connectivity is restored, THE Sutra_Code_System SHALL sync all offline learning progress using DynamoDB Streams with eventual consistency within 30 seconds
5. THE Sutra_Code_System SHALL maintain core Socratic functionality during network degradation by serving pre-cached responses for the top 100 most common programming concepts

### Requirement 12: Viksit Bharat 2047 Scalability

**User Story:** As an educational policymaker, I want the system to scale across India's diverse educational landscape, so that it can contribute to Viksit Bharat 2047's vision of inclusive digital education.

#### Acceptance Criteria

1. THE Sutra_Code_System SHALL support 100,000 concurrent students with auto-scaling Lambda functions maintaining 99.9% uptime and <3 second response times during peak usage
2. WHEN deployed at national scale, THE Sutra_Code_System SHALL process 1 million Voice Viva sessions daily using AWS Bedrock with automatic failover across Mumbai, Hyderabad, and Chennai regions
3. THE Sutra_Code_System SHALL provide **State-wise Analytics Dashboards** updating every 15 minutes with learning outcome metrics for 28 Indian states and 8 union territories
4. THE Sutra_Code_System SHALL integrate with SWAYAM, NPTEL, and state university systems via REST APIs supporting 10,000 API calls per minute with OAuth 2.0 authentication
5. THE Sutra_Code_System SHALL support **Institution Whitelabeling** allowing 1,000+ colleges to customize cultural contexts while maintaining core pedagogical algorithms with 99.5% consistency

### Requirement 10: DPDP Act 2023 Compliance and Responsible AI

**User Story:** As a student, I want my learning data and voice recordings to be protected under Indian data protection laws, so that I can learn safely while contributing to India's digital education ecosystem.

#### Acceptance Criteria

1. THE Sutra_Code_System SHALL comply with Digital Personal Data Protection Act 2023, ensuring all student data processing has explicit consent and purpose limitation
2. WHEN a Student creates an account, THE Sutra_Code_System SHALL implement **Aadhaar-optional authentication** with multiple identity verification methods
3. THE Sutra_Code_System SHALL provide **Data Residency Guarantee** - all Indian student data stored within Indian borders using AWS India regions
4. WHEN sharing data with recruiters, THE Sutra_Code_System SHALL implement **Granular Consent Management** allowing students to control exactly what learning metrics are shared
5. THE Sutra_Code_System SHALL provide **Right to Erasure** and **Data Portability** as mandated by DPDP Act 2023