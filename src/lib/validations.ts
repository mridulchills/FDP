
import { z } from 'zod';

// Common validation schemas
export const baseSubmissionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  duration: z.number().min(1, 'Duration must be at least 1'),
  durationType: z.enum(['hours', 'days']),
});

// Programs Attended validation
export const programAttendedSchema = baseSubmissionSchema.extend({
  type: z.enum(['FDP', 'Workshop', 'Conference', 'Seminar', 'Webinar', 'MOOC']),
  mode: z.enum(['Online', 'Offline', 'Hybrid']),
  organizingInstitution: z.string().min(1, 'Organizing institution is required'),
  venue: z.string().optional(),
  domain: z.enum(['Own', 'Related', 'Other']),
  domainOther: z.string().optional(),
  objective: z.string().min(10, 'Objective must be at least 10 characters'),
  keyLearnings: z.string().min(10, 'Key learnings must be at least 10 characters'),
  contribution: z.string().min(10, 'Contribution must be at least 10 characters'),
  sponsored: z.boolean(),
  sponsorName: z.string().optional(),
  documentUrl: z.string().optional(),
}).refine((data) => {
  if (data.domain === 'Other' && !data.domainOther) {
    return false;
  }
  if (data.sponsored && !data.sponsorName) {
    return false;
  }
  return true;
});

// Programs Organized validation
export const programOrganizedSchema = baseSubmissionSchema.extend({
  type: z.enum(['FDP', 'Workshop', 'Conference', 'Seminar', 'Webinar', 'Training']),
  mode: z.enum(['Online', 'Offline', 'Hybrid']),
  targetAudience: z.array(z.enum(['Faculty', 'Students', 'Industry', 'Researchers'])).min(1, 'Select at least one target audience'),
  participants: z.number().min(1, 'Number of participants must be at least 1'),
  role: z.enum(['Convener', 'Coordinator', 'Resource Person']),
  collaboratingPartners: z.string().optional(),
  budgetApproval: z.boolean(),
  budgetAmount: z.number().optional(),
  fundingSource: z.string().optional(),
  outcomeSummary: z.string().min(10, 'Outcome summary must be at least 10 characters'),
  participantFeedback: z.string().optional(),
  publicationLinks: z.string().optional(),
  documentUrl: z.string().optional(),
}).refine((data) => {
  if (data.budgetApproval && !data.budgetAmount) {
    return false;
  }
  if (data.budgetApproval && !data.fundingSource) {
    return false;
  }
  return true;
});

// Certifications validation
export const certificationSchema = z.object({
  courseName: z.string().min(1, 'Course name is required'),
  platform: z.enum(['Coursera', 'NPTEL', 'edX', 'Swayam', 'ATAL', 'Other']),
  platformOther: z.string().optional(),
  domain: z.string().min(1, 'Domain is required'),
  duration: z.number().min(1, 'Duration must be at least 1'),
  durationType: z.enum(['hours', 'weeks']),
  mode: z.enum(['Online', 'Blended']),
  status: z.enum(['Completed', 'In Progress']),
  relevance: z.string().min(10, 'Relevance must be at least 10 characters'),
  extractedName: z.string().optional(),
  extractedCourse: z.string().optional(),
  extractedDate: z.string().optional(),
  documentUrl: z.string().optional(),
}).refine((data) => {
  if (data.platform === 'Other' && !data.platformOther) {
    return false;
  }
  return true;
});

export type ProgramAttendedFormData = z.infer<typeof programAttendedSchema>;
export type ProgramOrganizedFormData = z.infer<typeof programOrganizedSchema>;
export type CertificationFormData = z.infer<typeof certificationSchema>;
