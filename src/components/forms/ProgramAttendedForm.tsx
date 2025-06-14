
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from './FileUpload';
import { programAttendedSchema, type ProgramAttendedFormData } from '@/lib/validations';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface ProgramAttendedFormProps {
  onSubmit: (data: ProgramAttendedFormData & { documentUrl?: string }) => Promise<void>;
  initialData?: Partial<ProgramAttendedFormData>;
  isSubmitting?: boolean;
}

export const ProgramAttendedForm: React.FC<ProgramAttendedFormProps> = ({
  onSubmit,
  initialData,
  isSubmitting = false
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [documentUrl, setDocumentUrl] = useState<string | undefined>(initialData?.documentUrl);
  const [documentPath, setDocumentPath] = useState<string>('');

  const form = useForm<ProgramAttendedFormData>({
    resolver: zodResolver(programAttendedSchema),
    defaultValues: {
      title: '',
      type: 'Workshop',
      mode: 'Online',
      organizingInstitution: '',
      venue: '',
      startDate: '',
      endDate: '',
      duration: 1,
      durationType: 'days',
      domain: 'Own',
      domainOther: '',
      objective: '',
      keyLearnings: '',
      contribution: '',
      sponsored: false,
      sponsorName: '',
      ...initialData
    }
  });

  const watchedValues = form.watch();

  const handleStepSubmit = async (data: ProgramAttendedFormData) => {
    await onSubmit({ ...data, documentUrl });
  };

  const nextStep = async () => {
    const fieldsToValidate = currentStep === 1 
      ? ['title', 'type', 'mode', 'organizingInstitution', 'startDate', 'endDate', 'duration', 'durationType']
      : ['domain', 'objective', 'keyLearnings', 'contribution'];

    const isValid = await form.trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep(2);
    }
  };

  const prevStep = () => {
    setCurrentStep(1);
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
              <FormLabel>Program Type *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="FDP">FDP</SelectItem>
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
              <Input placeholder="Enter organizing institution" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {watchedValues.mode !== 'Online' && (
        <FormField
          control={form.control}
          name="venue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Venue</FormLabel>
              <FormControl>
                <Input placeholder="Enter venue" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
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
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
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

      {watchedValues.domain === 'Other' && (
        <FormField
          control={form.control}
          name="domainOther"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Specify Other Domain *</FormLabel>
              <FormControl>
                <Input placeholder="Enter domain details" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FormField
        control={form.control}
        name="objective"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Objective *</FormLabel>
            <FormControl>
              <Textarea 
                placeholder="Describe the objective of attending this program"
                className="min-h-[100px]"
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
                className="min-h-[100px]"
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
                placeholder="Describe how this program will contribute to your institution"
                className="min-h-[100px]"
                {...field} 
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

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

      {watchedValues.sponsored && (
        <FormField
          control={form.control}
          name="sponsorName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sponsor Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter sponsor name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <FileUpload
        label="Upload Certificate/Document"
        description="Upload your participation certificate or related document"
        onFileUploaded={(url, path) => {
          setDocumentUrl(url);
          setDocumentPath(path);
        }}
        onFileRemoved={() => {
          setDocumentUrl(undefined);
          setDocumentPath('');
        }}
        currentFile={documentUrl ? { url: documentUrl, path: documentPath } : undefined}
      />
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Programs/Workshops Attended - Step {currentStep} of 2</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleStepSubmit)} className="space-y-6">
            {currentStep === 1 ? renderStep1() : renderStep2()}
            
            <div className="flex justify-between">
              {currentStep === 2 && (
                <Button type="button" variant="outline" onClick={prevStep}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
              )}
              
              {currentStep === 1 ? (
                <Button type="button" onClick={nextStep} className="ml-auto">
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting} className="ml-auto">
                  {isSubmitting ? 'Submitting...' : 'Submit Program'}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
