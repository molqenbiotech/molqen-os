import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const PRESET_PROTOCOLS = [
  {
    id: 'pcr_default',
    title: 'Standard PCR MasterMix Prep',
    category: 'Molecular Biology',
    steps: [
      'Thaw all reagents on ice. Vortex briefly and pulse-spin in microcentrifuge.',
      'Add 12.5 microliters of 2X PCR MasterMix into sterile 0.2 mL PCR tube.',
      'Add 1.0 microliter of Forward Primer and 1.0 microliter of Reverse Primer (10 micromolar stock).',
      'Add 8.5 microliters of Nuclease-Free Water to adjust final volume.',
      'Add 2.0 microliters of Template DNA (approx. 50-100 nanograms). Gently mix by pipetting.',
      'Cap tubes securely, briefly centrifuge, and place into pre-programmed Thermal Cycler.'
    ]
  },
  {
    id: 'agarose_gel',
    title: '1% Agarose Gel Electrophoresis',
    category: 'Analysis & Imaging',
    steps: [
      'Weigh 1.0 gram of agarose powder and add to 100 mL of 1X TAE or TBE buffer in an Erlenmeyer flask.',
      'Microwave for 1-2 minutes until solution is completely clear. Swirl periodically with heat-resistant gloves.',
      'Allow flask to cool to approximately 50-55 degrees Celsius on the benchtop.',
      'Add 5 microliters of nucleic acid gel stain (e.g., GelRed or Ethidium Bromide) and gently mix.',
      'Pour gel into casting tray with comb inserted. Allow 25-30 minutes to solidify at room temperature.',
      'Submerge gel into electrophoresis tank filled with 1X running buffer and carefully remove comb.'
    ]
  },
  {
    id: 'plasmid_miniprep',
    title: 'Alkaline Lysis Plasmid Miniprep',
    category: 'DNA Extraction',
    steps: [
      'Pellet 3 to 5 mL of overnight bacterial culture at 8,000 RPM for 3 minutes. Discard supernatant.',
      'Resuspend bacterial pellet in 250 microliters of Resuspension Buffer with RNase A. Pipette thoroughly.',
      'Add 250 microliters of Lysis Buffer. Invert tube gently 4 to 6 times. Do not vortex.',
      'Add 350 microliters of Neutralization Buffer immediately. Invert gently 6 times until precipitate forms.',
      'Centrifuge at 13,000 RPM for 10 minutes at room temperature.',
      'Transfer clear supernatant to spin column. Centrifuge at 12,000 RPM for 60 seconds and discard flow-through.',
      'Wash column with 750 microliters of Wash Buffer containing ethanol. Centrifuge 60 seconds.',
      'Centrifuge column empty for 2 minutes to dry resin.',
      'Place column in clean 1.5 mL tube, add 50 microliters of Elution Buffer, incubate 1 minute, and spin to collect purified plasmid.'
    ]
  }
];

export default function SterileMode({ currentLab, onExit }) {
  const [protocols, setProtocols] = useState(PRESET_PROTOCOLS);
  const [selectedProtocol, setSelectedProtocol] = useState(PRESET_PROTOCOLS[0]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(null);
  const [lastHeardCommand, setLastHeardCommand] = useState('');
  
  // Audio defaults to OFF on load so it never plays automatically
  const [voiceNarration, setVoiceNarration] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const stepIndexRef = useRef(0);
  const selectedProtocolRef = useRef(PRESET_PROTOCOLS[0]);
  const voiceNarrationRef = useRef(false);
  const recognitionRef = useRef(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    stepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    selectedProtocolRef.current = selectedProtocol;
  }, [selectedProtocol]);

  useEffect(() => {
    voiceNarrationRef.current = voiceNarration;
  }, [voiceNarration]);

  // Completely kill all audio on mount and unmount
  useEffect(() => {
    isComponentMounted.current = true;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    async function loadLabProtocols() {
      if (!currentLab?.id) return;
      try {
        const protocolsRef = collection(db, 'protocols');
        const q = query(protocolsRef, where('labId', '==', currentLab.id));
        const snap = await getDocs(q);
        const dynamicProtocols = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (dynamicProtocols.length > 0) {
          setProtocols([...dynamicProtocols, ...PRESET_PROTOCOLS]);
          setSelectedProtocol(dynamicProtocols[0]);
        }
      } catch (err) {
        console.warn('Preset fallback active:', err);
      }
    }
    loadLabProtocols();

    return () => {
      isComponentMounted.current = false;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Cleanup on unmount
        }
        recognitionRef.current = null;
      }
    };
  }, [currentLab?.id]);

  // Audio reader: strictly opt-in
  const speakStep = (indexToSpeak) => {
    if (!voiceNarrationRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const protocol = selectedProtocolRef.current;
    const targetIdx = typeof indexToSpeak === 'number' ? indexToSpeak : stepIndexRef.current;
    const text = protocol?.steps?.[targetIdx];
    if (!text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Step ${targetIdx + 1}: ${text}`);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Exit trigger with tactile animation and audio silencing
  const triggerExit = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopListening();
    setIsExiting(true);

    setTimeout(() => {
      if (typeof onExit === 'function') {
        onExit();
      }
    }, 180);
  };

  // Step changing logic
  const goToStep = (newIndex, speak = false) => {
    const total = selectedProtocolRef.current?.steps?.length || 1;
    const boundedIndex = Math.max(0, Math.min(newIndex, total - 1));
    setCurrentStepIndex(boundedIndex);
    if (speak && voiceNarrationRef.current) {
      speakStep(boundedIndex);
    }
  };

  // Speech recognition engine
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError('Speech recognition is not supported in this browser. Please use Google Chrome or Safari.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setMicError('Microphone permission blocked. Please allow mic access in your browser bar.');
          setIsListening(false);
        } else if (event.error !== 'no-speech') {
          setMicError(`Voice engine note: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (isComponentMounted.current && isListening) {
          try {
            recognition.start();
          } catch {
            // Keep listener active
          }
        }
      };

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
        setLastHeardCommand(transcript);

        const currentActive = stepIndexRef.current;

        if (transcript.includes('next') || transcript.includes('forward') || transcript.includes('done')) {
          goToStep(currentActive + 1, true);
        } else if (transcript.includes('back') || transcript.includes('previous')) {
          goToStep(currentActive - 1, true);
        } else if (transcript.includes('repeat') || transcript.includes('again') || transcript.includes('read')) {
          speakStep(currentActive);
        } else if (transcript.includes('exit') || transcript.includes('quit') || transcript.includes('stop')) {
          triggerExit();
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      setMicError(err.message);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Stop cleanly
      }
    }
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
              {selectedProtocol.title}
            </h1>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0'
            }}>
              Sterile Biosafety Mode
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Hands-Free ELN Navigation for Biosafety Cabinets
          </p>
        </div>

        {/* Tactile animated Exit Button */}
        <button
          type="button"
          onClick={triggerExit}
          style={{
            padding: '10px 20px',
            backgroundColor: isExiting ? '#b91c1c' : '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: isExiting ? '0 1px 2px rgba(0,0,0,0.2)' : '0 3px 6px rgba(239, 68, 68, 0.3)',
            transform: isExiting ? 'scale(0.94)' : 'scale(1)',
            transition: 'transform 0.12s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.12s ease'
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.94)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          ✕ Exit to Dashboard
        </button>
      </div>

      {/* Protocol Selection & Audio Toggle */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '14px 18px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Select Protocol:</span>
          <select
            value={selectedProtocol.id}
            onChange={(e) => {
              const proto = protocols.find(p => p.id === e.target.value);
              if (proto) {
                if (window.speechSynthesis) window.speechSynthesis.cancel();
                setSelectedProtocol(proto);
                setCurrentStepIndex(0);
              }
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '13px',
              color: '#1f2937',
              backgroundColor: '#f9fafb',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {protocols.map(p => (
              <option key={p.id} value={p.id}>{p.title} ({p.category || 'Bench SOP'})</option>
            ))}
          </select>
        </div>

        {/* Audio Toggle (Defaults OFF) */}
        <button
          type="button"
          onClick={() => {
            const next = !voiceNarration;
            setVoiceNarration(next);
            if (!next && window.speechSynthesis) {
              window.speechSynthesis.cancel();
            }
          }}
          style={{
            background: voiceNarration ? '#ecfdf5' : '#f3f4f6',
            border: `1px solid ${voiceNarration ? '#a7f3d0' : '#e5e7eb'}`,
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            color: voiceNarration ? '#059669' : '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          {voiceNarration ? '🔊 Voice Narration: ON' : '🔈 Voice Narration: OFF (Muted)'}
        </button>
      </div>

      {/* Mic Status Banner */}
      <div style={{
        backgroundColor: isListening ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${isListening ? '#bbf7d0' : '#fecaca'}`,
        padding: '12px 18px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: isListening ? '#10b981' : '#ef4444',
            boxShadow: isListening ? '0 0 8px #10b981' : 'none'
          }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: isListening ? '#166534' : '#991b1b' }}>
            {isListening ? 'Microphone Active — Voice Commands: "Next", "Back", "Repeat", "Exit"' : 'Microphone Paused'}
          </span>
          {lastHeardCommand && isListening && (
            <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
              (Heard: "{lastHeardCommand}")
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleMic}
          style={{
            padding: '7px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
            border: 'none',
            backgroundColor: isListening ? '#ef4444' : '#10b981',
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          {isListening ? 'Pause Mic' : 'Start Mic Recognition'}
        </button>
      </div>

      {micError && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          marginBottom: '20px'
        }}>
          ⚠️ <strong>Notice:</strong> {micError}
        </div>
      )}

      {/* Protocol Step Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {selectedProtocol.steps.map((stepText, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone = idx < currentStepIndex;

          return (
            <div
              key={idx}
              onClick={() => goToStep(idx, false)}
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: isActive ? '2px solid #10b981' : '1px solid #e5e7eb',
                backgroundColor: isActive ? '#f0fdf4' : isDone ? '#fafafa' : '#ffffff',
                boxShadow: isActive ? '0 4px 12px rgba(16, 185, 129, 0.12)' : 'none',
                opacity: !isActive && !isDone ? 0.65 : 1,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: isActive ? '#059669' : isDone ? '#9ca3af' : '#6b7280'
                }}>
                  Step {idx + 1} {isDone && '✓ Completed'}
                </span>
                {isActive && (
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>
                    Active Step
                  </span>
                )}
              </div>

              <div style={{
                fontSize: isActive ? '18px' : '15px',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#111827' : '#4b5563',
                lineHeight: '1.5'
              }}>
                {stepText}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Bench Controls */}
      <div style={{
        marginTop: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <button
          type="button"
          onClick={() => goToStep(currentStepIndex - 1, true)}
          disabled={currentStepIndex === 0}
          style={{
            padding: '10px 18px',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: currentStepIndex === 0 ? '#9ca3af' : '#374151',
            cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          ← Previous Step
        </button>

        <button
          type="button"
          onClick={() => {
            if (!voiceNarration) setVoiceNarration(true);
            speakStep(currentStepIndex);
          }}
          style={{
            padding: '10px 16px',
            backgroundColor: '#f3f4f6',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#374151',
            cursor: 'pointer'
          }}
        >
          🔊 Repeat Step {currentStepIndex + 1}
        </button>

        <button
          type="button"
          onClick={() => goToStep(currentStepIndex + 1, true)}
          disabled={currentStepIndex === selectedProtocol.steps.length - 1}
          style={{
            padding: '10px 22px',
            backgroundColor: '#10b981',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            color: '#ffffff',
            cursor: currentStepIndex === selectedProtocol.steps.length - 1 ? 'not-allowed' : 'pointer'
          }}
        >
          Next Step →
        </button>
      </div>
    </div>
  );
}