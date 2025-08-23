import { EventEmitter } from 'events';
import { logger } from './logger.js';

export interface ProgressStep {
  id: string;
  name: string;
  description?: string | undefined;
  weight: number; // Relative weight for progress calculation
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: Date | undefined;
  endTime?: Date | undefined;
  error?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface ProgressState {
  totalSteps: number;
  completedSteps: number;
  currentStep?: ProgressStep | undefined;
  overallProgress: number; // 0-100
  startTime: Date;
  estimatedEndTime?: Date | undefined;
  elapsedTime: number; // milliseconds
  errors: string[];
  warnings: string[];
}

export interface ProgressUpdate {
  step: ProgressStep;
  state: ProgressState;
  message?: string;
}

export class ProgressTracker extends EventEmitter {
  private steps: Map<string, ProgressStep> = new Map();
  private stepOrder: string[] = [];
  private startTime: Date;
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor() {
    super();
    this.startTime = new Date();
  }

  addStep(id: string, name: string, description?: string, weight: number = 1): void {
    const step: ProgressStep = {
      id,
      name,
      description,
      weight,
      status: 'pending'
    };

    this.steps.set(id, step);
    this.stepOrder.push(id);

    logger.debug(`Added progress step: ${id} - ${name}`);
  }

  addSteps(steps: Array<{ id: string; name: string; description?: string; weight?: number }>): void {
    steps.forEach(step => {
      this.addStep(step.id, step.name, step.description, step.weight || 1);
    });
  }

  startStep(id: string, metadata?: Record<string, any>): void {
    const step = this.steps.get(id);
    if (!step) {
      throw new Error(`Step not found: ${id}`);
    }

    step.status = 'in_progress';
    step.startTime = new Date();
    if (metadata) {
      step.metadata = metadata;
    }

    const state = this.getState();
    const update: ProgressUpdate = {
      step,
      state,
      message: `Started: ${step.name}`
    };

    logger.info(`Progress: Started step ${id} - ${step.name}`);
    this.emit('progress', update);
    this.emit('step_started', step);
  }

  completeStep(id: string, metadata?: Record<string, any>): void {
    const step = this.steps.get(id);
    if (!step) {
      throw new Error(`Step not found: ${id}`);
    }

    step.status = 'completed';
    step.endTime = new Date();
    if (metadata) {
      step.metadata = { ...step.metadata, ...metadata };
    }

    const state = this.getState();
    const update: ProgressUpdate = {
      step,
      state,
      message: `Completed: ${step.name}`
    };

    logger.info(`Progress: Completed step ${id} - ${step.name}`);
    this.emit('progress', update);
    this.emit('step_completed', step);
  }

  failStep(id: string, error: string, metadata?: Record<string, any>): void {
    const step = this.steps.get(id);
    if (!step) {
      throw new Error(`Step not found: ${id}`);
    }

    step.status = 'failed';
    step.endTime = new Date();
    step.error = error;
    if (metadata) {
      step.metadata = { ...step.metadata, ...metadata };
    }

    this.errors.push(`${step.name}: ${error}`);

    const state = this.getState();
    const update: ProgressUpdate = {
      step,
      state,
      message: `Failed: ${step.name} - ${error}`
    };

    logger.error(`Progress: Failed step ${id} - ${step.name}: ${error}`);
    this.emit('progress', update);
    this.emit('step_failed', step);
  }

  skipStep(id: string, reason: string, metadata?: Record<string, any>): void {
    const step = this.steps.get(id);
    if (!step) {
      throw new Error(`Step not found: ${id}`);
    }

    step.status = 'skipped';
    step.endTime = new Date();
    step.error = reason;
    if (metadata) {
      step.metadata = { ...step.metadata, ...metadata };
    }

    this.warnings.push(`${step.name}: ${reason}`);

    const state = this.getState();
    const update: ProgressUpdate = {
      step,
      state,
      message: `Skipped: ${step.name} - ${reason}`
    };

    logger.warn(`Progress: Skipped step ${id} - ${step.name}: ${reason}`);
    this.emit('progress', update);
    this.emit('step_skipped', step);
  }

  addError(error: string): void {
    this.errors.push(error);
    logger.error(`Progress error: ${error}`);
    this.emit('error', error);
  }

  addWarning(warning: string): void {
    this.warnings.push(warning);
    logger.warn(`Progress warning: ${warning}`);
    this.emit('warning', warning);
  }

  getState(): ProgressState {
    const totalWeight = Array.from(this.steps.values()).reduce((sum, step) => sum + step.weight, 0);
    const completedWeight = Array.from(this.steps.values())
      .filter(step => step.status === 'completed')
      .reduce((sum, step) => sum + step.weight, 0);

    const completedSteps = Array.from(this.steps.values()).filter(step => step.status === 'completed').length;
    const currentStep = Array.from(this.steps.values()).find(step => step.status === 'in_progress');

    const overallProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    const elapsedTime = Date.now() - this.startTime.getTime();

    // Estimate end time based on current progress
    let estimatedEndTime: Date | undefined;
    if (overallProgress > 0 && overallProgress < 100) {
      const estimatedTotalTime = (elapsedTime / overallProgress) * 100;
      estimatedEndTime = new Date(this.startTime.getTime() + estimatedTotalTime);
    }

    return {
      totalSteps: this.steps.size,
      completedSteps,
      currentStep,
      overallProgress,
      startTime: this.startTime,
      estimatedEndTime,
      elapsedTime,
      errors: [...this.errors],
      warnings: [...this.warnings]
    };
  }

  getStep(id: string): ProgressStep | undefined {
    return this.steps.get(id);
  }

  getAllSteps(): ProgressStep[] {
    return this.stepOrder.map(id => this.steps.get(id)!);
  }

  isComplete(): boolean {
    return Array.from(this.steps.values()).every(step =>
      step.status === 'completed' || step.status === 'skipped'
    );
  }

  hasErrors(): boolean {
    return this.errors.length > 0 || Array.from(this.steps.values()).some(step => step.status === 'failed');
  }

  reset(): void {
    this.steps.clear();
    this.stepOrder = [];
    this.startTime = new Date();
    this.errors = [];
    this.warnings = [];

    logger.info('Progress tracker reset');
    this.emit('reset');
  }

  generateReport(): string {
    const state = this.getState();
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('PROGRESS REPORT');
    lines.push('='.repeat(60));
    lines.push('');

    // Summary
    lines.push('SUMMARY:');
    lines.push(`  Overall Progress: ${state.overallProgress}%`);
    lines.push(`  Completed Steps: ${state.completedSteps}/${state.totalSteps}`);
    lines.push(`  Start Time: ${state.startTime.toISOString()}`);
    lines.push(`  Elapsed Time: ${this.formatDuration(state.elapsedTime)}`);

    if (state.estimatedEndTime) {
      lines.push(`  Estimated End Time: ${state.estimatedEndTime.toISOString()}`);
    }

    lines.push(`  Errors: ${state.errors.length}`);
    lines.push(`  Warnings: ${state.warnings.length}`);
    lines.push('');

    // Steps
    lines.push('STEPS:');
    this.getAllSteps().forEach((step, index) => {
      const status = this.getStatusIcon(step.status);
      const duration = step.startTime && step.endTime
        ? ` (${this.formatDuration(step.endTime.getTime() - step.startTime.getTime())})`
        : '';

      lines.push(`  ${index + 1}. ${status} ${step.name}${duration}`);

      if (step.description) {
        lines.push(`     ${step.description}`);
      }

      if (step.error) {
        lines.push(`     Error: ${step.error}`);
      }

      if (step.metadata && Object.keys(step.metadata).length > 0) {
        lines.push(`     Metadata: ${JSON.stringify(step.metadata)}`);
      }
    });
    lines.push('');

    // Errors
    if (state.errors.length > 0) {
      lines.push('ERRORS:');
      state.errors.forEach((error, index) => {
        lines.push(`  ${index + 1}. ${error}`);
      });
      lines.push('');
    }

    // Warnings
    if (state.warnings.length > 0) {
      lines.push('WARNINGS:');
      state.warnings.forEach((warning, index) => {
        lines.push(`  ${index + 1}. ${warning}`);
      });
      lines.push('');
    }

    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  private getStatusIcon(status: ProgressStep['status']): string {
    switch (status) {
      case 'pending': return '⏳';
      case 'in_progress': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      default: return '❓';
    }
  }

  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Convenience method for console progress display
  displayProgress(): void {
    const state = this.getState();
    const progressBar = this.createProgressBar(state.overallProgress);

    console.clear();
    console.log('='.repeat(60));
    console.log('MIGRATION PROGRESS');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Progress: ${progressBar} ${state.overallProgress}%`);
    console.log(`Steps: ${state.completedSteps}/${state.totalSteps} completed`);
    console.log(`Elapsed: ${this.formatDuration(state.elapsedTime)}`);

    if (state.currentStep) {
      console.log(`Current: ${state.currentStep.name}`);
    }

    if (state.estimatedEndTime) {
      console.log(`ETA: ${state.estimatedEndTime.toLocaleTimeString()}`);
    }

    if (state.errors.length > 0) {
      console.log(`Errors: ${state.errors.length}`);
    }

    if (state.warnings.length > 0) {
      console.log(`Warnings: ${state.warnings.length}`);
    }

    console.log('');
  }

  private createProgressBar(progress: number, width: number = 30): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }
}