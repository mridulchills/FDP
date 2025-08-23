
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Edit, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { Submission, SubmissionStatus, ProgramAttendedData, ProgramOrganizedData, CertificationData } from '@/types';

interface SubmissionsTableProps {
  submissions: Submission[];
  onView: (submission: Submission) => void;
  onEdit: (submission: Submission) => void;
  onDelete: (id: string, status: SubmissionStatus) => void;
  isLoading?: boolean;
}

const getStatusColor = (status: SubmissionStatus) => {
  switch (status) {
    case 'Pending Faculty Development Cell Approval':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Approved by Faculty Development Cell':
      return 'bg-blue-100 text-blue-900 border-blue-200';
    case 'Rejected by Faculty Development Cell':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Pending HoD Approval':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Approved by HoD':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Rejected by HoD':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Pending Accounts Approval':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Approved by Accounts':
      return 'bg-green-100 text-green-900 border-green-200';
    case 'Rejected by Accounts':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getModuleTypeLabel = (moduleType: string) => {
  switch (moduleType) {
    case 'attended':
      return 'Programs Attended';
    case 'organized':
      return 'Programs Organized';
    case 'certification':
      return 'Certifications';
    default:
      return moduleType;
  }
};

const getSubmissionTitle = (submission: Submission) => {
  const { formData, moduleType } = submission;
  if (moduleType === 'attended' || moduleType === 'organized') {
    return (formData as ProgramAttendedData | ProgramOrganizedData).title;
  } else if (moduleType === 'certification') {
    return (formData as CertificationData).courseName;
  }
  return 'Untitled';
};

const getSubmissionType = (submission: Submission) => {
  const { formData, moduleType } = submission;
  if (moduleType === 'attended' || moduleType === 'organized') {
    return (formData as ProgramAttendedData | ProgramOrganizedData).type;
  } else if (moduleType === 'certification') {
    const certData = formData as CertificationData;
    return certData.platform === 'Other' ? certData.platformOther : certData.platform;
  }
  return null;
};

export const SubmissionsTable: React.FC<SubmissionsTableProps> = ({
  submissions,
  onView,
  onEdit,
  onDelete,
  isLoading = false
}) => {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
        <p className="text-gray-500 mb-4">You haven't made any submissions yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Module Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => {
            const title = getSubmissionTitle(submission);
            const type = getSubmissionType(submission);
            
            return (
              <TableRow key={submission.id} className="hover:bg-gray-50 transition-colors">
                <TableCell>
                  <div className="font-medium">{title}</div>
                  {type && (
                    <div className="text-sm text-gray-500">{type}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {getModuleTypeLabel(submission.moduleType)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(submission.status)}>
                    {submission.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {format(new Date(submission.createdAt), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {format(new Date(submission.updatedAt), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(submission)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(submission)}
                      disabled={submission.status !== 'Pending Faculty Development Cell Approval'}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(submission.id, submission.status)}
                      disabled={submission.status !== 'Pending Faculty Development Cell Approval' || isLoading}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
