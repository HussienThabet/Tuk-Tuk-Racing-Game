// audio.js - Procedural Egyptian Shaabi Music, Tuk-Tuk Engine, Horns & Voice System

class EgyptianAudioSystem {
  constructor() {
    this.ctx = null;
    this.musicEnabled = true;
    this.isPlayingMusic = false;
    this.musicTimer = null;
    this.beatStep = 0;

    // Engine nodes
    this.engineOsc = null;
    this.engineSub = null;
    this.engineGain = null;
    this.engineRunning = false;

    // Voice toast timer
    this.voiceTimeout = null;

    // Authentic Egyptian Cairo street voice lines
    this.voiceLines = {
      start: [
        { speaker: 'الأسطى باشا', avatar: '🧔🏽', text: 'وسع يا أسطى، التوكتوك الباشا وصل!' },
        { speaker: 'الأسطى باشا', avatar: '😎', text: 'يا جدعان، الطريق بتاعي النهارده!' },
        { speaker: 'المعلم عبده', avatar: '👳🏽‍♂️', text: 'توكلنا على الله.. افتح السكة يا ابني!' }
      ],
      overtake: [
        { speaker: 'الأسطى باشا', avatar: '🔥', text: 'إيه يا عم؟ ده سباق مش زفة!' },
        { speaker: 'الأسطى باشا', avatar: '🛺', text: 'عدي يا باشا.. سكة السلامة للجدعان!' },
        { speaker: 'الأسطى حودة', avatar: '😤', text: 'استنى عندك يا باشا ده أنا جايب موتور جديد!' },
        { speaker: 'الأسطى باشا', avatar: '😉', text: 'اللي معاه ربنا يمشي على الميه!' }
      ],
      crash: [
        { speaker: 'الأسطى زغلول', avatar: '😱', text: 'حاسب يا أسطى البوية لسه جديدة والناس بتبص!' },
        { speaker: 'عم سيد الفوال', avatar: '🍲', text: 'يا نهار أبيض! قدرة الفول كانت هتتقلب يا جدعان!' },
        { speaker: 'الأسطى باشا', avatar: '🤕', text: 'حصل خير يا معلم.. في الحديد ولا في العبيد!' },
        { speaker: 'سواق الميكروباص', avatar: '🚐', text: 'ما تفتح يا أسطى إنت فاكر نفسك في صلاح سالم؟!' }
      ],
      chicken: [
        { speaker: 'الأسطى باشا', avatar: '🐔', text: 'خلي بالك من الفرخة يا معلم!' },
        { speaker: 'عم محروس الفرارجي', avatar: '🐓', text: 'امسك الفرخة البيضا دي عليها جمعية يا ولاد الحلال!' }
      ],
      watermelon: [
        { speaker: 'المعلم شحتة', avatar: '🍉', text: 'البطيخ فرط في الشارع يا جدعان.. على السكين يا بطيخ!' }
      ],
      nitro: [
        { speaker: 'الأسطى باشا', avatar: '🚀', text: 'افتح أنبوبة الغاز يا ابني.. طير إنت!' },
        { speaker: 'الأسطى باشا', avatar: '⚡', text: 'الصاروخ المصري انطلق من شبرا!' }
      ],
      delivery: [
        { speaker: 'كشري البرنس', avatar: '🍲', text: 'الكمالة والدقة سخنين.. وصّل الطلب بسرعة يا بطل!' },
        { speaker: 'الزبون الجعان', avatar: '😋', text: 'تسلم إيدك يا أجدع أسطى في المنطقة!' }
      ],
      pickup: [
        { speaker: 'الراكب', avatar: '🧑🏽', text: 'يلا يا أسطى، أنا متأخر جداً على الشغل!' },
        { speaker: 'الست الحاجة', avatar: '👵🏽', text: 'على مهلك يا ابني.. بس بسرعة شوية!' },
        { speaker: 'الطالب', avatar: '🎒', text: 'الحقني يا باشا، عندي امتحان كمان ربع ساعة!' },
        { speaker: 'الراكب', avatar: '🕶️', text: 'خدني على وسط البلد وليك إكرامية حلوة!' }
      ],
      dropoff: [
        { speaker: 'الراكب', avatar: '🤩', text: 'تسلم يا أسطى! أحلى سواقة في القاهرة!' },
        { speaker: 'الست الحاجة', avatar: '👵🏽', text: 'ربنا يكرمك يا ابني وياخد بإيدك!' },
        { speaker: 'الراكب', avatar: '💸', text: 'خد الباقي كله إكرامية يا معلم!' }
      ],
      timeout: [
        { speaker: 'الراكب الغضبان', avatar: '😡', text: 'إنت اتأخرت! هنزل أمشي أحسن!' },
        { speaker: 'الراكب الغضبان', avatar: '😤', text: 'ده أنا كنت هوصل بالحمار أسرع!' }
      ],
      nearmiss: [
        { speaker: 'الراكب', avatar: '😱', text: 'يا نهار أبيض! لحقناها بشعرة!' },
        { speaker: 'الأسطى باشا', avatar: '😎', text: 'متقلقش يا باشا، دي عادي في الحارة!' }
      ],
      pedestrian: [
        { speaker: 'عم سيد', avatar: '😠', text: 'حاسب يا أسطى! هو انت شايفنا شوال؟!' },
        { speaker: 'واحد من الشارع', avatar: '🤬', text: 'ماتفتح عينك يا معلم!' }
      ]
    };
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
  }

  // Start 2-stroke Tuk-Tuk engine rumble
  startEngine() {
    this.init();
    if (this.engineRunning || !this.ctx) return;

    this.engineOsc = this.ctx.createOscillator();
    this.engineSub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc.type = 'sawtooth';
    this.engineSub.type = 'square';
    this.engineOsc.frequency.value = 54;
    this.engineSub.frequency.value = 27;

    filter.type = 'lowpass';
    filter.frequency.value = 260;

    this.engineGain.gain.value = 0.045;

    this.engineOsc.connect(filter);
    this.engineSub.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start();
    this.engineSub.start();
    this.engineRunning = true;
  }

  updateEngine(speedRatio, isDrifting, isNitro) {
    if (!this.engineRunning || !this.ctx) return;
    const now = this.ctx.currentTime;
    const baseFreq = 48 + Math.abs(speedRatio) * 115 + (isNitro ? 55 : 0);
    // Add slight 2-stroke putt-putt vibrato
    const flutter = Math.sin(now * 38) * 3.5;
    this.engineOsc.frequency.setTargetAtTime(baseFreq + flutter, now, 0.05);
    this.engineSub.frequency.setTargetAtTime((baseFreq * 0.5) + flutter * 0.5, now, 0.05);

    const targetGain = isNitro ? 0.075 : (isDrifting ? 0.065 : 0.042);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  stopEngine() {
    if (!this.engineRunning) return;
    try {
      this.engineOsc.stop();
      this.engineSub.stop();
    } catch (e) {}
    this.engineRunning = false;
  }

  // Classic Egyptian Musical Tuk-Tuk Air Horn ("بيب بيب يا معلم")
  playHorn() {
    this.init();
    if (!this.ctx) return;
    // Hijaz-flavored playful 5-note Tuk-Tuk air horn riff
    const notes = [523.25, 554.37, 659.25, 554.37, 659.25];
    const times = [0, 0.11, 0.22, 0.36, 0.48];
    const durs  = [0.09, 0.09, 0.12, 0.09, 0.22];

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc2.type = 'square';
      osc.frequency.value = freq;
      osc2.frequency.value = freq * 1.006;

      const t = this.ctx.currentTime + times[i];
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.11, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durs[i]);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc2.start(t);
      osc.stop(t + durs[i] + 0.02);
      osc2.stop(t + durs[i] + 0.02);
    });
  }

  playCoin() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [987.77, 1318.51].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + idx * 0.07;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  playCrash() {
    this.init();
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.28;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.09));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.25;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }

  playChickenCluck() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.12, 0.24].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + offset;
      osc.frequency.setValueAtTime(620 + idx * 90, t);
      osc.frequency.exponentialRampToValueAtTime(1150, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(480, t + 0.1);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  // Procedural Egyptian Shaabi Beat (Tabla Maqsum + Mizmar Hijaz Melody)
  startShaabiMusic() {
    this.init();
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;

    // Hijaz Maqam scale on D (D, Eb, F#, G, A, Bb, C, D)
    const hijazScale = [293.66, 311.13, 369.99, 392.00, 440.00, 466.16, 523.25, 587.33];
    // Energetic Shaabi Mizmar riff
    const melodyPattern = [
      0, 2, 3, 4,  3, 2, 1, 0,
      4, 5, 4, 3,  2, 3, 2, 0,
      7, 5, 4, 3,  4, 2, 1, 2,
      3, 2, 1, 0,  2, 1, 0, -1
    ];
    // Maqsum Tabla pattern (D = Dum low, T = Tak high, . = rest)
    // 8-step bar: D T . T D . T .
    const tablaPattern = ['D', 'T', '.', 'T', 'D', '.', 'T', 't'];

    this.musicTimer = setInterval(() => {
      if (!this.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const step8 = this.beatStep % 8;
      const step32 = this.beatStep % 32;

      // 1. Tabla / Darbuka hit
      const hit = tablaPattern[step8];
      if (hit === 'D') {
        this.playTablaHit(now, 115, 52, 0.16, 0.11); // Deep Dum
      } else if (hit === 'T') {
        this.playTablaHit(now, 880, 320, 0.06, 0.06); // Crisp Tak
      } else if (hit === 't') {
        this.playTablaHit(now, 1100, 450, 0.04, 0.04); // Ghost Sak
      }

      // 2. Bassline on Dum steps
      if (step8 === 0 || step8 === 4) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.value = step8 === 0 ? 73.42 : 98.0;
        bassGain.gain.setValueAtTime(0.08, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.19);
      }

      // 3. Mizmar / Shaabi Keyboard Lead
      const noteIdx = melodyPattern[step32];
      if (noteIdx >= 0) {
        const freq = hijazScale[noteIdx];
        const leadOsc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const leadGain = this.ctx.createGain();

        leadOsc.type = 'sawtooth';
        leadOsc.frequency.setValueAtTime(freq * 0.98, now);
        leadOsc.frequency.exponentialRampToValueAtTime(freq, now + 0.025); // Mizmar pitch bend

        filter.type = 'bandpass';
        filter.frequency.value = 1350;
        filter.Q.value = 2.8;

        leadGain.gain.setValueAtTime(0.045, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        leadOsc.connect(filter);
        filter.connect(leadGain);
        leadGain.connect(this.ctx.destination);

        leadOsc.start(now);
        leadOsc.stop(now + 0.17);
      }

      this.beatStep++;
    }, 155); // ~193 BPM eighth-notes
  }

  playTablaHit(time, startFreq, endFreq, duration, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled && !this.isPlayingMusic) {
      this.startShaabiMusic();
    }
    return this.musicEnabled;
  }

  // Trigger an Egyptian voice line toast + speech
  speakCategory(category, customEntry = null) {
    const list = this.voiceLines[category] || this.voiceLines.start;
    const item = customEntry || list[Math.floor(Math.random() * list.length)];

    const toast = document.getElementById('voice-toast');
    const avatarEl = document.getElementById('voice-avatar');
    const speakerEl = document.getElementById('voice-speaker');
    const textEl = document.getElementById('voice-text');

    if (toast && avatarEl && speakerEl && textEl) {
      avatarEl.textContent = item.avatar;
      speakerEl.textContent = item.speaker;
      textEl.textContent = `"${item.text}"`;
      toast.classList.remove('hidden');

      clearTimeout(this.voiceTimeout);
      this.voiceTimeout = setTimeout(() => {
        toast.classList.add('hidden');
      }, 3600);
    }

    // Attempt native Arabic speech synthesis if available
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(item.text);
        utter.lang = 'ar-EG';
        utter.rate = 1.12;
        utter.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const arVoice = voices.find(v => v.lang.includes('ar-EG')) || voices.find(v => v.lang.includes('ar'));
        if (arVoice) utter.voice = arVoice;
        window.speechSynthesis.speak(utter);
      } catch (e) {}
    }
  }
}

window.audioSys = new EgyptianAudioSystem();
