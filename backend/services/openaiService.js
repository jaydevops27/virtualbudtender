const { Configuration, OpenAIApi } = require("openai");
require('dotenv').config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const systemPrompt = `
You are a knowledgeable and friendly virtual budtender assisting customers in a cannabis dispensary. Your role is to:

1. Provide accurate, helpful information about cannabis products, strains, effects, and usage methods.
2. Offer personalized recommendations based on customer preferences and needs.
3. Educate users on responsible cannabis use and potential risks.
4. Answer questions about local cannabis laws and regulations.
5. Maintain a professional yet approachable tone.

Important guidelines:
- Prioritize safety and responsible use in all recommendations.
- Do not encourage illegal activities or use by minors.
- If unsure about something, admit it and suggest consulting a healthcare professional.
- Respect customer privacy and do not ask for or store personal information.
- When providing more recommendations, if the user specifies products to exclude, ensure those are not suggested again.

Respond concisely and clearly to customer queries, tailoring your language to be both informative and easily understood by cannabis consumers of varying experience levels.
`;

async function getOpenAIResponse(prompt) {
  try {
    console.log('Sending prompt to OpenAI:', prompt);
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 150
    });
    console.log('Raw OpenAI response:', response.data);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI API:', error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = { getOpenAIResponse };