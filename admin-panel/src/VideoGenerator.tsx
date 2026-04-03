import React, { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { AISettings } from './Settings';

// ─── Prompt helpers ──────────────────────────────────────────────────────────

const TYPE_EFFECTS: Record<string, string> = {
  Fire:     'flames dance and flicker, heat haze shimmers around the creature',
  Water:    'water ripples and flows, light refracts through gentle waves',
  Grass:    'leaves rustle in a warm breeze, nature glows with soft green light',
  Electric: 'electricity crackles and pulses, lightning arcs around the creature',
  Ice:      'frost crystals slowly form, cold mist drifts across the scene',
  Dark:     'shadows swirl and shift, mysterious dark energy emanates',
  Rock:     'the ground trembles slightly, stone particles float in the air',
  Flying:   'wings beat gently, air currents shimmer and swirl',
  Psychic:  'psychic energy pulses in waves, a mystical aura glows',
  Steel:    'metal gleams and reflects light, sparks flash off the armor',
  Dragon:   'scales shimmer, powerful wings flex, ancient energy radiates',
  Ghost:    'ethereal glow pulses, translucent wisps drift around the form',
  Poison:   'toxic vapor swirls, a purple haze glows ominously',
  Ground:   'dust rises from shifting earth, the ground cracks and reforms',
  Fighting: 'powerful muscles flex, battle energy crackles with intensity',
  Normal:   'warm light shifts, the creature breathes and moves subtly',
};

const RARITY_INTENSITY: Record<string, string> = {
  common:    'vivid and clean',
  uncommon:  'dynamic and striking',
  rare:      'impressive and cinematic',
  legendary: 'epic, dramatic, and awe-inspiring',
};

export function buildDefaultPrompt(name: string, type: string, rarity: string, description: string): string {
  const effect = TYPE_EFFECTS[type] || 'magical energy pulses and swirls around the creature';
  const intensity = RARITY_INTENSITY[rarity] || 'dynamic';
  const lore = description ? ` ${description.split('.')[0].trim()}.` : '';
  return `The card art comes alive in a ${intensity} animated scene.${lore} ${effect}. The creature ${name} moves subtly with power and presence. Cinematic lighting with dramatic shadows. Perfect seamless loop for a trading card game reveal. No text, no UI elements, just the living card art.`;
}

// ─── Veo API ──────────────────────────────────────────────────────────────────

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] ?? file.type;
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateViaGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  durationSeconds: number,
  apiKey: string,
  onProgress: (msg: string) => void
): Promise<Blob> {
  onProgress('Sending request to Gemini Veo API...');

  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{
          prompt,
          image: { bytesBase64Encoded: imageBase64, mimeType },
        }],
        parameters: {
          aspectRatio: '9:16',
          sampleCount: 1,
          durationSeconds,
          enhancePrompt: true,
        },
      }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Gemini API error: HTTP ${startRes.status}`);
  }

  const operation = await startRes.json();
  const operationName: string = operation.name;
  if (!operationName) throw new Error('No operation name returned from Gemini API.');

  return pollOperation(
    `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
    onProgress
  );
}

async function generateViaVertex(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  durationSeconds: number,
  projectId: string,
  apiKey: string,
  location: string,
  onProgress: (msg: string) => void
): Promise<Blob> {
  onProgress('Sending request to Vertex AI Veo API...');

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/veo-2.0-generate-001:predictLongRunning`;

  const startRes = await fetch(`${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{
        prompt,
        image: { bytesBase64Encoded: imageBase64, mimeType },
      }],
      parameters: {
        aspectRatio: '9:16',
        sampleCount: 1,
        durationSeconds,
        enhancePrompt: true,
      },
    }),
  });

  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Vertex AI error: HTTP ${startRes.status}`);
  }

  const operation = await startRes.json();
  const operationName: string = operation.name;
  if (!operationName) throw new Error('No operation name returned from Vertex AI.');

  const pollUrl = `https://${location}-aiplatform.googleapis.com/v1/${operationName}?key=${apiKey}`;
  return pollOperation(pollUrl, onProgress);
}

async function pollOperation(
  pollUrl: string,
  onProgress: (msg: string) => void
): Promise<Blob> {
  const MAX_ATTEMPTS = 72; // 6 min max (5s intervals)

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await sleep(5000);
    const elapsed = attempt * 5;
    onProgress(`Generating video... ${elapsed}s elapsed (this takes 2–5 minutes)`);

    const res = await fetch(pollUrl);
    if (!res.ok) continue;

    const data = await res.json();

    if (!data.done) continue;

    if (data.error) throw new Error(data.error.message ?? 'Generation failed.');

    // Try multiple possible response shapes (Gemini vs Vertex differ slightly)
    const videoBase64 =
      data.response?.predictions?.[0]?.bytesBase64Encoded ||
      data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.bytesBase64Encoded ||
      data.response?.videos?.[0]?.bytesBase64Encoded;

    if (!videoBase64) {
      throw new Error('Generation completed but no video data in response. Check your API quota.');
    }

    onProgress('Video ready! Uploading to storage...');
    const bytes = Uint8Array.from(atob(videoBase64), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: 'video/mp4' });
  }

  throw new Error('Video generation timed out after 6 minutes. Try again or use a shorter duration.');
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  cardId: string;
  cardName: string;
  cardType: string;
  cardRarity: string;
  cardDescription: string;
  imageFile: File | null;
  settings: AISettings;
  onVideoReady: (videoUrl: string) => void;
};

type GenState = 'idle' | 'generating' | 'done' | 'error';

export default function VideoGenerator({
  cardId,
  cardName,
  cardType,
  cardRarity,
  cardDescription,
  imageFile,
  settings,
  onVideoReady,
}: Props) {
  const [prompt, setPrompt] = useState(() =>
    buildDefaultPrompt(cardName, cardType, cardRarity, cardDescription)
  );
  const [duration, setDuration] = useState(8);
  const [state, setState] = useState<GenState>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [finalVideoUrl, setFinalVideoUrl] = useState('');
  const abortRef = useRef(false);

  // Re-build prompt when card fields change
  React.useEffect(() => {
    if (state === 'idle') {
      setPrompt(buildDefaultPrompt(cardName, cardType, cardRarity, cardDescription));
    }
  }, [cardName, cardType, cardRarity, cardDescription, state]);

  const handleGenerate = async () => {
    if (!imageFile) {
      setError('Upload a card image first before generating a video.');
      return;
    }
    if (!settings.geminiApiKey && settings.provider === 'gemini') {
      setError('Add your Gemini API key in Settings first.');
      return;
    }
    if (settings.provider === 'vertex' && (!settings.vertexProjectId || !settings.vertexApiKey)) {
      setError('Configure Vertex AI credentials in Settings first.');
      return;
    }

    abortRef.current = false;
    setState('generating');
    setError('');
    setProgress('');
    setPreviewUrl('');
    setFinalVideoUrl('');

    try {
      const { base64, mimeType } = await fileToBase64(imageFile);

      let videoBlob: Blob;

      if (settings.provider === 'gemini') {
        videoBlob = await generateViaGemini(
          base64, mimeType, prompt.trim(), duration,
          settings.geminiApiKey.trim(),
          (msg) => { if (!abortRef.current) setProgress(msg); }
        );
      } else {
        videoBlob = await generateViaVertex(
          base64, mimeType, prompt.trim(), duration,
          settings.vertexProjectId.trim(),
          settings.vertexApiKey.trim(),
          settings.vertexLocation,
          (msg) => { if (!abortRef.current) setProgress(msg); }
        );
      }

      if (abortRef.current) return;

      // Create local preview
      const objectUrl = URL.createObjectURL(videoBlob);
      setPreviewUrl(objectUrl);

      // Upload to Firebase Storage
      setProgress('Uploading video to Firebase Storage...');
      const storageRef = ref(storage, `cards/${cardId}/reveal.mp4`);
      await uploadBytes(storageRef, videoBlob, { contentType: 'video/mp4' });
      const downloadUrl = await getDownloadURL(storageRef);

      setFinalVideoUrl(downloadUrl);
      setState('done');
      setProgress('');
      onVideoReady(downloadUrl);
    } catch (e: any) {
      if (!abortRef.current) {
        setState('error');
        setError(e.message ?? 'Unknown error during generation.');
      }
    }
  };

  const handleReset = () => {
    abortRef.current = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setState('idle');
    setError('');
    setProgress('');
    setPreviewUrl('');
    setFinalVideoUrl('');
  };

  return (
    <div className="video-generator">
      {/* Prompt */}
      <div className="form-row">
        <label>Animation Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          disabled={state === 'generating'}
          placeholder="Describe how the card should come to life..."
        />
        <span className="help-inline">
          Veo will animate your card image based on this prompt. Edit it to customize the effect.
        </span>
      </div>

      {/* Duration */}
      <div className="form-row">
        <label>Video Duration</label>
        <div className="duration-toggle">
          {[5, 8, 10].map((d) => (
            <button
              key={d}
              type="button"
              className={duration === d ? 'active' : ''}
              onClick={() => setDuration(d)}
              disabled={state === 'generating'}
            >
              {d}s
            </button>
          ))}
        </div>
        <span className="help-inline">Longer = more detail, slower generation, higher API cost.</span>
      </div>

      {/* Generate button */}
      {state !== 'done' && (
        <button
          type="button"
          className={`generate-btn ${state === 'generating' ? 'generating' : ''}`}
          onClick={handleGenerate}
          disabled={state === 'generating'}
        >
          {state === 'generating' ? (
            <>
              <span className="spinner" /> Generating with Veo...
            </>
          ) : (
            '✦ Generate Video with AI'
          )}
        </button>
      )}

      {/* Progress */}
      {state === 'generating' && progress && (
        <div className="gen-progress">
          <div className="progress-bar-indeterminate" />
          <p>{progress}</p>
          <button type="button" className="cancel-btn" onClick={handleReset}>
            Cancel
          </button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="gen-error">
          <strong>Generation failed:</strong> {error}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="small" onClick={handleReset}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Preview + approval */}
      {state === 'done' && previewUrl && (
        <div className="gen-preview">
          <p className="gen-success">✓ Video generated and uploaded successfully!</p>
          <video
            src={previewUrl}
            autoPlay
            loop
            muted
            playsInline
            className="video-preview"
          />
          <div className="preview-actions">
            <span className="preview-approved">✓ Using this video</span>
            <button type="button" className="small" onClick={handleReset}>
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
