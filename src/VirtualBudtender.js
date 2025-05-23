import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, VolumeX, Volume2, RefreshCw } from 'lucide-react';
import axios from 'axios';

import LoadingAnimation from './components/LoadingAnimation';
import Message from './components/Message';
import PreferenceModal from './components/PreferenceModal';
import SpeechManager from './utils/SpeechManager';
import './VirtualBudtender.css';

const VOICE_OPTIONS = {
  DEFAULT: 'en-US',
  RATE: 1,
  PITCH: 1
};

const TIMING = {
  THINKING: 1500,
  MESSAGE_DELAY: 500
};

const VirtualBudtender = () => {
  const [showPreferenceModal, setShowPreferenceModal] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState('');
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState('text');
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userId] = useState(() => `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const chatEndRef = useRef(null);
  const recognition = useRef(null);
  const lastProcessedMessage = useRef('');
  const lastUsedFiltersRef = useRef(null);
  const speechManagerRef = useRef(null);

  useEffect(() => {
    try {
      speechManagerRef.current = new SpeechManager();
      speechManagerRef.current.setStateChangeCallback(setIsPlaying);
      return () => speechManagerRef.current?.stop();
    } catch (error) {
      console.error('Error initializing SpeechManager:', error);
    }
  }, []);

  useEffect(() => {
    setIsSpeechSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSubmit = useCallback(async (msg) => {
    if (typeof msg === 'object' && msg.type === 'RECOMMENDATION_REQUEST') {
      const { filters } = msg;
      const mergedFilters = filters || lastUsedFiltersRef.current;

      const response = await axios.post('http://localhost:5001/api/chat', {
        message: 'see more recommendations',
        userId,
        filters: mergedFilters
      });

      const { greeting, recommendations } = response.data;
      const shownProductIds = new Set();
      chatHistory.forEach(m => m.recommendations?.forEach(r => shownProductIds.add(r.CatalogItemId)));

      const newRecommendations = recommendations.filter(r => !shownProductIds.has(r.CatalogItemId));

      const responseMessage = {
        type: 'budtender',
        content: greeting || 'Here are some more recommendations for you:',
        id: Date.now(),
        recommendations: newRecommendations.slice(0, 5),
        filters: mergedFilters
      };

      if (newRecommendations.length === 0) {
        responseMessage.content += '\nWe\'ve shown you all available matches. Would you like to explore other similar options like hybrid or indica edibles?';
      }

      setChatHistory(prev => [...prev, responseMessage]);
      return;
    }

    if (typeof msg !== 'string' || msg.trim() === '' || msg === lastProcessedMessage.current) return;

    lastProcessedMessage.current = msg;
    setTextInput('');
    setCurrentSpeech('');

    const userMessageId = Date.now();
    setChatHistory(prev => [...prev, {
      type: 'user',
      content: msg.replace(/\n/g, ' ').trim(),
      id: userMessageId
    }]);

    const loadingId = Date.now() + 1;
    setChatHistory(prev => [...prev, {
      type: 'budtender',
      content: (
        <div className="flex items-center space-x-2">
          <span className="animate-pulse">VirtualBudtender is thinking</span>
          <LoadingAnimation />
        </div>
      ),
      id: loadingId,
      isThinking: true
    }]);

    setIsLoading(true);

    try {
      const conversationHistoryForAPI = chatHistory
        .filter(message => !message.isThinking)
        .map(message => ({
          role: message.type === 'user' ? 'user' : 'assistant',
          content: typeof message.content === 'string' ? message.content : 'Loading...'
        }));

      const response = await axios.post('http://localhost:5001/api/chat', {
        message: msg,
        conversationHistory: conversationHistoryForAPI,
        userId
      });

      let { greeting, products, followUpQuestion, recommendations, filters } = response.data;

      if ((!products || !products.length) && recommendations?.length) {
        products = recommendations;
      }

      if (filters) {
        lastUsedFiltersRef.current = filters;
      }

      let formattedContent = greeting || '';

      if (products?.length) {
        formattedContent += '\n\nProducts:';
        products.forEach(product => {
          formattedContent += `\n• ${product.name}`;
          formattedContent += `\n  Size: ${product.size}`;
          formattedContent += `\n  THC: ${product.thc}`;
          if (product.cbd !== 'N/A') {
            formattedContent += `\n  CBD: ${product.cbd}`;
          }
          formattedContent += '\n';
        });
      }

      if (followUpQuestion) {
        formattedContent += `\n${followUpQuestion}`;
      }

      setChatHistory(prev => {
        const withoutThinking = prev.filter(m => m.id !== loadingId);
        const shownProductIds = new Set();
        prev.forEach(m => m.recommendations?.forEach(r => shownProductIds.add(r.CatalogItemId)));
        const newRecommendations = recommendations.filter(r => !shownProductIds.has(r.CatalogItemId));

        const responseMessage = {
          type: 'budtender',
          content: formattedContent.trim(),
          id: Date.now(),
          recommendations: newRecommendations.slice(0, 5),
          filters: filters || lastUsedFiltersRef.current
        };

        if (inputMode === 'voice' && !isMuted) {
          setTimeout(() => speakResponse(formattedContent.trim(), responseMessage.id), TIMING.MESSAGE_DELAY);
        }

        return [...withoutThinking, responseMessage];
      });
    } catch (error) {
      console.error('Error in chat request:', error);
      setChatHistory(prev => {
        const withoutThinking = prev.filter(m => m.id !== loadingId);
        return [...withoutThinking, {
          type: 'budtender',
          content: 'I apologize, but I encountered a technical issue. Could you please try your request again?',
          id: Date.now()
        }];
      });
    } finally {
      setIsLoading(false);
    }
  }, [chatHistory, inputMode, isMuted, userId]);
  // Product handling functions
  const handleProductSelect = useCallback(async (product) => {
    try {
      const formattedDetails = `
${product.Name}
Size: ${product.equivalentTo}
THC: ${product.thcMin}-${product.thcMax}%
${product.cbdMin ? `CBD: ${product.cbdMin}-${product.cbdMax}%\n` : ''}
${product.description || 'No description available.'}

Inventory: ${product.inventory} units
      `.trim();
      
      setChatHistory(prev => [...prev, {
        type: 'budtender',
        content: formattedDetails,
        id: Date.now(),
        product: product
      }]);

      if (inputMode === 'voice' && !isMuted) {
        speakResponse(formattedDetails, Date.now());
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
    }
  }, [inputMode, isMuted]);

  // Product feedback handling
  const handleProductFeedback = async (productId, isLike) => {
    try {
      await axios.post('http://localhost:5001/api/product-feedback', {
        userId,
        productId,
        feedback: isLike ? 'like' : 'dislike'
      });

      setChatHistory(prev => prev.map(msg => {
        if (msg.recommendations) {
          return {
            ...msg,
            recommendations: msg.recommendations.map(rec => {
              if (rec.CatalogItemId === productId) {
                return {
                  ...rec,
                  userFeedback: isLike ? 'like' : 'dislike'
                };
              }
              return rec;
            })
          };
        }
        return msg;
      }));
    } catch (error) {
      console.error('Error sending product feedback:', error);
    }
  };

  // Speech handling functions
  const speakResponse = useCallback((text, id) => {
    if (isMuted || !speechManagerRef.current) return;
    
    setPlayingAudioId(id);
    
    if (isRecording) {
      recognition.current?.stop();
      setIsRecording(false);
    }

    speechManagerRef.current.speak(
      text,
      () => setPlayingAudioId(id),
      () => setPlayingAudioId(null),
      () => {
        console.error('Error speaking response');
        setPlayingAudioId(null);
      }
    );
  }, [isMuted, isRecording]);

  const togglePlayback = useCallback((text, id) => {
    if (!speechManagerRef.current) return;

    if (playingAudioId === id && isPlaying) {
      speechManagerRef.current.pause();
    } else if (playingAudioId === id && !isPlaying) {
      speechManagerRef.current.resume();
    } else {
      if (playingAudioId) {
        speechManagerRef.current.stop();
      }
      speakResponse(text, id);
    }
  }, [playingAudioId, isPlaying, speakResponse]);

  // Speech recognition functions
  const initializeSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      setIsSpeechSupported(false);
      return;
    }

    recognition.current = new window.webkitSpeechRecognition();
    recognition.current.continuous = true;
    recognition.current.interimResults = true;
    recognition.current.lang = VOICE_OPTIONS.DEFAULT;

    recognition.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setCurrentSpeech(transcript);
    };

    recognition.current.onend = () => {
      setIsRecording(false);
    };

    recognition.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };
  }, []);

  const toggleRecording = useCallback(() => {
    if (!recognition.current) {
      initializeSpeechRecognition();
    }

    if (!recognition.current) {
      console.error('Speech recognition is not supported in this browser');
      return;
    }

    if (speechManagerRef.current) {
      speechManagerRef.current.stop();
    }

    try {
      if (isRecording) {
        recognition.current.stop();
        if (currentSpeech.trim()) {
          handleSubmit(currentSpeech);
          setCurrentSpeech('');
        }
      } else {
        setCurrentSpeech('');
        recognition.current.start();
      }
      setIsRecording(!isRecording);
    } catch (error) {
      console.error('Speech recognition error:', error);
      setIsRecording(false);
      setCurrentSpeech('');
    }
  }, [isRecording, currentSpeech, handleSubmit, initializeSpeechRecognition]);

  // UI Event Handlers
  const handlePreferenceSelect = useCallback((preference) => {
    setInputMode(preference);
    setShowPreferenceModal(false);
    
    const initialMessage = {
      type: 'budtender',
      content: "Welcome to Runway Pot! I'm your Virtual Budtender. What type of product are you interested in today?",
      id: Date.now(),
      showCategories: true
    };

    setChatHistory([initialMessage]);
    
    if (preference === 'voice' && !isMuted) {
      setTimeout(() => {
        speakResponse(initialMessage.content, initialMessage.id);
      }, TIMING.MESSAGE_DELAY);
    }
  }, [isMuted, speakResponse]);

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim() && !isLoading) {
      handleSubmit(textInput);
    }
  };

  const resetConversation = useCallback(() => {
    if (speechManagerRef.current) {
      speechManagerRef.current.stop();
    }
    
    if (recognition.current && isRecording) {
      recognition.current.stop();
    }

    const initialMessage = {
      type: 'budtender',
      content: "Welcome to Runway Pot! I'm your Virtual Budtender. What type of product are you interested in today?",
      id: Date.now(),
      showCategories: true
    };
    
    setChatHistory([initialMessage]);
    setCurrentSpeech('');
    setTextInput('');
    setIsLoading(false);
    setIsRecording(false);
    setPlayingAudioId(null);
    
    if (inputMode === 'voice' && !isMuted) {
      setTimeout(() => {
        speakResponse(initialMessage.content, initialMessage.id);
      }, TIMING.MESSAGE_DELAY);
    }
  }, [inputMode, isMuted, isRecording, speakResponse]);
  // Render Component
  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {showPreferenceModal && <PreferenceModal onSelect={handlePreferenceSelect} />}
      
      {/* Split Header */}
      <div className="flex w-full">
        {/* Black section for centered logo */}
        <div className="w-1/3 bg-black py-4 flex items-center justify-center">
          <div>
            <img 
              src="/Runway-Pot-Cannabis.png" 
              alt="Runway Pot Cannabis Logo" 
              className="h-16 w-auto"
            />
          </div>
        </div>

        {/* Yellow section for controls */}
        <div className="w-2/3 bg-[#f0b442]">
          <div className="flex flex-col">
            {/* Title and Controls */}
            <div className="p-6 flex justify-between items-center">
              <div>
                <div className="text-black font-semibold text-sm">RUNWAY POTPILOT</div>
                <h2 className="text-2xl font-bold text-black">How can I assist you today?</h2>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setInputMode('text')}
                  className={`px-4 py-2 rounded-lg transition duration-300 ${
                    inputMode === 'text' ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  Text
                </button>
                <button
                  onClick={() => setInputMode('voice')}
                  className={`px-4 py-2 rounded-lg transition duration-300 ${
                    inputMode === 'voice' ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  Voice
                </button>
                <button
                  onClick={resetConversation}
                  className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition duration-300"
                >
                  <RefreshCw size={20} />
                </button>
                <button
                  onClick={() => {
                    if (speechManagerRef.current) {
                      speechManagerRef.current.stop();
                    }
                    setIsMuted(!isMuted);
                  }}
                  className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition duration-300"
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>
            </div>
            
            {/* Divider Line */}
            <div className="h-px bg-black/10" />
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex h-[calc(100vh-theme(spacing.24))] w-full">
        {/* Image and Chat Container */}
        <div className="w-full flex h-full">
          {/* Budtender Image Section */}
          <div className="hidden md:block md:w-1/3 bg-black relative">
            <div className="h-full sticky top-0">
              <img 
                src="/Budtender.webp" 
                alt="Virtual Budtender" 
                className="w-full h-full object-cover"
              />
              {isRecording && (
                <div className="absolute top-0 left-0 right-0 bottom-0 bg-red-500 bg-opacity-20 flex items-center justify-center">
                  <div className="animate-ping w-4 h-4 bg-red-600 rounded-full"></div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Section */}
          <div className="w-full md:w-2/3 flex flex-col bg-gradient-to-br from-[#f0b442] to-[#fcaf17]">
            {/* Messages - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-4">
                {chatHistory.map((msg) => (
                  <Message
                    key={msg.id}
                    message={msg}
                    isUser={msg.type === 'user'}
                    onPlayback={togglePlayback}
                    isPlaying={isPlaying}
                    playingAudioId={playingAudioId}
                    isMuted={isMuted}
                    recommendations={msg.recommendations}
                    onProductSelect={handleProductSelect}
                    onLike={(productId) => handleProductFeedback(productId, true)}
                    onDislike={(productId) => handleProductFeedback(productId, false)}
                    onCategorySelect={handleSubmit}
                  />
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input Section */}
            <div className="border-t border-black/10 p-6 bg-[#fcaf17]">
              {inputMode === 'text' ? (
                <form onSubmit={handleTextSubmit} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-grow bg-white rounded-lg p-2 text-black min-h-[40px]"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || !textInput.trim()}
                  >
                    Send
                  </button>
                </form>
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="flex-grow bg-white rounded-lg p-2 text-black min-h-[40px]">
                    {!isSpeechSupported ? (
                      "Speech recognition is not supported in your browser. Please use Chrome or Edge."
                    ) : (
                      currentSpeech || (isRecording ? "Listening..." : "Click the microphone to start speaking...")
                    )}
                  </div>
                  {isSpeechSupported && (
                    <button
                      onClick={toggleRecording}
                      className={`w-12 h-12 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#fcaf17] focus:ring-opacity-75 transition-all duration-300 ${
                        isRecording 
                          ? 'bg-red-500 animate-pulse' 
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                      disabled={isLoading}
                    >
                      <Mic size={24} className="text-white" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualBudtender;