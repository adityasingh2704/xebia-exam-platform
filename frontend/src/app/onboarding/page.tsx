'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tenantApi } from '@/lib/api';

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Form states
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6C1D5F');
  const [secondaryColor, setSecondaryColor] = useState('#FF6200');
  const [timezone, setTimezone] = useState('America/New_York');
  const [locale, setLocale] = useState('en-US');
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [enableEmail, setEnableEmail] = useState(true);
  const [enableInApp, setEnableInApp] = useState(true);
  const [enableProctoring, setEnableProctoring] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Simulating tenant creation & settings configuration
      await new Promise((resolve) => setTimeout(resolve, 1500));
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-page">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-border bg-surface-card">
        <div className="flex items-center gap-3">
          <img src="/Logo-Purple.png" alt="Xe-Recruits Logo" className="h-8 w-auto" />
          <span className="text-primary font-bold text-base">Xe-Recruits Onboarding</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-body-sm text-text-muted">Step {step} of 4</span>
          <div className="w-24 h-2 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-cta transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="card w-full max-w-2xl min-h-[460px] flex flex-col justify-between">
          <div className="space-y-6">
            {/* Step Content */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-headline-lg font-bold text-text-primary">1. Organisation Details</h2>
                  <p className="text-body-sm text-text-muted">Tell us about your organization or university</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Organisation Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="ACME University"
                      value={orgName}
                      onChange={(e) => {
                        setOrgName(e.target.value);
                        setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                      }}
                    />
                  </div>
                  <div>
                    <label className="input-label">Organisation Slug</label>
                    <input
                      type="text"
                      className="input bg-surface-page"
                      placeholder="acme-university"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(e.target.value)}
                      disabled
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-headline-lg font-bold text-text-primary">2. Customize Branding</h2>
                  <p className="text-body-sm text-text-muted">Upload your logo and choose brand colors</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="input-label">Logo Image URL</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="https://example.com/logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">Primary Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="w-10 h-10 border border-border rounded cursor-pointer"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                        />
                        <input
                          type="text"
                          className="input"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="input-label">Secondary Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="w-10 h-10 border border-border rounded cursor-pointer"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                        />
                        <input
                          type="text"
                          className="input"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-headline-lg font-bold text-text-primary">3. Regional Settings</h2>
                  <p className="text-body-sm text-text-muted">Define time zones, locale, and formats</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Default Timezone</label>
                    <select
                      className="input"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    >
                      <option value="America/New_York">America/New_York (UTC-5)</option>
                      <option value="Europe/London">Europe/London (UTC+0)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (UTC+5:30)</option>
                      <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Primary Language / Locale</label>
                    <select
                      className="input"
                      value={locale}
                      onChange={(e) => setLocale(e.target.value)}
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="fr-FR">French</option>
                      <option value="de-DE">German</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Preferred Date Format</label>
                    <select
                      className="input"
                      value={dateFormat}
                      onChange={(e) => setDateFormat(e.target.value)}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <h2 className="text-headline-lg font-bold text-text-primary">4. Notifications & Features</h2>
                  <p className="text-body-sm text-text-muted">Configure portal communication and rules</p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Email Notifications</p>
                      <p className="text-caption-xs text-text-muted">Send automated alerts and summaries via email</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableEmail}
                      onChange={(e) => setEnableEmail(e.target.checked)}
                      className="w-4 h-4 text-cta border-border focus:ring-cta"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">In-App Notifications</p>
                      <p className="text-caption-xs text-text-muted">Display real-time notifications in the portal</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableInApp}
                      onChange={(e) => setEnableInApp(e.target.checked)}
                      className="w-4 h-4 text-cta border-border focus:ring-cta"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border border-border rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">AI Proctoring Service</p>
                      <p className="text-caption-xs text-text-muted">Enable real-time webcam and audio validation for examinations</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableProctoring}
                      onChange={(e) => setEnableProctoring(e.target.checked)}
                      className="w-4 h-4 text-cta border-border focus:ring-cta"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-6 border-t border-border mt-8">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>
            {step === 4 ? (
              <button
                onClick={handleComplete}
                disabled={isLoading || !orgName}
                className="btn-cta"
              >
                {isLoading ? 'Completing Setup...' : 'Complete & Launch'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={step === 1 && !orgName}
                className="btn-cta"
              >
                Next Step
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
