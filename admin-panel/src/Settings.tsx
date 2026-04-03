import { useState } from 'react';

export const SETTINGS_KEY = 'carddex_ai_settings';

export type AISettings = {
  provider: 'gemini' | 'vertex';
  geminiApiKey: string;
  vertexProjectId: string;
  vertexApiKey: string;
  vertexLocation: string;
};

export const defaultSettings: AISettings = {
  provider: 'gemini',
  geminiApiKey: '',
  vertexProjectId: '',
  vertexApiKey: '',
  vertexLocation: 'us-central1',
};

export function loadSettings(): AISettings {
  const envGeminiKey = process.env.REACT_APP_GEMINI_API_KEY ?? '';
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // If no API key was manually saved, fall back to the env var
      return {
        ...defaultSettings,
        ...saved,
        geminiApiKey: saved.geminiApiKey || envGeminiKey,
      };
    }
  } catch {}
  return { ...defaultSettings, geminiApiKey: envGeminiKey };
}

export function saveSettings(s: AISettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function isAIConfigured(s: AISettings): boolean {
  if (s.provider === 'gemini') return s.geminiApiKey.trim().length > 0;
  return s.vertexProjectId.trim().length > 0 && s.vertexApiKey.trim().length > 0;
}

type Props = { onSaved: () => void };

export default function Settings({ onSaved }: Props) {
  const [settings, setSettings] = useState<AISettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (settings.provider === 'gemini') {
        if (!settings.geminiApiKey.trim()) throw new Error('Enter your Gemini API key first.');
        // Quick test: list models
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.geminiApiKey.trim()}&pageSize=1`
        );
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || `HTTP ${res.status}`);
        }
        setTestResult({ ok: true, msg: 'Gemini API key is valid.' });
      } else {
        if (!settings.vertexProjectId.trim() || !settings.vertexApiKey.trim()) {
          throw new Error('Enter your Project ID and API key first.');
        }
        const res = await fetch(
          `https://us-central1-aiplatform.googleapis.com/v1/projects/${settings.vertexProjectId.trim()}/locations/${settings.vertexLocation}/publishers/google/models?key=${settings.vertexApiKey.trim()}`
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || `HTTP ${res.status} — check Project ID and key.`);
        }
        setTestResult({ ok: true, msg: 'Vertex AI credentials are valid.' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section>
      <h2>AI Settings</h2>
      <p className="section-desc">
        Configure your AI provider to enable automatic video generation from card images using Google's Veo model.
      </p>

      {/* Provider selector */}
      <div className="settings-card">
        <div className="form-row">
          <label>AI Provider</label>
          <div className="provider-toggle">
            <button
              type="button"
              className={settings.provider === 'gemini' ? 'active' : ''}
              onClick={() => setSettings({ ...settings, provider: 'gemini' })}
            >
              Gemini Developer API
              <span className="badge-pill recommended">Recommended</span>
            </button>
            <button
              type="button"
              className={settings.provider === 'vertex' ? 'active' : ''}
              onClick={() => setSettings({ ...settings, provider: 'vertex' })}
            >
              Vertex AI (Google Cloud)
            </button>
          </div>
        </div>

        {/* Gemini config */}
        {settings.provider === 'gemini' && (
          <>
            <div className="form-row">
              <label>Gemini API Key *</label>
              <input
                type="password"
                value={settings.geminiApiKey}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                placeholder="AIza..."
                autoComplete="off"
              />
            </div>
            <div className="help-text">
              Get a free API key at{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com/app/apikey
              </a>
              . Make sure the <strong>Gemini API</strong> is enabled.
              Veo video generation requires a paid Google AI Studio plan or Gemini API with billing.
            </div>
          </>
        )}

        {/* Vertex AI config */}
        {settings.provider === 'vertex' && (
          <>
            <div className="form-row">
              <label>Google Cloud Project ID *</label>
              <input
                type="text"
                value={settings.vertexProjectId}
                onChange={(e) => setSettings({ ...settings, vertexProjectId: e.target.value })}
                placeholder="my-gcp-project-id"
              />
            </div>
            <div className="form-row">
              <label>Vertex AI API Key *</label>
              <input
                type="password"
                value={settings.vertexApiKey}
                onChange={(e) => setSettings({ ...settings, vertexApiKey: e.target.value })}
                placeholder="AIza..."
                autoComplete="off"
              />
            </div>
            <div className="form-row">
              <label>Location</label>
              <select
                value={settings.vertexLocation}
                onChange={(e) => setSettings({ ...settings, vertexLocation: e.target.value })}
              >
                <option value="us-central1">us-central1 (Iowa)</option>
                <option value="us-east4">us-east4 (Virginia)</option>
                <option value="europe-west4">europe-west4 (Netherlands)</option>
              </select>
            </div>
            <div className="help-text">
              Enable the <strong>Vertex AI API</strong> in your Google Cloud project and create an API key
              at <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                console.cloud.google.com/apis/credentials
              </a>.
            </div>
          </>
        )}

        {/* Test + Save buttons */}
        <div className="settings-actions">
          <button type="button" className="test-btn" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button type="button" className="submit-btn" onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>

        {testResult && (
          <div className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>
            {testResult.ok ? '✓' : '✗'} {testResult.msg}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="info-box">
        <h3>How AI Video Generation Works</h3>
        <ol>
          <li>Upload your card image in the <strong>+ Add Card</strong> tab</li>
          <li>Choose <strong>"Generate with AI"</strong> in the Reveal Video section</li>
          <li>Edit the prompt or use the auto-generated one</li>
          <li>Click <strong>Generate Video</strong> — Veo animates your card image into a looping video</li>
          <li>Preview and approve the result, then save the card</li>
        </ol>
        <p>Generation takes approximately <strong>2–5 minutes</strong> per video.</p>
      </div>
    </section>
  );
}
