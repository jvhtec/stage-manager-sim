import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { BrandingPreset, getBrandingPresets } from '@/lib/gameData';
import type { Company } from '@/types/game';

export type CompanyIdentityFormState = Pick<
  Company,
  'name' | 'brandColor' | 'accentColor' | 'specialization'
> & { tagline?: string };

interface CompanyOnboardingDialogProps {
  open: boolean;
  initialValues: CompanyIdentityFormState;
  onComplete: (values: CompanyIdentityFormState) => void;
  disableClose?: boolean;
}

const specializationDetails: Record<Company['specialization'], { title: string; description: string; perk: string }> = {
  audio: {
    title: 'Audio Specialists',
    description: 'Your engineers obsess over detail-oriented FOH mixes and pristine wireless systems.',
    perk: '+1 starting audio skill and modest discounts on audio rentals.',
  },
  lighting: {
    title: 'Lighting Designers',
    description: 'Precision lighting rigs with carefully rehearsed looks keep directors calling back.',
    perk: 'Begin with higher-condition lighting gear and slower wear decay.',
  },
  video: {
    title: 'Video Innovators',
    description: 'Show-stopping visuals, HDR IMAG, and a crew trained to troubleshoot under pressure.',
    perk: 'Unlock advanced crisis mitigation for video systems from day one.',
  },
  stage: {
    title: 'Stagecraft Veterans',
    description: 'Fast, safe builds that keep productions on schedule even when plans shift.',
    perk: 'Stage crews accumulate fatigue more slowly after long builds.',
  },
  balanced: {
    title: 'Balanced Studio',
    description: 'A well-rounded roster focused on reliability, communication, and steady growth.',
    perk: '+5 starting reputation and a small launch day cash bonus.',
  },
};

const onboardingSteps = [
  { key: 'identity', label: 'Identity' },
  { key: 'palette', label: 'Palette' },
  { key: 'specialization', label: 'Specialization' },
] as const;

const specializationOrder: Company['specialization'][] = ['audio', 'lighting', 'video', 'stage', 'balanced'];

export function CompanyOnboardingDialog({ open, initialValues, onComplete, disableClose }: CompanyOnboardingDialogProps) {
  const presets = useMemo<BrandingPreset[]>(() => getBrandingPresets(), []);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<CompanyIdentityFormState>(initialValues);
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (disableClose) return;
    if (!nextOpen) {
      setStepIndex(0);
    }
  };

  useEffect(() => {
    if (open) {
      setForm({
        name: initialValues.name,
        brandColor: initialValues.brandColor,
        accentColor: initialValues.accentColor,
        specialization: initialValues.specialization,
        tagline: initialValues.tagline ?? '',
      });
      setStepIndex(0);
    }
  }, [
    open,
    initialValues.name,
    initialValues.brandColor,
    initialValues.accentColor,
    initialValues.specialization,
    initialValues.tagline,
  ]);

  const identityValid = form.name.trim().length >= 2;
  const nextDisabled = stepIndex === 0 ? !identityValid : false;

  const handleComplete = () => {
    if (!identityValid) return;
    onComplete({
      ...form,
      name: form.name.trim(),
      tagline: form.tagline?.trim() ? form.tagline.trim() : undefined,
    });
  };

  const previewBackground = {
    background: `linear-gradient(135deg, ${form.brandColor}, ${form.accentColor})`,
  };

  const renderStepContent = () => {
    switch (stepIndex) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={form.name}
                onChange={event =>
                  setForm(prev => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Your production house"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                This name appears on dashboards, contracts, and post-show reports.
              </p>
            </div>
            <div>
              <Label htmlFor="company-tagline">Tagline (optional)</Label>
              <Input
                id="company-tagline"
                value={form.tagline ?? ''}
                onChange={event =>
                  setForm(prev => ({
                    ...prev,
                    tagline: event.target.value,
                  }))
                }
                placeholder="Raising the show, every show."
              />
              <p className="mt-1 text-sm text-muted-foreground">
                A short phrase that sells your vibe to clients and crew.
              </p>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">Choose a palette</Label>
              <div className="flex flex-wrap gap-3">
                {presets.map(preset => {
                  const isSelected =
                    form.brandColor.toLowerCase() === preset.brandColor.toLowerCase() &&
                    form.accentColor.toLowerCase() === preset.accentColor.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setForm(prev => ({
                          ...prev,
                          brandColor: preset.brandColor,
                          accentColor: preset.accentColor,
                          specialization: preset.specialization,
                          tagline:
                            prev.tagline && prev.tagline.trim().length > 0
                              ? prev.tagline
                              : preset.tagline,
                        }))
                      }
                      className={cn(
                        'flex min-w-[160px] flex-col rounded-lg border p-3 text-left shadow-sm transition',
                        isSelected
                          ? 'border-primary ring-2 ring-primary/40'
                          : 'border-border hover:border-primary/60'
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${preset.brandColor}, ${preset.accentColor})`,
                        color: 'white',
                      }}
                    >
                      <span className="text-sm font-semibold">{preset.label}</span>
                      <span className="text-xs text-white/80">{preset.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="brand-color">Primary color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="brand-color"
                    type="color"
                    value={form.brandColor}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        brandColor: event.target.value,
                      }))
                    }
                    className="h-12 w-16 cursor-pointer overflow-hidden p-1"
                  />
                  <Input
                    value={form.brandColor}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        brandColor: event.target.value,
                      }))
                    }
                    className="flex-1 font-mono"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="accent-color">Accent color</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="accent-color"
                    type="color"
                    value={form.accentColor}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        accentColor: event.target.value,
                      }))
                    }
                    className="h-12 w-16 cursor-pointer overflow-hidden p-1"
                  />
                  <Input
                    value={form.accentColor}
                    onChange={event =>
                      setForm(prev => ({
                        ...prev,
                        accentColor: event.target.value,
                      }))
                    }
                    className="flex-1 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <Label>Pick your launch specialization</Label>
            <RadioGroup
              value={form.specialization}
              onValueChange={value =>
                setForm(prev => ({
                  ...prev,
                  specialization: value as Company['specialization'],
                }))
              }
              className="grid gap-3"
            >
              {specializationOrder.map(value => (
                <div
                  key={value}
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    form.specialization === value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem id={`spec-${value}`} value={value} className="mt-1" />
                    <div>
                      <Label htmlFor={`spec-${value}`} className="text-base font-semibold">
                        {specializationDetails[value].title}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {specializationDetails[value].description}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {specializationDetails[value].perk}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Launch your studio</DialogTitle>
          <DialogDescription>
            Lock in your company identity before the first contracts roll in. You can revisit palette choices later in settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            {onboardingSteps.map((step, index) => (
              <span
                key={step.key}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  index === stepIndex
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {index + 1}. {step.label}
              </span>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              {renderStepContent()}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStepIndex(index => Math.max(0, index - 1))}
                  disabled={stepIndex === 0}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                {stepIndex < onboardingSteps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() => setStepIndex(index => Math.min(onboardingSteps.length - 1, index + 1))}
                    disabled={nextDisabled}
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={handleComplete} disabled={!identityValid}>
                    <Check className="mr-2 h-4 w-4" />
                    Launch Studio
                  </Button>
                )}
              </div>
            </div>
            <aside className="space-y-4">
              <div className="overflow-hidden rounded-xl border shadow-sm">
                <div className="p-6 text-white" style={previewBackground}>
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/80">
                    <Sparkles className="h-4 w-4" />
                    Studio Preview
                  </div>
                  <h2 className="mt-3 text-2xl font-bold">{form.name || 'Your Studio'}</h2>
                  <p className="text-white/90">{form.tagline && form.tagline.length > 0 ? form.tagline : 'Define your promise to clients.'}</p>
                  <Badge className="mt-4 bg-white/20 text-white backdrop-blur">
                    {specializationDetails[form.specialization].title}
                  </Badge>
                </div>
                <div className="space-y-2 bg-card p-5 text-sm">
                  <p className="text-muted-foreground">
                    {specializationDetails[form.specialization].description}
                  </p>
                  <p className="font-medium text-foreground">
                    {specializationDetails[form.specialization].perk}
                  </p>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Tip: palettes ensure WCAG contrast for headers and buttons. You can tweak copy later, but specialization locks in launch bonuses.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
