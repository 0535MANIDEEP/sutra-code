import React from 'react';
import { RecruiterDashboard } from '../../components/recruiter/RecruiterDashboard';

export const RecruiterPage: React.FC = () => {
  // In a real app, this would come from authentication context
  const recruiterId = 'recruiter-123';

  return (
    <div className="min-h-screen bg-gray-50">
      <RecruiterDashboard recruiterId={recruiterId} />
    </div>
  );
};