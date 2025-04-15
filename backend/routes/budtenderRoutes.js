const express = require('express');
const { getOpenAIResponse } = require('../services/openaiService');

const router = express.Router();

router.post('/budtender', async (req, res) => {
  try {
    const { message } = req.body;
    console.log('Received message:', message);
    
    const response = await getOpenAIResponse(message);
    console.log('OpenAI response:', response);
    
    res.json({ response });
  } catch (error) {
    console.error('Error in budtender route:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.', details: error.message });
  }
});

module.exports = router;