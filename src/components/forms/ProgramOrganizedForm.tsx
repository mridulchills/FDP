import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from './FileUpload';
import { MultiFileUpload } from './MultiFileUpload';
import { useAuth } from '@/contexts/AuthContext';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const programOrganizedSchema = z.object({
  title: z.string().min(1, 'Program title is required'),
  type: z.enum(['FDP', 'Workshop', 'Conference', 'Seminar', 'Webinar', 'Training']),
  mode: z.enum(['Online', 'Offline', 'Hybrid']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  duration: z.number().min(1, 'Duration must be greater than 0'),
  durationType: z.enum(['hours', 'days']),
  targetAudience: z.array(z.enum(['Faculty', 'Students', 'Industry', 'Researchers'])).min(1, 'Select at least one target audience'),
  participants: z.number().min(1, 'Number of participants is required'),
  role: z.enum(['Convener', 'Coordinator', 'Resource Person']),
  collaboratingPartners: z.string().optional(),
  budgetApproval: z.boolean(),
  budgetAmount: z.number().optional(),
  fundingSource: z.string().optional(),
  outcomeSummary: z.string().min(1, 'Outcome summary is required'),
  participantFeedback: z.string().optional(),
  publicationLinks: z.string().optional(),
  documentUrl: z.string().optional(),
});

type ProgramOrganizedFormData = z.infer<typeof programOrganizedSchema>;

interface ProgramOrganizedFormProps {
  onSubmit: (data: ProgramOrganizedFormData) => void;
  isSubmitting: boolean;
}

export const ProgramOrganizedForm: React.FC<ProgramOrganizedFormProps> = ({
  onSubmit,
  isSubmitting
}) => {
  const { user } = useAuth();
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  const [uploadedFilePath, setUploadedFilePath] = useState<string>('');
  const [additionalFiles, setAdditionalFiles] = useState<Array<{ url: string; path: string; name: string }>>([]);
  
  const form = useForm<ProgramOrganizedFormData>({
    resolver: zodResolver(programOrganizedSchema),
    defaultValues: {
      targetAudience: [],
      budgetApproval: false,
    },
  });

  const handleSubmit = (data: ProgramOrganizedFormData) => {
    const finalData = {
      ...data,
      documentUrl: uploadedFileUrl,
      documentUrls: additionalFiles
    };
    onSubmit(finalData);
  };

  const toggleAudience = (audience: string) => {
    const currentAudience = form.getValues('targetAudience');
    const newAudience = currentAudience.includes(audience as any)
      ? currentAudience.filter(a => a !== audience)
      : [...currentAudience, audience as any];
    form.setValue('targetAudience', newAudience);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Organizer Details */}
        <Card>
          <CardHeader>
            <CardTitle>Organizer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Faculty Name</Label>
                <Input value={user?.name} disabled />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input value={user?.department} disabled />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input value={user?.designation} disabled />
              </div>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role in Program</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Convener">Convener</SelectItem>
                        <SelectItem value="Coordinator">Coordinator</SelectItem>
                        <SelectItem value="Resource Person">Resource Person</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Program Information */}
        <Card>
          <CardHeader>
            <CardTitle>Program Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter program title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select program type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="FDP">FDP</SelectItem>
                        <SelectItem value="Workshop">Workshop</SelectItem>
                        <SelectItem value="Conference">Conference</SelectItem>
                        <SelectItem value="Seminar">Seminar</SelectItem>
                        <SelectItem value="Webinar">Webinar</SelectItem>
                        <SelectItem value="Training">Training</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mode</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Online">Online</SelectItem>
                        <SelectItem value="Offline">Offline</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter duration"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="durationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="participants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Participants</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Number of participants"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Target Audience</Label>
              <div className="flex flex-wrap gap-2">
                {['Faculty', 'Students', 'Industry', 'Researchers'].map((audience) => (
                  <Badge
                    key={audience}
                    variant={form.watch('targetAudience').includes(audience as any) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleAudience(audience)}
                  >
                    {audience}
                    {form.watch('targetAudience').includes(audience as any) && (
                      <X size={14} className="ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="collaboratingPartners"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collaborating Partners (if any)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter collaborating partners" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Budget Information */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="budgetApproval"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Budget Approval Required</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {form.watch('budgetApproval') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="budgetAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Amount (₹)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="Enter budget amount"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fundingSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source of Funding</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Institutional, External, Sponsored" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outcome/Impact */}
        <Card>
          <CardHeader>
            <CardTitle>Outcome & Impact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="outcomeSummary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objectives Achieved / Outcome Summary</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the objectives achieved and overall outcome of the program"
                      rows={4}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="participantFeedback"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Participant Feedback Summary</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Summarize the feedback received from participants"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="publicationLinks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Publications/Media Coverage (Links)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter links to publications, media coverage, or social media posts"
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Document Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Supporting Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              onFileUpload={(url, path) => {
                setUploadedFileUrl(url);
                setUploadedFilePath(path);
                form.setValue('documentUrl', url);
              }}
              currentFileUrl={uploadedFileUrl}
              currentFilePath={uploadedFilePath}
              onFileRemoved={() => {
                setUploadedFileUrl('');
                setUploadedFilePath('');
                form.setValue('documentUrl', '');
              }}
              label="Upload Brochure/Flyer/Report"
              description="Upload PDF, DOC, DOCX, JPG, or PNG files (max 10MB)"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              submissionId="temp"
            />
          </CardContent>
        </Card>

        {/* Additional Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiFileUpload
              onFilesChange={setAdditionalFiles}
              currentFiles={additionalFiles}
              label="Additional Documents (Optional)"
              description="Upload additional supporting documents (Max 10MB each, up to 5 files)"
              submissionId="temp"
              maxFiles={5}
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? 'Submitting...' : 'Submit Program Details'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
