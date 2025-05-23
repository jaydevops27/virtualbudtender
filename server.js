const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
require('dotenv').config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const polly = new AWS.Polly();
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Constants
const MAX_PRODUCTS = 5;
const MIN_INVENTORY_THRESHOLD = 5;
const CACHE_TTL = 3600; // 1 hour

// Product Categories and Types
const PRODUCT_CATEGORIES = {
  FLOWER: 'flower',
  PRE_ROLL: 'pre-roll',
  VAPE: 'vape',
  EDIBLE: 'edible',
  CONCENTRATE: 'concentrate',
  TINCTURE: 'tincture'
};

const EXPERIENCE_LEVELS = {
  NOVICE: 'novice',
  INTERMEDIATE: 'intermediate',
  EXPERIENCED: 'experienced'
};

const THC_RANGES = {
  [EXPERIENCE_LEVELS.NOVICE]: { min: 0, max: 15, ideal: 10 },
  [EXPERIENCE_LEVELS.INTERMEDIATE]: { min: 15, max: 25, ideal: 20 },
  [EXPERIENCE_LEVELS.EXPERIENCED]: { min: 20, max: 35, ideal: 25 }
};

// Add system prompt
const systemPrompt = `You are an expert virtual budtender for Runway Pot with deep knowledge of cannabis products. Your role is to provide personalized recommendations while maintaining a professional, empathetic, and educational approach.

Key Responsibilities:
1. Customer Understanding
- Ask focused questions about customer preferences, experience level, and desired effects
- Consider medical vs recreational use when appropriate
- Pay attention to customer's tolerance level and previous experiences
- Remember customer preferences throughout the conversation

2. Product Knowledge
- Explain THC/CBD ratios and their effects
- Match products to customer's desired experience (relaxation, creativity, pain relief, etc.)
- Consider consumption methods (smoking, vaping, edibles) based on customer preference
- Factor in onset time and duration of effects
- Provide specific details about product characteristics

3. Personalized Recommendations
- Start with lower THC products for newcomers (15% or less)
- Suggest specific strains based on reported effects
- Consider time of day and intended use
- Factor in customer's previous feedback
- Adjust recommendations based on customer responses

4. Safety and Education
- Provide clear dosage guidance, especially for edibles
- Explain potential effects and duration
- Mention possible side effects when relevant
- Encourage responsible consumption
- Provide harm reduction tips

5. Conversational Intelligence
- Remember and reference previous interactions in the conversation
- Follow up on customer feedback about suggested products
- Provide alternative suggestions if customer is unsatisfied
- Ask clarifying questions when needed
- Maintain a friendly, professional tone

When the user clearly describes their need, also provide this structured JSON:
{
  "category": "edible",
  "effect": "relaxation",
  "experienceLevel": "beginner"
}

Remember to:
- Be direct and clear in your recommendations
- Use simple language to explain complex concepts
- Stay within legal and ethical boundaries
- Maintain a supportive and non-judgmental tone
- Focus on education and harm reduction`;

// Response templates
const RESPONSE_TEMPLATES = {
  NO_STOCK: (category) => `I apologize, but we currently don't have any ${category} products in stock that match your criteria. Would you like to explore alternative options?`,
  
  LOW_STOCK: (product) => `Please note that ${product.Name} is running low on stock (${product.inventory} units remaining). You may want to consider alternative options as well.`,
  
  NEW_USER_EDUCATION: {
    THC: "For new users, we recommend starting with products that have lower THC content (10-15%) to ensure a comfortable experience. THC is the main psychoactive component in cannabis.",
    
    CBD: "CBD is non-psychoactive and can help balance the effects of THC. For beginners, products with both THC and CBD can provide a more gentle experience.",
    
    CONSUMPTION: {
      SMOKING: "When smoking cannabis, start with a small amount (one or two puffs) and wait 10-15 minutes to assess the effects before consuming more.",
      EDIBLES: "Edibles can take 30-90 minutes to take effect and last longer. Start with a low dose (2.5-5mg THC) and wait at least 2 hours before consuming more.",
      VAPING: "Vaping can provide more immediate effects than edibles but may be gentler than smoking. Start with a small puff and wait 5-10 minutes."
    }
  },
  
  RECOMMENDATIONS_INTRO: (experienceLevel) => {
    const intros = {
      [EXPERIENCE_LEVELS.NOVICE]: "As a new user, I've selected some gentle products with lower THC content to ensure a comfortable experience:",
      [EXPERIENCE_LEVELS.INTERMEDIATE]: "Based on your experience level, here are some balanced options:",
      [EXPERIENCE_LEVELS.EXPERIENCED]: "Given your experience, here are some higher-potency options:"
    };
    return intros[experienceLevel] || "Here are some products that match your preferences:";
  }
};

// Enhanced user context tracking with session management
class UserSessionManager {
  constructor() {
    this.sessions = new Map();
    this.lastCleanup = Date.now();
    this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
  }

  createSession(userId) {
    const session = {
      userId,
      preferences: {},
      conversationHistory: [],
      lastActive: Date.now(),
      suggestedProducts: new Set(),
      recentQueries: []
    };
    this.sessions.set(userId, session);
    return session;
  }

  getSession(userId) {
    this.cleanup();
    let session = this.sessions.get(userId);
    if (!session) {
      session = this.createSession(userId);
    }
    session.lastActive = Date.now();
    return session;
  }

  updateSession(userId, updates) {
    const session = this.getSession(userId);
    Object.assign(session, updates);
    session.lastActive = Date.now();
    this.sessions.set(userId, session);
  }

  cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup > this.cleanupInterval) {
      for (const [userId, session] of this.sessions.entries()) {
        if (now - session.lastActive > this.cleanupInterval) {
          this.sessions.delete(userId);
        }
      }
      this.lastCleanup = now;
    }
  }
}

const sessionManager = new UserSessionManager();
// Product Catalog Management
class ProductCatalog {
  constructor() {
    this.products = new Map();
    this.categoryIndex = new Map();
    this.strainIndex = new Map();
    this.effectsIndex = new Map();
    this.initialized = false;
  }

  async initialize() {
    try {
      const rawData = fs.readFileSync(path.join(__dirname, 'cova_full_catalog.json'), 'utf8');
      const products = JSON.parse(rawData);
      
      // Process and index each product
      products.forEach(product => {
        if (this.validateProduct(product)) {
          this.addProduct(product);
        }
      });

      this.initialized = true;
      console.log(`Successfully loaded product catalog. Total products: ${this.products.size}`);
      return true;
    } catch (error) {
      console.error('Error initializing product catalog:', error);
      throw error;
    }
  }

  validateProduct(product) {
    // Basic validation
    if (!product.CatalogItemId || !product.Name || !product.CanonicalClassification) {
      return false;
    }
  
    // Normalize and validate fields
    product.inventory = Number(product.inventory) || 0;
    product.Price = Number(product.Price) || 0;
    product.thcMin = Number(product.thcMin) || 0;
    product.thcMax = Number(product.thcMax) || 0;
    product.cbdMin = Number(product.cbdMin) || 0;
    product.cbdMax = Number(product.cbdMax) || 0;
    
    // Ensure photoUrl is available
    product.photoUrl = product.photoUrl || null;
  
    // Add computed fields
    product.isActive = true;
    product.pricePerGram = this.calculatePricePerGram(product);
    product.lastUpdated = new Date().toISOString();
    
    return true;
  }

  addProduct(product) {
    // Add to main catalog
    this.products.set(product.CatalogItemId, product);

    // Index by category
    const category = product.CanonicalClassification.Name.toLowerCase();
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, new Set());
    }
    this.categoryIndex.get(category).add(product.CatalogItemId);

    // Index by strain
    if (product.strain) {
      const strain = product.strain.toLowerCase();
      if (!this.strainIndex.has(strain)) {
        this.strainIndex.set(strain, new Set());
      }
      this.strainIndex.get(strain).add(product.CatalogItemId);
    }

    // Index by effects
    if (product.effects) {
      product.effects.forEach(effect => {
        const effectKey = effect.toLowerCase();
        if (!this.effectsIndex.has(effectKey)) {
          this.effectsIndex.set(effectKey, new Set());
        }
        this.effectsIndex.get(effectKey).add(product.CatalogItemId);
      });
    }
  }

  calculatePricePerGram(product) {
    if (!product.Price || !product.equivalentTo) return null;
    const weight = parseFloat(product.equivalentTo);
    return weight ? product.Price / weight : null;
  }

  getProduct(productId) {
    return this.products.get(productId);
  }

  getAvailableProducts() {
    return Array.from(this.products.values())
      .filter(product => product.isActive && product.inventory > 0);
  }

  getProductsByCategory(category, minInventory = 1) {
    const productIds = this.categoryIndex.get(category.toLowerCase());
    if (!productIds) return [];
    
    return Array.from(productIds)
      .map(id => this.getProduct(id))
      .filter(product => 
        product && 
        product.isActive && 
        product.inventory >= minInventory
      );
  }

  getProductsByEffects(effects, experienceLevel) {
    const matchingProducts = new Set();
    
    effects.forEach(effect => {
      const productIds = this.effectsIndex.get(effect.toLowerCase());
      if (productIds) {
        productIds.forEach(id => matchingProducts.add(id));
      }
    });

    return Array.from(matchingProducts)
      .map(id => this.getProduct(id))
      .filter(product => {
        if (!product || !product.isActive || product.inventory <= 0) return false;
        
        // Match THC level to experience
        const thcRange = THC_RANGES[experienceLevel];
        if (thcRange && product.thcMax) {
          return product.thcMax >= thcRange.min && product.thcMax <= thcRange.max;
        }
        return true;
      });
  }

  searchProducts(criteria) {
    const {
      category,
      strain,
      effects = [],
      experienceLevel = EXPERIENCE_LEVELS.INTERMEDIATE,
      priceRange,
      minInventory = 1,
      excludeIds = new Set()
    } = criteria;

    let products = this.getAvailableProducts();

    // Apply filters
    products = products.filter(product => {
      // Exclude already suggested products
      if (excludeIds.has(product.CatalogItemId)) return false;

      // Category filter
      if (category && !product.CanonicalClassification.Name.toLowerCase().includes(category.toLowerCase())) {
        return false;
      }

      // Strain filter
      if (strain && product.strain && !product.strain.toLowerCase().includes(strain.toLowerCase())) {
        return false;
      }

      // THC range filter based on experience level
      if (experienceLevel && product.thcMax) {
        const range = THC_RANGES[experienceLevel];
        if (range && (product.thcMax < range.min || product.thcMax > range.max)) {
          return false;
        }
      }

      // Inventory threshold
      if (product.inventory < minInventory) return false;

      // Price range filter
      if (priceRange && product.pricePerGram) {
        if (priceRange === 'low' && product.pricePerGram >= 10) return false;
        if (priceRange === 'high' && product.pricePerGram <= 15) return false;
      }

      return true;
    });

    // Score and sort products
    products = this.scoreProducts(products, criteria);

    return products;
  }

  scoreProducts(products, criteria) {
    const {
      effects = [],
      experienceLevel,
      priceRange
    } = criteria;

    return products.map(product => {
      let score = 0;

      // Base score for matching effects
      if (effects.length > 0 && product.effects) {
        const matchedEffects = effects.filter(effect => 
          product.effects.includes(effect)
        );
        score += matchedEffects.length * 5;
      }

      // Score for THC level match
      if (experienceLevel && product.thcMax) {
        const range = THC_RANGES[experienceLevel];
        if (range) {
          const idealDiff = Math.abs(product.thcMax - range.ideal);
          score += Math.max(0, 10 - idealDiff);
        }
      }

      // Inventory bonus
      score += Math.min(product.inventory / 10, 3);

      // Price match bonus
      if (priceRange && product.pricePerGram) {
        if (priceRange === 'low' && product.pricePerGram < 10) score += 3;
        if (priceRange === 'high' && product.pricePerGram > 15) score += 3;
      }

      return {
        ...product,
        score,
        matchDetails: this.generateMatchDetails(product, criteria)
      };
    }).sort((a, b) => b.score - a.score);
  }

  generateMatchDetails(product, criteria) {
    const details = [];
    const { experienceLevel, effects = [] } = criteria;

    // THC level match
    if (experienceLevel && product.thcMax) {
      const range = THC_RANGES[experienceLevel];
      if (range) {
        details.push(`THC content (${product.thcMax}%) suitable for ${experienceLevel} users`);
      }
    }

    // Effects match
    if (effects.length > 0 && product.effects) {
      const matchedEffects = effects.filter(effect => 
        product.effects.includes(effect)
      );
      if (matchedEffects.length > 0) {
        details.push(`Provides desired effects: ${matchedEffects.join(', ')}`);
      }
    }

    // Inventory status
    if (product.inventory <= MIN_INVENTORY_THRESHOLD) {
      details.push(`Limited stock: ${product.inventory} units remaining`);
    }

    return details;
  }
}

const productCatalog = new ProductCatalog();
// Chat Manager Class
class ChatManager {
  constructor() {
    this.responseTemplates = RESPONSE_TEMPLATES;
    this.activeChats = new Map();
  }

  async handleUserMessage(message, conversationHistory, userId) {
    try {
      const session = sessionManager.getSession(userId);
      const messageType = this.analyzeMessageType(message);
      const queryContext = this.analyzeUserQuery(message, session);

      let responseData = {
        greeting: "",
        products: [],
        followUpQuestion: "",
        recommendations: [],
        educationalContent: null
      };

      switch (messageType) {
        case 'product_query':
          responseData = await this.handleProductQuery(queryContext, session);
          break;
        case 'more_options':
          responseData = await this.handleMoreOptions(session);
          break;
        case 'product_details':
          responseData = await this.handleProductDetails(message, session);
          break;
        default:
          responseData = await this.generateConversationalResponse(message, conversationHistory, session);
      }

      // Update session with conversation history
      this.updateSessionHistory(session, message, responseData);
      return responseData;
    } catch (error) {
      console.error('Error handling message:', error);
      throw error;
    }
  }

  analyzeMessageType(message) {
    const productRegex = /product|strain|thc|cbd|indica|sativa|hybrid|flower|pre-roll|cartridge|edible/i;
    const moreOptionsRegex = /more|other|alternative|different|show more|next/i;
    const detailsRegex = /tell me more|details|about|describe|explain/i;

    if (productRegex.test(message)) return 'product_query';
    if (moreOptionsRegex.test(message)) return 'more_options';
    if (detailsRegex.test(message)) return 'product_details';
    return 'conversation';
  }

  analyzeUserQuery(message, session) {
    const queryLower = message.toLowerCase();
    const analysis = {
      categories: this.extractCategories(queryLower),
      strains: this.extractStrains(queryLower),
      effects: this.extractEffects(queryLower),
      experienceLevel: this.determineExperienceLevel(queryLower, session),
      priceRange: this.determinePriceRange(queryLower),
      timeOfDay: this.determineTimeOfDay(queryLower),
      medicalUse: this.checkMedicalUse(queryLower),
      isNewUser: this.isNewUser(queryLower, session)
    };

    return analysis;
  }
  
  determinePriceRange(query) {
    if (query.match(/cheap|affordable|budget|deal|low.?price/)) {
      return 'low';
    } else if (query.match(/premium|luxury|top.?shelf|high.?end|expensive/)) {
      return 'high';
    } else if (query.match(/mid|medium|moderate|average/)) {
      return 'medium';
    }
    return null;
  }

  determineTimeOfDay(query) {
    if (query.match(/morning|day|afternoon/)) {
      return 'day';
    } else if (query.match(/night|evening|sleep|bed/)) {
      return 'night';
    }
    return null;
  }

  checkMedicalUse(query) {
    return query.match(/medical|pain|anxiety|stress|relief|symptom|condition/) !== null;
  }

  isNewUser(query, session) {
    return query.match(/new|first.?time|beginner|never|start/) !== null || 
           session.preferences.experienceLevel === EXPERIENCE_LEVELS.NOVICE;
  }

  extractCategories(query) {
    const categoryMappings = {
      [PRODUCT_CATEGORIES.FLOWER]: ['flower', 'bud', 'herb'],
      [PRODUCT_CATEGORIES.PRE_ROLL]: ['pre-roll', 'joint', 'roll'],
      [PRODUCT_CATEGORIES.VAPE]: ['vape', 'cartridge', 'pen'],
      [PRODUCT_CATEGORIES.EDIBLE]: ['edible', 'gummy', 'chocolate'],
      [PRODUCT_CATEGORIES.CONCENTRATE]: ['concentrate', 'dab', 'wax', 'shatter'],
      [PRODUCT_CATEGORIES.TINCTURE]: ['tincture', 'oil', 'drops']
    };

    return Object.entries(categoryMappings)
      .filter(([_, terms]) => terms.some(term => query.includes(term)))
      .map(([category]) => category);
  }

  extractStrains(query) {
    const strainMappings = {
      'indica': ['indica', 'in da couch', 'relaxing', 'sleep'],
      'sativa': ['sativa', 'energetic', 'uplifting', 'energy'],
      'hybrid': ['hybrid', 'balanced', 'mix']
    };

    return Object.entries(strainMappings)
      .filter(([_, terms]) => terms.some(term => query.includes(term)))
      .map(([strain]) => strain);
  }

  extractEffects(query) {
    const effectMappings = {
      'relaxation': ['relax', 'calm', 'peace', 'chill'],
      'sleep': ['sleep', 'insomnia', 'rest', 'bed'],
      'pain': ['pain', 'ache', 'relief', 'sore'],
      'anxiety': ['anxiety', 'stress', 'worried'],
      'energy': ['energy', 'focus', 'active', 'creative'],
      'mood': ['mood', 'happy', 'euphoric', 'uplift']
    };

    return Object.entries(effectMappings)
      .filter(([_, terms]) => terms.some(term => query.includes(term)))
      .map(([effect]) => effect);
  }

  determineExperienceLevel(query, session) {
    if (query.match(/new|first.?time|beginner|start/)) {
      return EXPERIENCE_LEVELS.NOVICE;
    } else if (query.match(/experienced|regular|high.?tolerance|daily/)) {
      return EXPERIENCE_LEVELS.EXPERIENCED;
    }
    return session.preferences.experienceLevel || EXPERIENCE_LEVELS.INTERMEDIATE;
  }

  async handleProductQuery(queryContext, session) {
    const searchCriteria = {
      category: queryContext.categories[0],
      strain: queryContext.strains[0],
      effects: queryContext.effects,
      experienceLevel: queryContext.experienceLevel,
      priceRange: queryContext.priceRange,
      excludeIds: session.suggestedProducts
    };
  
    const products = productCatalog.searchProducts(searchCriteria);
    
    if (products.length === 0) {
      return this.getNoProductsResponse(queryContext);
    }
  
    // Update session with suggested products
    products.forEach(p => session.suggestedProducts.add(p.CatalogItemId));
  
    // Format response with proper image URLs
    return this.formatProductResponse(products, queryContext, session);
  }

  formatProductResponse(products, queryContext, session) {
    const isNewUser = queryContext.isNewUser;
    const experienceLevel = queryContext.experienceLevel;

    let response = {
      greeting: this.responseTemplates.RECOMMENDATIONS_INTRO(experienceLevel),
      products: products.map(this.formatProductDetails),
      followUpQuestion: "Would you like more details about any of these products?",
      recommendations: products,
      educationalContent: null
    };

    // Add educational content for new users
    if (isNewUser) {
      response.educationalContent = this.getEducationalContent(queryContext);
    }

    // Add inventory warnings if necessary
    products.forEach(product => {
      if (product.inventory <= MIN_INVENTORY_THRESHOLD) {
        response.greeting += '\n' + this.responseTemplates.LOW_STOCK(product);
      }
    });

    return response;
  }

  formatProductDetails(product) {
    return {
      name: product.Name,
      size: product.equivalentTo,
      thc: product.thcMin && product.thcMax ? 
        `${product.thcMin}-${product.thcMax}%` : 'N/A',
      cbd: product.cbdMin && product.cbdMax ? 
        `${product.cbdMin}-${product.cbdMax}%` : 'N/A',
      price: `$${product.Price?.toFixed(2) || 'N/A'}`,
      inventory: product.inventory,
      description: product.description || "No description available.",
      photoUrl: product.photoUrl,  // Pass through the exact photoUrl from JSON
      matchDetails: product.matchDetails || [],
      strain: product.strain || 'Not specified',
      category: product.CanonicalClassification.Name,
      effects: product.effects || []
    };
  }

  getEducationalContent(queryContext) {
    const content = [];

    // Add THC/CBD education for new users
    content.push(this.responseTemplates.NEW_USER_EDUCATION.THC);
    content.push(this.responseTemplates.NEW_USER_EDUCATION.CBD);

    // Add consumption method guidance
    if (queryContext.categories.includes(PRODUCT_CATEGORIES.FLOWER) || 
        queryContext.categories.includes(PRODUCT_CATEGORIES.PRE_ROLL)) {
      content.push(this.responseTemplates.NEW_USER_EDUCATION.CONSUMPTION.SMOKING);
    } else if (queryContext.categories.includes(PRODUCT_CATEGORIES.EDIBLE)) {
      content.push(this.responseTemplates.NEW_USER_EDUCATION.CONSUMPTION.EDIBLES);
    } else if (queryContext.categories.includes(PRODUCT_CATEGORIES.VAPE)) {
      content.push(this.responseTemplates.NEW_USER_EDUCATION.CONSUMPTION.VAPING);
    }

    return content.join('\n\n');
  }

  async generateConversationalResponse(message, history, session) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return {
        greeting: completion.choices[0].message.content,
        products: [],
        followUpQuestion: "",
        recommendations: []
      };
    } catch (error) {
      console.error('Error generating chat response:', error);
      throw error;
    }
  }

  updateSessionHistory(session, message, response) {
    session.conversationHistory.push({
      type: 'user',
      content: message,
      timestamp: Date.now()
    });

    session.conversationHistory.push({
      type: 'assistant',
      content: response.greeting,
      timestamp: Date.now(),
      recommendations: response.products.map(p => p.name)
    });

    // Keep only last 10 messages
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }
  }
}

const chatManager = new ChatManager();
// Custom Error Classes
class APIError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'APIError';
  }
}

class ValidationError extends APIError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// Request Validators
const validators = {
  chatRequest: (body) => {
    const { message, conversationHistory, userId } = body;
    
    if (!message?.trim()) {
      throw new ValidationError('Message is required');
    }

    if (message.length > 500) {
      throw new ValidationError('Message exceeds maximum length of 500 characters');
    }

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    return {
      message: message.trim(),
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      userId
    };
  },

  speechRequest: (body) => {
    const { text, voiceId } = body;
    
    if (!text?.trim()) {
      throw new ValidationError('Text is required for speech synthesis');
    }

    if (text.length > 1000) {
      throw new ValidationError('Text exceeds maximum length of 1000 characters');
    }

    return {
      text: text.trim(),
      voiceId: voiceId || 'Joanna'
    };
  },

  preferencesRequest: (body) => {
    const { userId, preferences } = body;
    
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    if (!preferences || typeof preferences !== 'object') {
      throw new ValidationError('Valid preferences object is required');
    }

    return { userId, preferences };
  }
};

// API Rate Limiting
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
};

// API Endpoints
app.post('/api/chat', async (req, res, next) => {
  try {
    const startTime = Date.now();

    // Check for "See More Recommendations" request
    if (req.body.filters) {
      const { filters, userId } = req.body;

      if (!userId) {
        throw new Error("User ID is required for recommendation filtering.");
      }

      const excludeSet = new Set(filters.excludeProducts || []);
      const searchCriteria = {
        ...filters,
        excludeIds: excludeSet
      };

      const products = productCatalog.searchProducts(searchCriteria);

      const responseData = {
        greeting: `Here are some more recommendations for you:`,
        products: products,
        followUpQuestion: '',
        recommendations: products
      };

      const processingTime = Date.now() - startTime;
      console.log(`See more recommendations processed in ${processingTime}ms`);

      return res.json({
        ...responseData,
        processingTime,
        timestamp: new Date().toISOString()
      });
    }

    // Normal message flow
    const { message, conversationHistory, userId } = validators.chatRequest(req.body);

    console.log(`Processing chat request for user ${userId}:`, message);

    const responseData = await chatManager.handleUserMessage(
      message,
      conversationHistory,
      userId
    );

    const processingTime = Date.now() - startTime;
    console.log(`Chat response generated in ${processingTime}ms`);

    res.json({
      ...responseData,
      processingTime,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});


app.post('/api/synthesize-speech', async (req, res, next) => {
  try {
    const { text, voiceId } = validators.speechRequest(req.body);
    console.log(`Speech synthesis request: "${text}", Voice: ${voiceId}`);

    const params = {
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: voiceId,
      Engine: 'neural',
      TextType: 'text'
    };

    const data = await polly.synthesizeSpeech(params).promise();
    console.log('Speech synthesis completed, size:', data.AudioStream.length);

    // Set appropriate headers
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': data.AudioStream.length,
      'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
    });

    res.send(data.AudioStream);
  } catch (error) {
    next(error);
  }
});

app.post('/api/speech-to-text', upload.single('audio'), async (req, res, next) => {
  let inputPath = null;
  let outputPath = null;

  try {
    if (!req.file) {
      throw new ValidationError('No audio file uploaded');
    }

    if (req.file.size > 10 * 1024 * 1024) {
      throw new ValidationError('Audio file exceeds maximum size of 10MB');
    }

    inputPath = req.file.path;
    outputPath = path.join('uploads', `${req.file.filename}.mp3`);

    // Convert audio to MP3
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioBitrate('128k')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('error', reject)
        .on('end', resolve)
        .save(outputPath);
    });

    // Transcribe audio
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(outputPath),
      model: "whisper-1",
      language: "en"
    });

    res.json({
      transcript: transcript.text,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  } finally {
    // Cleanup temporary files
    try {
      if (inputPath && fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      if (outputPath && fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }
  }
});

// User Preferences Endpoints
app.post('/api/preferences', (req, res, next) => {
  try {
    const { userId, preferences } = validators.preferencesRequest(req.body);
    const session = sessionManager.getSession(userId);
    
    // Merge new preferences with existing ones
    session.preferences = {
      ...session.preferences,
      ...preferences,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      message: 'Preferences updated successfully',
      preferences: session.preferences
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/preferences/:userId', (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const session = sessionManager.getSession(userId);
    res.json(session.preferences || {});
  } catch (error) {
    next(error);
  }
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    productCatalogSize: productCatalog.products.size,
    activeSessions: sessionManager.sessions.size
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);

  // Log detailed error information
  const errorLog = {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ip: req.ip,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  };

  console.error(JSON.stringify(errorLog, null, 2));

  // Send appropriate error response
  if (err instanceof APIError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message
      },
      status: err.status,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    },
    status: 500,
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found'
    },
    status: 404,
    timestamp: new Date().toISOString()
  });
});
// Environment validation function
function validateEnvironment() {
  const requiredEnvVars = [
    'PORT',
    'OPENAI_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

// Cleanup function for graceful shutdown
function cleanup() {
  console.log('Cleaning up resources...');
  
  // Clean up temp files
  const uploadsDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    fs.readdirSync(uploadsDir).forEach(file => {
      const filePath = path.join(uploadsDir, file);
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`Error deleting file ${filePath}:`, err);
      }
    });
  }

  // Save active sessions if needed
  const sessions = Array.from(sessionManager.sessions.entries());
  if (sessions.length > 0) {
    try {
      fs.writeFileSync(
        path.join(__dirname, 'sessions-backup.json'),
        JSON.stringify(sessions),
        'utf8'
      );
    } catch (err) {
      console.error('Error saving sessions:', err);
    }
  }
}

// Server state monitoring
class ServerStateMonitor {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastError = null;
  }

  incrementRequests() {
    this.requestCount++;
  }

  recordError(error) {
    this.errorCount++;
    this.lastError = {
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }

  getStats() {
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      lastError: this.lastError,
      memoryUsage: process.memoryUsage()
    };
  }
}

const serverMonitor = new ServerStateMonitor();

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  serverMonitor.incrementRequests();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
});

// Initialize uploads directory
function initializeUploads() {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
}

// Restore sessions from backup if exists
async function restoreSessions() {
  const backupFile = path.join(__dirname, 'sessions-backup.json');
  if (fs.existsSync(backupFile)) {
    try {
      const sessions = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      sessions.forEach(([userId, session]) => {
        sessionManager.sessions.set(userId, session);
      });
      console.log(`Restored ${sessions.length} sessions`);
      fs.unlinkSync(backupFile);
    } catch (err) {
      console.error('Error restoring sessions:', err);
    }
  }
}

// Server initialization
async function initializeServer() {
  console.log('Starting server initialization...');
  
  try {
    // Validate environment
    validateEnvironment();
    console.log('Environment validation successful');

    // Initialize directories
    initializeUploads();
    console.log('Uploads directory initialized');

    // Restore any saved sessions
    await restoreSessions();
    
    // Initialize product catalog
    await productCatalog.initialize();
    console.log('Product catalog initialized');

    // Create server
    const server = app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
      console.log('CORS enabled for origin:', corsOptions.origin);
    });

    // Handle shutdown signals
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, starting graceful shutdown...`);
        
        // Close server
        server.close(() => {
          console.log('HTTP server closed');
          cleanup();
          process.exit(0);
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
          console.error('Forced shutdown after timeout');
          process.exit(1);
        }, 10000);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      serverMonitor.recordError(error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      serverMonitor.recordError(reason);
    });

    // Add monitoring endpoint
    app.get('/api/monitor', (req, res) => {
      res.json(serverMonitor.getStats());
    });

    return server;
  } catch (error) {
    console.error('Server initialization failed:', error);
    process.exit(1);
  }
}

// Start the server
initializeServer().catch(error => {
  console.error('Fatal error during server startup:', error);
  process.exit(1);
});