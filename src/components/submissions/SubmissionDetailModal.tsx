import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, Clock, MapPin, Users, DollarSign, Target } from 'lucide-react';
import type { Submission, ProgramAttendedData, ProgramOrganizedData, CertificationData } from '@/types';

interface SubmissionDetailModalProps {
  submission: Submission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewDocument?: (submission: Submission) => void;
}

export const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  submission,
  open,
  onOpenChange,
  onViewDocument
}) => {
  if (!submission) return null;

  const renderAttendedDetails = (data: ProgramAttendedData) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailItem icon={<Calendar />} label="Type" value={data.type} />
        <DetailItem icon={<Clock />} label="Mode" value={data.mode} />
        <DetailItem icon={<Calendar />} label="Start Date" value={data.startDate} />
        <DetailItem icon={<Calendar />} label="End Date" value={data.endDate} />
        <DetailItem icon={<Clock />} label="Duration" value={`${data.duration} ${data.durationType}`} />
        <DetailItem icon={<MapPin />} label="Domain" value={data.domain === 'Other' ? data.domainOther : data.domain} />
      </div>
      
      <DetailItem 
        icon={<MapPin />} 
        label="Organizing Institution" 
        value={data.organizingInstitution} 
      />
      
      {data.venue && <DetailItem icon={<MapPin />} label="Venue" value={data.venue} />}
      
      <div className="space-y-4">
        <DetailSection label="Objective" content={data.objective} />
        <DetailSection label="Key Learnings" content={data.keyLearnings} />
        <DetailSection label="Contribution to Institution" content={data.contribution} />
      </div>

      {data.sponsored && (
        <DetailItem icon={<DollarSign />} label="Sponsored By" value={data.sponsorName || 'N/A'} />
      )}
    </div>
  );

  const renderOrganizedDetails = (data: ProgramOrganizedData) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailItem icon={<Calendar />} label="Type" value={data.type} />
        <DetailItem icon={<Clock />} label="Mode" value={data.mode} />
        <DetailItem icon={<Calendar />} label="Start Date" value={data.startDate} />
        <DetailItem icon={<Calendar />} label="End Date" value={data.endDate} />
        <DetailItem icon={<Clock />} label="Duration" value={`${data.duration} ${data.durationType}`} />
        <DetailItem icon={<Users />} label="Participants" value={data.participants.toString()} />
        <DetailItem icon={<Target />} label="Role" value={data.role} />
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Target Audience</p>
        <div className="flex flex-wrap gap-2">
          {data.targetAudience.map((audience) => (
            <Badge key={audience} variant="secondary">{audience}</Badge>
          ))}
        </div>
      </div>

      {data.collaboratingPartners && (
        <DetailSection label="Collaborating Partners" content={data.collaboratingPartners} />
      )}

      {data.budgetApproval && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DetailItem icon={<DollarSign />} label="Budget Amount" value={`₹${data.budgetAmount || 0}`} />
          <DetailItem icon={<DollarSign />} label="Funding Source" value={data.fundingSource || 'N/A'} />
        </div>
      )}

      <div className="space-y-4">
        <DetailSection label="Outcome Summary" content={data.outcomeSummary} />
        {data.participantFeedback && (
          <DetailSection label="Participant Feedback" content={data.participantFeedback} />
        )}
        {data.publicationLinks && (
          <DetailSection label="Publications/Media Coverage" content={data.publicationLinks} />
        )}
      </div>
    </div>
  );

  const renderCertificationDetails = (data: CertificationData) => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailItem icon={<FileText />} label="Platform" value={data.platform === 'Other' ? data.platformOther : data.platform} />
        <DetailItem icon={<Target />} label="Domain" value={data.domain} />
        <DetailItem icon={<Clock />} label="Duration" value={`${data.duration} ${data.durationType}`} />
        <DetailItem icon={<Clock />} label="Mode" value={data.mode} />
        <DetailItem icon={<FileText />} label="Status" value={data.status} />
      </div>

      <div className="space-y-4">
        <DetailSection label="Relevance to Teaching/Research" content={data.relevance} />
        <DetailSection label="Implementation in Teaching/Research" content={data.implementation} />
      </div>
    </div>
  );

  const getTitle = () => {
    if (submission.moduleType === 'attended' || submission.moduleType === 'organized') {
      return (submission.formData as ProgramAttendedData | ProgramOrganizedData).title;
    } else if (submission.moduleType === 'certification') {
      return (submission.formData as CertificationData).courseName;
    }
    return 'Submission Details';
  };

  const getModuleTypeName = () => {
    switch (submission.moduleType) {
      case 'attended': return 'Program/Workshop Attended';
      case 'organized': return 'Program/Workshop Organized';
      case 'certification': return 'Professional Certification';
      default: return 'Submission';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{getTitle()}</DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="capitalize">
              {getModuleTypeName()}
            </Badge>
            <Badge className={getStatusColor(submission.status)}>
              {submission.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Submitter Information */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">Submitter Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Name</p>
                <p className="font-medium">{submission.user?.name}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Department</p>
                <p className="font-medium">{submission.user?.department}</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Submitted On</p>
                <p className="font-medium">{new Date(submission.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Module-specific Details */}
          <div>
            <h3 className="font-semibold mb-4">Details</h3>
            {submission.moduleType === 'attended' && renderAttendedDetails(submission.formData as ProgramAttendedData)}
            {submission.moduleType === 'organized' && renderOrganizedDetails(submission.formData as ProgramOrganizedData)}
            {submission.moduleType === 'certification' && renderCertificationDetails(submission.formData as CertificationData)}
          </div>

          {/* Comments Section */}
          {(submission.fdcComment || submission.hodComment || submission.accountsComment) && (
            <div className="space-y-3">
              <h3 className="font-semibold">Comments</h3>
              {submission.fdcComment && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">FDC Comment</p>
                  <p className="text-sm mt-1">{submission.fdcComment}</p>
                </div>
              )}
              {submission.hodComment && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
                  <p className="text-sm font-medium text-purple-900 dark:text-purple-100">HoD Comment</p>
                  <p className="text-sm mt-1">{submission.hodComment}</p>
                </div>
              )}
              {submission.accountsComment && (
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">Accounts Comment</p>
                  <p className="text-sm mt-1">{submission.accountsComment}</p>
                </div>
              )}
            </div>
          )}

          {/* Document */}
          {submission.documentUrl && onViewDocument && (
            <div>
              <Button
                variant="outline"
                onClick={() => onViewDocument(submission)}
                className="w-full"
              >
                <FileText className="w-4 h-4 mr-2" />
                View Supporting Document
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper Components
const DetailItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-2">
    <div className="text-gray-500 mt-0.5">{icon}</div>
    <div>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  </div>
);

const DetailSection: React.FC<{ label: string; content: string }> = ({ label, content }) => (
  <div>
    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{content}</p>
  </div>
);

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Pending FDC Approval':
    case 'Pending HoD Approval':
    case 'Pending Accounts Approval':
      return 'bg-yellow-100 text-yellow-800';
    case 'Approved by FDC':
    case 'Approved by HoD':
    case 'Approved by Accounts':
      return 'bg-green-100 text-green-800';
    case 'Rejected by FDC':
    case 'Rejected by HoD':
    case 'Rejected by Accounts':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};
