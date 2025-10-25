import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { submissionService } from '@/services/submissionService';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import type { Submission, ProgramAttendedData, ProgramOrganizedData, CertificationData } from '@/types';

export const ApprovalsDashboard: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getSignedUrl } = useFileUpload();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadSubmissions();
  }, [user]);

  const loadSubmissions = async () => {
    try {
      let result;
      if (user?.role === 'hod' || user?.role === 'admin' || user?.role === 'accounts') {
        result = await submissionService.getAllSubmissions();
      } else {
        return;
      }

      if (result.error) {
        throw result.error;
      }

      // Filter submissions based on role and status
      let filteredSubmissions = result.data || [];
      
      if (user?.role === 'admin') {
        // FDC sees submissions pending FDC approval
        filteredSubmissions = filteredSubmissions.filter(s => 
          s.status === 'Pending FDC Approval'
        );
      } else if (user?.role === 'hod') {
        // HoD sees submissions pending HoD approval
        filteredSubmissions = filteredSubmissions.filter(s => 
          s.status === 'Pending HoD Approval'
        );
        } else if (user?.role === 'accounts') {
        // Accounts sees submissions pending accounts approval
        filteredSubmissions = filteredSubmissions.filter(s => 
          s.status === 'Pending Accounts Approval'
        );
      }

      setSubmissions(filteredSubmissions);
    } catch (error: any) {
      console.error('Error loading submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load submissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (submissionId: string, approved: boolean) => {
    setProcessingId(submissionId);
    
    try {
      let newStatus;
      let commentField;
      
      if (user?.role === 'admin') {
        newStatus = approved ? 'Approved by FDC' : 'Rejected by FDC';
        commentField = 'fdcComment';
      } else if (user?.role === 'hod') {
        newStatus = approved ? 'Approved by HoD' : 'Rejected by HoD';
        commentField = 'hodComment';
      } else if (user?.role === 'accounts') {
        newStatus = approved ? 'Approved by Accounts' : 'Rejected by Accounts';
        commentField = 'accountsComment';
      } else {
        throw new Error('Unauthorized');
      }

      const updates: Partial<Submission> = {
        status: newStatus as any,
        [commentField]: comments[submissionId] || ''
      };

      const result = await submissionService.updateSubmission(submissionId, updates);
      
      if (result.error) {
        throw result.error;
      }

      toast({
        title: approved ? "Approved" : "Rejected",
        description: `Submission has been ${approved ? 'approved' : 'rejected'} successfully`,
      });

      // Remove from list and clear comment
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      setComments(prev => {
        const newComments = { ...prev };
        delete newComments[submissionId];
        return newComments;
      });
      
    } catch (error: any) {
      console.error('Error processing submission:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process submission",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewDocument = async (submission: Submission) => {
    if (!submission.documentUrl) {
      toast({
        title: "Document Not Found",
        description: "No document has been uploaded for this submission.",
        variant: "destructive",
      });
      return;
    }

    try {
      
      
      // Get signed URL for the document using the file path
      const signedUrl = await getSignedUrl(submission.documentUrl);
      
      if (signedUrl) {

        window.open(signedUrl, '_blank');
      } else {
        toast({
          title: "Access Denied",
          description: "Document not found or access denied. You may not have permission to view this file.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error viewing document:', error);
      toast({
        title: "Failed to Load Document",
        description: error?.message || "Document not found or access denied.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending FDC Approval':
      case 'Pending HoD Approval':
      case 'Pending Accounts Approval':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Approved by FDC':
      case 'Approved by HoD':
      case 'Approved by Accounts':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Rejected by FDC':
      case 'Rejected by HoD':
      case 'Rejected by Accounts':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

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

  const getSubmissionTitle = (submission: Submission) => {
    if (submission.moduleType === 'attended' || submission.moduleType === 'organized') {
      return (submission.formData as ProgramAttendedData | ProgramOrganizedData).title;
    } else if (submission.moduleType === 'certification') {
      return (submission.formData as CertificationData).courseName;
    }
    return 'Untitled Submission';
  };

  const getSubmissionDetails = (submission: Submission) => {
    if (submission.moduleType === 'attended') {
      const data = submission.formData as ProgramAttendedData;
      return {
        type: data.type,
        mode: data.mode,
        duration: `${data.duration} ${data.durationType}`,
        startDate: data.startDate,
        endDate: data.endDate,
        institution: data.organizingInstitution,
        objective: data.objective
      };
    } else if (submission.moduleType === 'organized') {
      const data = submission.formData as ProgramOrganizedData;
      return {
        type: data.type,
        mode: data.mode,
        duration: `${data.duration} ${data.durationType}`,
        startDate: data.startDate,
        endDate: data.endDate,
        institution: 'N/A',
        objective: data.outcomeSummary
      };
    } else if (submission.moduleType === 'certification') {
      const data = submission.formData as CertificationData;
      return {
        type: data.platform,
        mode: data.mode,
        duration: `${data.duration} ${data.durationType}`,
        startDate: 'N/A',
        endDate: 'N/A',
        institution: data.platform,
        objective: data.relevance
      };
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.role === 'admin' ? 'Pending FDC Approvals' : 
           user?.role === 'hod' ? 'Pending HoD Approvals' : 
           'Pending Accounts Approvals'}
        </h1>
        <Badge variant="secondary">
          {submissions.length} pending
        </Badge>
      </div>

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No pending submissions</p>
              <p className="text-sm">All submissions have been processed.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {submissions.map((submission) => {
            const details = getSubmissionDetails(submission);
            return (
              <Card key={submission.id} className="border border-gray-200">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {getSubmissionTitle(submission)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="capitalize">
                          {submission.moduleType.replace('_', ' ')}
                        </Badge>
                        <Badge className={getStatusColor(submission.status)}>
                          <div className="flex items-center gap-1">
                            {getStatusIcon(submission.status)}
                            {submission.status}
                          </div>
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p className="font-medium">{submission.user?.name}</p>
                      <p>{submission.user?.department}</p>
                      <p>{new Date(submission.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {details && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Type:</strong> {details.type}</p>
                        <p><strong>Mode:</strong> {details.mode}</p>
                        <p><strong>Duration:</strong> {details.duration}</p>
                      </div>
                      <div>
                        <p><strong>Start Date:</strong> {details.startDate}</p>
                        <p><strong>End Date:</strong> {details.endDate}</p>
                        <p><strong>Institution:</strong> {details.institution}</p>
                      </div>
                    </div>
                  )}

                  {details?.objective && (
                    <div>
                      <p className="font-medium text-sm">
                        {submission.moduleType === 'organized' ? 'Outcome Summary:' : 
                         submission.moduleType === 'certification' ? 'Relevance:' : 'Objective:'}
                      </p>
                      <p className="text-sm text-gray-600">{details.objective}</p>
                    </div>
                  )}

                  {submission.documentUrl && (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDocument(submission)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        View Document
                      </Button>
                    </div>
                  )}

                  <div className="space-y-3 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium">
                        {user?.role === 'admin' ? 'FDC Comment' : 
                         user?.role === 'hod' ? 'HoD Comment' : 
                         'Accounts Comment'}:
                      </label>
                      <Textarea
                        placeholder="Add your comment (optional)..."
                        value={comments[submission.id] || ''}
                        onChange={(e) => setComments(prev => ({
                          ...prev,
                          [submission.id]: e.target.value
                        }))}
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleApproval(submission.id, true)}
                        disabled={processingId === submission.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {processingId === submission.id ? 'Processing...' : 'Approve'}
                      </Button>
                      
                      <Button
                        onClick={() => handleApproval(submission.id, false)}
                        disabled={processingId === submission.id}
                        variant="destructive"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {processingId === submission.id ? 'Processing...' : 'Reject'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
