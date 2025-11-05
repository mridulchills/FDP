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
import { FileUpload } from './FileUpload';
import { MultiFileUpload } from './MultiFileUpload';
import { useAuth } from '@/contexts/AuthContext';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const certificationSchema = z.object({
  courseName: z.string().min(1, 'Course name is required'),
  platform: z.enum(['Coursera', 'NPTEL', 'edX', 'Swayam', 'ATAL', 'Other']),
  platformOther: z.string().optional(),
  domain: z.string().min(1, 'Domain is required'),
  duration: z.number().min(1, 'Duration must be greater than 0'),
  durationType: z.enum(['hours', 'weeks']),
  mode: z.enum(['Online', 'Blended']),
  status: z.enum(['Completed', 'In Progress']),
  relevance: z.string().min(1, 'Relevance to teaching/research is required'),
  implementation: z.string().min(1, 'Implementation details are required'),
  documentUrl: z.string().optional(),
});

type CertificationFormData = z.infer<typeof certificationSchema>;

interface CertificationFormProps {
  onSubmit: (data: CertificationFormData) => void;
  isSubmitting: boolean;
}

export const CertificationForm: React.FC<CertificationFormProps> = ({
  onSubmit,
  isSubmitting
}) => {
  const { user } = useAuth();
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>('');
  const [uploadedFilePath, setUploadedFilePath] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{url: string; path: string; name: string}>>([]);
  
  const form = useForm<CertificationFormData>({
    resolver: zodResolver(certificationSchema),
    defaultValues: {
      mode: 'Online',
      status: 'Completed',
    },
  });

  const handleSubmit = (data: CertificationFormData) => {
    const finalData = {
      ...data,
      documentUrl: uploadedFileUrl || (uploadedFiles.length > 0 ? uploadedFiles[0].url : ''),
      documentUrls: uploadedFiles
    };
    onSubmit(finalData);
  };

  const watchPlatform = form.watch('platform');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Faculty Details */}
        <Card>
          <CardHeader>
            <CardTitle>Faculty Details</CardTitle>
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
              <div className="space-y-2">
                <Label>Institution</Label>
                <Input value={user?.institution} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Course Details */}
        <Card>
          <CardHeader>
            <CardTitle>Course Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="courseName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name of the Course</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter course name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Computer Science, AI/ML, Data Science" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NPTEL">NPTEL</SelectItem>
                        <SelectItem value="Coursera">Coursera</SelectItem>
                        <SelectItem value="edX">edX</SelectItem>
                        <SelectItem value="Swayam">Swayam</SelectItem>
                        <SelectItem value="ATAL">ATAL</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchPlatform === 'Other' && (
                <FormField
                  control={form.control}
                  name="platformOther"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specify Platform</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter platform name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
                        <SelectItem value="weeks">Weeks</SelectItem>
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
                        <SelectItem value="Blended">Blended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Certification Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Relevance & Implementation */}
        <Card>
          <CardHeader>
            <CardTitle>Relevance & Implementation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="relevance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relevance to Teaching/Research</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Explain how this certification is relevant to your teaching or research work"
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
              name="implementation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Implementation in Teaching/Research</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Specify where and how you have implemented the gained skills in your teaching or research"
                      rows={4}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Certificate Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Certificate Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
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
                label="Primary Certificate"
                description="Upload your main certificate (max 10MB)"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                submissionId="temp"
              />
            </div>
            <div>
              <MultiFileUpload
                onFilesChange={setUploadedFiles}
                currentFiles={uploadedFiles}
                label="Additional Certificates (Optional)"
                description="Upload up to 5 additional certificates or documents (max 10MB each)"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                submissionId="temp"
                maxFiles={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting ? 'Submitting...' : 'Submit Certification Details'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
