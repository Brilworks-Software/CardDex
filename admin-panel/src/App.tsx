import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, db, storage } from './firebase';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import VideoGenerator from './VideoGenerator';
import Settings, { loadSettings, isAIConfigured, AISettings } from './Settings';
import AdminLogin from './AdminLogin';
import './App.css';

type Card = {
  id: string;
  number: number;
  name: string;
  rarity: string;
  type: string;
  hp: number;
  description: string;
  imageUrl: string;
  videoUrl: string;
};

type QRCodeDoc = {
  id: string;
  cardId: string;
  used: boolean;
  claimedBy: string | null;
};

type Tab = 'cards' | 'add' | 'codes' | 'settings';
type VideoMode = 'upload' | 'ai';

const REDEEM_BASE = 'carddex://redeem';

export default function App() {
  // ── Auth gate ────────────────────────────────────────────────────────────
  const [authUser, setAuthUser]   = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Re-verify admin claim (token may have been refreshed)
        const token = await user.getIdTokenResult();
        setAuthUser(token.claims.admin ? user : null);
      } else {
        setAuthUser(null);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  if (!authReady) {
    return <div className="auth-loading"><span className="spinner" /> Loading…</div>;
  }

  if (!authUser) {
    return <AdminLogin onLogin={() => {/* onAuthStateChanged fires automatically */}} />;
  }

  // ── Admin panel ──────────────────────────────────────────────────────────
  return <AdminPanel authUser={authUser} />;
}

function AdminPanel({ authUser }: { authUser: User }) {
  const [tab, setTab] = useState<Tab>('cards');
  const [cards, setCards] = useState<Card[]>([]);
  const [codes, setCodes] = useState<QRCodeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [aiSettings, setAiSettings] = useState<AISettings>(loadSettings);

  // Add card form
  const [form, setForm] = useState({
    name: '',
    number: '',
    type: 'Fire',
    hp: '',
    rarity: 'common',
    description: '',
    codeCount: '3',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoMode, setVideoMode] = useState<VideoMode>('upload');
  const [aiVideoUrl, setAiVideoUrl] = useState('');

  const cardId = form.number ? `card-${String(form.number).padStart(3, '0')}` : '';

  const loadCards = async () => {
    const q = query(collection(db, 'cards'), orderBy('number', 'asc'));
    const snap = await getDocs(q);
    setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Card)));
  };

  const loadCodes = async () => {
    const snap = await getDocs(collection(db, 'qr_codes'));
    setCodes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as QRCodeDoc)));
  };

  useEffect(() => { loadCards(); loadCodes(); }, []);

  const handleImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview('');
    }
    // Reset AI video if image changes
    setAiVideoUrl('');
  };

  const resetForm = () => {
    setForm({ name: '', number: '', type: 'Fire', hp: '', rarity: 'common', description: '', codeCount: '3' });
    setImageFile(null);
    setImagePreview('');
    setVideoFile(null);
    setVideoMode('upload');
    setAiVideoUrl('');
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.number || !form.type || !form.hp || !imageFile) {
      setMessage('error:Please fill all required fields and upload a card image.');
      return;
    }
    if (videoMode === 'ai' && !aiVideoUrl) {
      setMessage('error:Generate a video with AI or switch to "Upload Video" before saving.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const id = `card-${String(form.number).padStart(3, '0')}`;

      // Upload image
      const imgRef = ref(storage, `cards/${id}/card.jpg`);
      await uploadBytes(imgRef, imageFile);
      const imageUrl = await getDownloadURL(imgRef);

      // Video URL: AI-generated already uploaded, or upload file now
      let videoUrl = aiVideoUrl;
      if (videoMode === 'upload' && videoFile) {
        const vidRef = ref(storage, `cards/${id}/reveal.mp4`);
        await uploadBytes(vidRef, videoFile);
        videoUrl = await getDownloadURL(vidRef);
      }

      // Write card to Firestore
      await setDoc(doc(db, 'cards', id), {
        number: Number(form.number),
        name: form.name,
        type: form.type,
        hp: Number(form.hp),
        rarity: form.rarity,
        description: form.description,
        imageUrl,
        videoUrl,
        createdAt: serverTimestamp(),
      });

      // Generate QR codes
      const batch = writeBatch(db);
      const count = Number(form.codeCount) || 3;
      for (let i = 0; i < count; i++) {
        const code = uuidv4();
        batch.set(doc(db, 'qr_codes', code), {
          cardId: id,
          used: false,
          claimedBy: null,
          claimedAt: null,
          createdAt: new Date().toISOString(),
        });
      }
      await batch.commit();

      setMessage(`success:Card "${form.name}" added with ${count} QR codes!${videoUrl ? ' Reveal video attached.' : ' No video — add one later via Firebase console.'}`);
      resetForm();
      await Promise.all([loadCards(), loadCodes()]);
    } catch (err: any) {
      setMessage(`error:${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = async (code: string, cardName: string) => {
    const url = `${REDEEM_BASE}/${code}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${cardName.replace(/\s/g, '-')}-${code.slice(0, 8)}.png`;
    a.click();
  };

  const downloadAllQRForCard = async (cardId: string, cardName: string) => {
    const cardCodes = codes.filter((c) => c.cardId === cardId && !c.used);
    for (const c of cardCodes) await downloadQRCode(c.id, cardName);
  };

  const cardMap = Object.fromEntries(cards.map((c) => [c.id, c.name]));
  const aiReady = isAIConfigured(aiSettings);

  const [msgType, msgText] = message.startsWith('error:')
    ? ['error', message.slice(6)]
    : message.startsWith('success:')
    ? ['success', message.slice(8)]
    : ['success', message];

  const CARD_TYPES = ['Fire','Water','Grass','Electric','Ice','Dark','Rock','Flying','Psychic','Steel','Dragon','Ghost','Poison','Ground','Fighting','Normal'];

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>CardDex Admin</h1>
        <nav>
          <button className={tab === 'cards' ? 'active' : ''} onClick={() => setTab('cards')}>All Cards</button>
          <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>+ Add Card</button>
          <button className={tab === 'codes' ? 'active' : ''} onClick={() => setTab('codes')}>QR Codes</button>
          <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
            ⚙ AI Settings
            {!aiReady && <span className="nav-dot" title="AI not configured" />}
          </button>
        </nav>
        <div className="header-user">
          <span className="header-email">{authUser.email}</span>
          <button className="signout-btn" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </header>

      <main>
        {message && (
          <div className={`message ${msgType}`}>{msgText}</div>
        )}

        {/* ── All Cards ── */}
        {tab === 'cards' && (
          <section>
            <h2>Cards ({cards.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Type</th><th>Rarity</th><th>HP</th>
                  <th>Video</th><th>Codes (unused)</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => {
                  const cardCodes = codes.filter((c) => c.cardId === card.id);
                  const unusedCount = cardCodes.filter((c) => !c.used).length;
                  return (
                    <tr key={card.id}>
                      <td>#{String(card.number).padStart(3, '0')}</td>
                      <td>{card.name}</td>
                      <td>{card.type}</td>
                      <td className={`rarity-${card.rarity}`}>{card.rarity}</td>
                      <td>{card.hp}</td>
                      <td>
                        {card.videoUrl
                          ? <span className="badge available">✓ Video</span>
                          : <span className="badge used">No video</span>}
                      </td>
                      <td>{unusedCount} / {cardCodes.length}</td>
                      <td>
                        <button className="small" onClick={() => downloadAllQRForCard(card.id, card.name)}>
                          Download QRs
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {cards.length === 0 && <p className="empty">No cards yet. Click "+ Add Card" to get started.</p>}
          </section>
        )}

        {/* ── Add Card ── */}
        {tab === 'add' && (
          <section>
            <h2>Add New Card</h2>
            <div className="add-layout">
              {/* Left: form */}
              <form onSubmit={handleAddCard} className="add-form">

                {/* Card details */}
                <div className="form-section-title">Card Details</div>

                <div className="form-row-inline">
                  <div className="form-row">
                    <label>Card Number *</label>
                    <input type="number" value={form.number}
                      onChange={(e) => setForm({ ...form, number: e.target.value })}
                      placeholder="e.g. 11" min="1" />
                  </div>
                  <div className="form-row">
                    <label>HP *</label>
                    <input type="number" value={form.hp}
                      onChange={(e) => setForm({ ...form, hp: e.target.value })}
                      placeholder="e.g. 120" />
                  </div>
                </div>

                <div className="form-row">
                  <label>Name *</label>
                  <input type="text" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Emberclaw" />
                </div>

                <div className="form-row-inline">
                  <div className="form-row">
                    <label>Type *</label>
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      {CARD_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Rarity</label>
                    <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}>
                      <option value="common">Common</option>
                      <option value="uncommon">Uncommon</option>
                      <option value="rare">Rare</option>
                      <option value="legendary">Legendary</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <label>Description / Lore</label>
                  <textarea value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Card lore used for AI prompt generation..." rows={3} />
                </div>

                {/* Card image */}
                <div className="form-section-title">Card Image</div>
                <div className="form-row">
                  <label>Card Image * (.jpg / .png)</label>
                  <input type="file" accept="image/*"
                    onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)} />
                  <span className="help-inline">Recommended: 400 × 560 px</span>
                </div>

                {/* Reveal video */}
                <div className="form-section-title">Reveal Video</div>

                <div className="video-mode-toggle">
                  <button
                    type="button"
                    className={videoMode === 'upload' ? 'active' : ''}
                    onClick={() => setVideoMode('upload')}
                  >
                    Upload Video
                  </button>
                  <button
                    type="button"
                    className={videoMode === 'ai' ? 'active' : ''}
                    onClick={() => {
                      setVideoMode('ai');
                      if (!aiReady) setTab('settings');
                    }}
                  >
                    ✦ Generate with AI
                    {!aiReady && <span className="badge-pill setup-needed">Setup needed</span>}
                  </button>
                </div>

                {videoMode === 'upload' && (
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <label>Reveal Video (.mp4)</label>
                    <input type="file" accept="video/*"
                      onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                    <span className="help-inline">Optional — can be added later.</span>
                  </div>
                )}

                {videoMode === 'ai' && !aiReady && (
                  <div className="ai-setup-prompt">
                    Configure your AI credentials in{' '}
                    <button type="button" className="link-btn" onClick={() => setTab('settings')}>
                      ⚙ AI Settings
                    </button>{' '}
                    to enable video generation.
                  </div>
                )}

                {videoMode === 'ai' && aiReady && (
                  <VideoGenerator
                    cardId={cardId}
                    cardName={form.name}
                    cardType={form.type}
                    cardRarity={form.rarity}
                    cardDescription={form.description}
                    imageFile={imageFile}
                    settings={aiSettings}
                    onVideoReady={(url) => setAiVideoUrl(url)}
                  />
                )}

                {/* QR codes */}
                <div className="form-section-title">QR Codes</div>
                <div className="form-row">
                  <label>Number of QR Codes to Generate</label>
                  <input type="number" value={form.codeCount}
                    onChange={(e) => setForm({ ...form, codeCount: e.target.value })}
                    min="1" max="1000" />
                  <span className="help-inline">Each code can only be redeemed once.</span>
                </div>

                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Saving...' : 'Save Card & Generate QR Codes'}
                </button>
              </form>

              {/* Right: image preview */}
              <div className="card-preview-panel">
                <div className="form-section-title">Preview</div>
                <div className={`card-preview-frame rarity-border-${form.rarity}`}>
                  {imagePreview
                    ? <img src={imagePreview} alt="Card preview" />
                    : <div className="card-preview-empty">
                        <span>No image yet</span>
                      </div>
                  }
                </div>
                {form.name && (
                  <div className="card-preview-info">
                    <span className={`rarity-${form.rarity}`}>{form.rarity.toUpperCase()}</span>
                    <strong>{form.name}</strong>
                    <span>{form.type} · HP {form.hp || '—'}</span>
                    {aiVideoUrl && <span className="video-ready-badge">✓ AI Video Ready</span>}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── QR Codes ── */}
        {tab === 'codes' && (
          <section>
            <h2>
              QR Codes — {codes.length} total &nbsp;|&nbsp;
              <span style={{ color: '#4caf50' }}>{codes.filter((c) => !c.used).length} available</span>
              &nbsp;|&nbsp;
              <span style={{ color: '#666' }}>{codes.filter((c) => c.used).length} claimed</span>
            </h2>
            <table>
              <thead>
                <tr><th>Code</th><th>Card</th><th>Status</th><th>Claimed By</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id}>
                    <td className="mono">{code.id.slice(0, 16)}…</td>
                    <td>{cardMap[code.cardId] ?? code.cardId}</td>
                    <td>
                      <span className={code.used ? 'badge used' : 'badge available'}>
                        {code.used ? 'Claimed' : 'Available'}
                      </span>
                    </td>
                    <td className="mono">{code.claimedBy ? code.claimedBy.slice(0, 12) + '…' : '—'}</td>
                    <td>
                      {!code.used && (
                        <button className="small"
                          onClick={() => downloadQRCode(code.id, cardMap[code.cardId] ?? 'card')}>
                          Download QR
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Settings ── */}
        {tab === 'settings' && (
          <Settings onSaved={() => setAiSettings(loadSettings())} />
        )}
      </main>
    </div>
  );
}
