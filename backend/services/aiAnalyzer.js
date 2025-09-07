const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeResumeWithAI(resumeText) {
  console.log('=== AI ANALYZER SERVICE STARTED ===');

  if (!resumeText) throw new Error('Resume text is required for analysis');
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API key is not configured');

  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.1,
      topP: 0.1,
      topK: 1,
      maxOutputTokens: 2048,
    }
  });

  const prompt = `
You are an expert career coach. Analyze the following resume text.

CRITICAL INSTRUCTIONS:
1. Respond ONLY with a JSON object, no extra text, markdown, or emojis.
2. The JSON must have EXACT keys and structure:

{
  "summary": "concise professional summary in 2-3 sentences",
  "strengths": ["strength1", "strength2", "strength3", "strength4"],
  "suggestion": "one actionable suggestion for improvement",
  "overallScore": 80
}

Resume Text:
---
${resumeText.substring(0, 15000)}
---
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Cleaning response to JSON
    let cleanedText = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^[\s\S]*?(\{)/, '$1')
      .replace(/(\})[\s\S]*$/, '$1')
      .trim();

    if (!cleanedText.startsWith('{') || !cleanedText.endsWith('}')) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleanedText = jsonMatch[0];
      else throw new Error('No JSON object found in AI response');
    }

    const jsonResponse = JSON.parse(cleanedText);

    // Validation
    const requiredFields = ['summary', 'strengths', 'suggestion', 'overallScore'];
    const missingFields = requiredFields.filter(field => !(field in jsonResponse));
    if (missingFields.length > 0) throw new Error(`Missing required fields: ${missingFields.join(', ')}`);

    return jsonResponse;
  } catch (err) {
    console.error('AI Analysis Error:', err.message);
    throw new Error(`AI analysis failed: ${err.message}`);
  }
}

module.exports = { analyzeResumeWithAI };
