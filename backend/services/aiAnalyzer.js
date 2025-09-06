const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeResumeWithAI(resumeText) {
  console.log('=== AI ANALYZER SERVICE STARTED ===');
  
  if (!resumeText) {
    throw new Error('Resume text is required for analysis');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured');
  }

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
You are an expert technical recruiter and career coach. Analyze the following resume text.

CRITICAL INSTRUCTIONS:
1. Respond with ONLY a valid JSON object, no additional text, markdown, or formatting
2. Do not include any explanations, comments, or emojis
3. The JSON must have these exact keys and structure:
{
  "summary": "concise professional summary in 2-3 sentences",
  "strengths": ["strength1", "strength2", "strength3", "strength4"],
  "areasForImprovement": ["improvement1", "improvement2", "improvement3"],
  "overallScore": 85
}

Resume Text:
---
${resumeText.substring(0, 15000)}
---

IMPORTANT: Your response must be parseable by JSON.parse() with no additional processing.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Enhanced cleaning
    let cleanedText = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^[\s\S]*?(\{)/, '$1')
      .replace(/(\})[\s\S]*$/, '$1')
      .trim();

    // If cleaning failed, try to extract JSON
    if (!cleanedText.startsWith('{') || !cleanedText.endsWith('}')) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      } else {
        throw new Error('No JSON object found in response');
      }
    }

    const jsonResponse = JSON.parse(cleanedText);

    // Validation
    const requiredFields = ['summary', 'strengths', 'areasForImprovement', 'overallScore'];
    const missingFields = requiredFields.filter(field => !(field in jsonResponse));
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    return jsonResponse;
  } catch (error) {
    console.error('AI Analysis Error:', error.message);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

module.exports = { analyzeResumeWithAI };