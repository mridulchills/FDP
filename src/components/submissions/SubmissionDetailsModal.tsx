
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, MapPin, Building, User, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import type { Submission } from '@/types';

interface SubmissionDetailsModalProps {
  submission: Submission | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SubmissionDetailsModal: React.FC<SubmissionDetailsModalProps> = ({
  submission,
  isOpen,
  onClose
}) => {
  if (!submission) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending HoD Approval':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Approved by HoD':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Rejected by HoD':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Approved by Admin':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejected by Admin':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderFormData = () => {
    const { formData } = submission;
    
    if (submission.moduleType === 'attended') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Program Type</label>
              <p className="mt-1">{formData.type}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Mode</label>
              <p className="mt-1">{formData.mode}</p>
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-500">Organizing Institution</label>
            <p className="mt-1 flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-400" />
              {formData.organizingInstitution}
            </p>
          </div>

          {formData.venue && (
            <div>
              <label className="text-sm font-medium text-gray-500">Venue</label>
              <p className="mt-1 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                {formData.venue}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Start Date</label>
              <p className="mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                {format(new Date(formData.startDate), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">End Date</label>
              <p className="mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                {format(new Date(formData.endDate), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Duration</label>
            <p className="mt-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              {formData.duration} {formData.durationType}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Domain</label>
            <p className="mt-1">{formData.domain === 'Other' ? formData.domainOther : formData.domain}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Objective</label>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{formData.objective}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Key Learnings</label>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{formData.keyLearnings}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Contribution</label>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{formData.contribution}</p>
          </div>

          {formData.sponsored && formData.sponsorName && (
            <div>
              <label className="text-sm font-medium text-gray-500">Sponsor</label>
              <p className="mt-1">{formData.sponsorName}</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-center py-4">
        <p className="text-gray-500">Form details not available for this module type.</p>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{submission.formData?.title || 'Submission Details'}</span>
            <Badge className={getStatusColor(submission.status)}>
              {submission.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Module Type</label>
              <p className="mt-1 capitalize">{submission.moduleType.replace('_', ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Submitted</label>
              <p className="mt-1">{format(new Date(submission.createdAt), 'MMM dd, yyyy HH:mm')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Last Updated</label>
              <p className="mt-1">{format(new Date(submission.updatedAt), 'MMM dd, yyyy HH:mm')}</p>
            </div>
          </div>

          {submission.documentUrl && (
            <div>
              <label className="text-sm font-medium text-gray-500">Document</label>
              <div className="mt-1">
                <Button variant="outline" size="sm" asChild>
                  <a href={submission.documentUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="w-4 h-4 mr-2" />
                    View Document
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Form Data */}
          <div>
            <h3 className="text-lg font-medium mb-4">Submission Details</h3>
            {renderFormData()}
          </div>

          {/* Comments */}
          {(submission.hodComment || submission.adminComment) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Comments</h3>
                {submission.hodComment && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-blue-800">HoD Comment</label>
                    <p className="mt-1 text-blue-700">{submission.hodComment}</p>
                  </div>
                )}
                {submission.adminComment && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <label className="text-sm font-medium text-green-800">Admin Comment</label>
                    <p className="mt-1 text-green-700">{submission.adminComment}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
