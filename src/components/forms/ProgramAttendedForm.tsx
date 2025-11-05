import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { programAttendedSchema, type ProgramAttendedFormData } from '@/lib/validations';
import { FileUpload } from '@/components/forms/FileUpload';
import { MultiFileUpload } from '@/components/forms/MultiFileUpload';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';

interface ProgramAttendedFormProps {
  onSubmit: (data: ProgramAttendedFormData) => Promise<void>;
  initialData?: Partial<ProgramAttendedFormData>;
  isSubmitting?: boolean;
  submitButtonText?: string;
}

export const ProgramAttendedForm: React.FC<ProgramAttendedFormProps> = ({
  onSubmit,
  initialData,
  isSubmitting = false,
  submitButtonText = 'Submit for Approval'
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>(initialData?.documentUrl || '');
  const [uploadedFilePath, setUploadedFilePath] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{url: string; path: string; name: string}>>(
    (initialData?.documentUrls || []).filter((f): f is {url: string; path: string; name: string} => 
      Boolean(f.url && f.path && f.name)
    )
  );

  const form = useForm<ProgramAttendedFormData>({
    resolver: zodResolver(programAttendedSchema),
    defaultValues: {
      title: initialData?.title || '',
      type: initialData?.type || 'FDP',
      mode: initialData?.mode || 'Online',
      organizingInstitution: initialData?.organizingInstitution || '',
      venue: initialData?.venue || '',
      startDate: initialData?.startDate || '',
      endDate: initialData?.endDate || '',
      duration: initialData?.duration || 1,
      durationType: initialData?.durationType || 'days',
      domain: initialData?.domain || 'Own',
      domainOther: initialData?.domainOther || '',
      objective: initialData?.objective || '',
      keyLearnings: initialData?.keyLearnings || '',
      contribution: initialData?.contribution || '',
      sponsored: initialData?.sponsored || false,
      sponsorName: initialData?.sponsorName || '',
      documentUrl: initialData?.documentUrl || '',
    }
  });

  const handleFormSubmit = async (data: ProgramAttendedFormData) => {
    const finalData = {
      ...data,
      documentUrl: uploadedFileUrl || (uploadedFiles.length > 0 ? uploadedFiles[0].url : ''),
      documentUrls: uploadedFiles
    };
    await onSubmit(finalData);
  };

  const getStepFields = (step: number) => {
    switch (step) {
      case 1:
        return ['title', 'type', 'mode', 'organizingInstitution', 'venue'];
      case 2:
        return ['startDate', 'endDate', 'duration', 'durationType', 'domain', 'domainOther'];
      case 3:
        return ['objective', 'keyLearnings', 'contribution', 'sponsored', 'sponsorName'];
      default:
        return [];
    }
  };

  const nextStep = async () => {
    const fieldsToValidate = getStepFields(currentStep);
    const isValid = await form.trigger(fieldsToValidate as any);
    
    if (isValid && currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Program Title *</FormLabel>
            <FormControl>
              <Input placeholder="Enter the full title of the program" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Program Type *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="FDP">Faculty Development Program (FDP)</SelectItem>
                  <SelectItem value="Workshop">Workshop</SelectItem>
                  <SelectItem value="Conference">Conference</SelectItem>
                  <SelectItem value="Seminar">Seminar</SelectItem>
                  <SelectItem value="Webinar">Webinar</SelectItem>
                  <SelectItem value="MOOC">MOOC</SelectItem>
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
              <FormLabel>Mode *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
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

      <FormField
        control={form.control}
        name="organizingInstitution"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Organizing Institution *</FormLabel>
            <FormControl>
              <Input placeholder="Enter the name of the organizing institution" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="venue"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Venue</FormLabel>
            <FormControl>
              <Input placeholder="Enter venue (if applicable)" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date *</FormLabel>
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
              <FormLabel>End Date *</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Duration *</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min="1" 
                  {...field} 
                  onChange={(e) => field.onChange(Number(e.target.value))}
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
              <FormLabel>Duration Type *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
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
      </div>

      <FormField
        control={form.control}
        name="domain"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Domain *</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Own">Own Domain</SelectItem>
                <SelectItem value="Related">Related Domain</SelectItem>
                <SelectItem value="Other">Other Domain</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {form.watch('domain') === 'Other' && (
        <FormField
          control={form.control}
          name="domainOther"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Specify Other Domain *</FormLabel>
              <FormControl>
                <Input placeholder="Please specify the domain" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="objective"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Objective *</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Describe the objective of attending this program"
                className="min-h-24"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="keyLearnings"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Key Learnings *</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Describe the key learnings from this program"
                className="min-h-24"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contribution"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Contribution to Institution *</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Describe how this program will contribute to your role and the institution"
                className="min-h-24"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="sponsored"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>
                  Was this program sponsored?
                </FormLabel>
              </div>
            </FormItem>
          )}
        />

        {form.watch('sponsored') && (
          <FormField
            control={form.control}
            name="sponsorName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sponsor Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter the name of the sponsor" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="space-y-4">
        <FormLabel>Supporting Documents (Primary)</FormLabel>
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
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          submissionId="temp"
        />
        <p className="text-sm text-gray-500">
          Upload primary certificate, brochure, or supporting document (Max 10MB)
        </p>
      </div>

      <div className="space-y-4">
        <FormLabel>Additional Supporting Documents (Optional)</FormLabel>
        <MultiFileUpload
          onFilesChange={(files) => {
            setUploadedFiles(files);
          }}
          currentFiles={uploadedFiles}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          submissionId="temp"
          maxFiles={5}
        />
        <p className="text-sm text-gray-500">
          Upload up to 5 additional supporting documents (Max 10MB each)
        </p>
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Programs/Workshops Attended</span>
          <div className="flex space-x-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : step < currentStep
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step}
              </div>
            ))}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            <div className="flex justify-between pt-6">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
              )}

              <div className="ml-auto">
                {currentStep < 3 ? (
                  <Button type="button" onClick={nextStep}>
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        {submitButtonText}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
