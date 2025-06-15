
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgramAttendedForm } from '@/components/forms/ProgramAttendedForm';
import { ProgramOrganizedForm } from '@/components/forms/ProgramOrganizedForm';
import { CertificationForm } from '@/components/forms/CertificationForm';
import { submissionService } from '@/services/submissionService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, FileText, Users, Award } from 'lucide-react';
import type { ModuleType } from '@/types';

type FormStep = 'selection' | 'form';

const modules = [
  {
    type: 'attended' as ModuleType,
    title: 'Programs/Workshops Attended',
    description: 'Submit details of FDPs, workshops, conferences, seminars, webinars, or MOOCs you have attended',
    icon: FileText,
    color: 'bg-blue-500',
  },
  {
    type: 'organized' as ModuleType,
    title: 'Programs/Workshops Organized',
    description: 'Submit details of programs you have organized or coordinated',
    icon: Users,
    color: 'bg-green-500',
  },
  {
    type: 'certification' as ModuleType,
    title: 'Professional Certifications',
    description: 'Submit your professional certifications and online course completions',
    icon: Award,
    color: 'bg-purple-500',
  },
];

export const NewSubmission: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<FormStep>('selection');
  const [selectedModule, setSelectedModule] = useState<ModuleType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleModuleSelect = (moduleType: ModuleType) => {
    setSelectedModule(moduleType);
    setCurrentStep('form');
  };

  const handleBackToSelection = () => {
    setCurrentStep('selection');
    setSelectedModule(null);
  };

  const handleFormSubmit = async (formData: any) => {
    if (!selectedModule) return;

    setIsSubmitting(true);
    
    try {
      const { data, error } = await submissionService.createSubmission({
        moduleType: selectedModule,
        formData,
        documentUrl: formData.documentUrl
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Submission Created",
        description: "Your submission has been created successfully and sent for HoD approval.",
      });

      navigate('/submissions');
    } catch (error: any) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to create submission. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderModuleSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">New Submission</h1>
        <p className="text-muted-foreground mt-2">
          Select the type of professional development activity you want to submit
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3 max-w-6xl mx-auto">
        {modules.map((module) => {
          const IconComponent = module.icon;
          return (
            <Card 
              key={module.type}
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-105"
              onClick={() => handleModuleSelect(module.type)}
            >
              <CardHeader className="text-center">
                <div className={`w-12 h-12 ${module.color} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                  <IconComponent className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">{module.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center">
                  {module.description}
                </p>
                <div className="flex justify-center mt-4">
                  <Badge variant="secondary">Click to Select</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );

  const renderForm = () => {
    if (!selectedModule) return null;

    const selectedModuleData = modules.find(m => m.type === selectedModule);

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={handleBackToSelection}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Selection
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedModuleData?.title}</h1>
            <p className="text-muted-foreground">{selectedModuleData?.description}</p>
          </div>
        </div>

        {selectedModule === 'attended' && (
          <ProgramAttendedForm 
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        {selectedModule === 'organized' && (
          <ProgramOrganizedForm 
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
          />
        )}

        {selectedModule === 'certification' && (
          <CertificationForm 
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6">
      {currentStep === 'selection' ? renderModuleSelection() : renderForm()}
    </div>
  );
};
