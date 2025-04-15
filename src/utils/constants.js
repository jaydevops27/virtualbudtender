// constants.js - Application constants
export const API_ENDPOINTS = {
    CHAT: '/api/chat',
    PRODUCT_FEEDBACK: '/api/product-feedback',
    SPEECH_SYNTHESIS: '/api/synthesize-speech',
    SPEECH_TO_TEXT: '/api/speech-to-text'
  };
  
  export const TIMING_CONSTANTS = {
    THINKING_DELAY: 1500,
    MESSAGE_DELAY: 500,
    TYPING_DELAY: 300,
    ANIMATION_DURATION: 300
  };
  
  export const UI_CONSTANTS = {
    MAX_PRODUCTS_DISPLAY: 5,
    MAX_MESSAGE_LENGTH: 500,
    MIN_SEARCH_LENGTH: 3
  };
  
  export const STORAGE_KEYS = {
    USER_PREFERENCES: 'userPreferences',
    CHAT_HISTORY: 'chatHistory',
    USER_ID: 'userId'
  };
  
  export const ERROR_MESSAGES = {
    SPEECH_NOT_SUPPORTED: "Speech recognition is not supported in your browser. Please use Chrome or Edge.",
    NETWORK_ERROR: "There seems to be a network issue. Please check your connection.",
    GENERAL_ERROR: "Something went wrong. Please try again.",
    PRODUCT_ERROR: "Unable to fetch product details. Please try again."
  };