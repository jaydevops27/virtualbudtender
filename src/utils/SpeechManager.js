class SpeechManager {
  constructor() {
    this.speechSynthesis = window.speechSynthesis;
    this.currentUtterance = null;
    this.isPlaying = false;
    this.onStateChange = null;
    this.queue = [];
    this.isProcessingQueue = false;

    // Configure default voice
    this.setPreferredVoice();
  }

  setPreferredVoice() {
    // Wait for voices to be loaded
    if (this.speechSynthesis.getVoices().length === 0) {
      this.speechSynthesis.addEventListener('voiceschanged', () => {
        this.selectVoice();
      });
    } else {
      this.selectVoice();
    }
  }

  selectVoice() {
    const voices = this.speechSynthesis.getVoices();
    this.preferredVoice = voices.find(voice => 
      voice.lang === 'en-US' && voice.name.includes('Female')
    ) || voices.find(voice => 
      voice.lang === 'en-US'
    ) || voices[0];
  }

  speak(text, onStart, onEnd, onError) {
    // Add to queue
    this.queue.push({ text, onStart, onEnd, onError });
    
    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    const { text, onStart, onEnd, onError } = this.queue.shift();

    try {
      await this.speakText(text, onStart, onEnd, onError);
      this.processQueue();
    } catch (error) {
      onError?.(error);
      this.processQueue();
    }
  }

  speakText(text, onStart, onEnd, onError) {
    return new Promise((resolve, reject) => {
      this.stop();

      this.currentUtterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance.voice = this.preferredVoice;
      this.currentUtterance.rate = 1;
      this.currentUtterance.pitch = 1;

      this.currentUtterance.onstart = () => {
        this.isPlaying = true;
        onStart?.();
        this.onStateChange?.(true);
      };

      this.currentUtterance.onend = () => {
        this.isPlaying = false;
        this.currentUtterance = null;
        onEnd?.();
        this.onStateChange?.(false);
        resolve();
      };

      this.currentUtterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        this.isPlaying = false;
        this.currentUtterance = null;
        onError?.(error);
        this.onStateChange?.(false);
        reject(error);
      };

      // Break long text into sentences for better handling
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      this.currentUtterance.text = sentences.join(' ');

      this.speechSynthesis.speak(this.currentUtterance);
    });
  }

  pause() {
    if (this.isPlaying) {
      this.speechSynthesis.pause();
      this.isPlaying = false;
      this.onStateChange?.(false);
    }
  }

  resume() {
    if (this.currentUtterance && !this.isPlaying) {
      this.speechSynthesis.resume();
      this.isPlaying = true;
      this.onStateChange?.(true);
    }
  }

  stop() {
    this.speechSynthesis.cancel();
    this.isPlaying = false;
    this.currentUtterance = null;
    this.onStateChange?.(false);
    this.queue = [];
    this.isProcessingQueue = false;
  }

  setStateChangeCallback(callback) {
    this.onStateChange = callback;
  }
}

export default SpeechManager;