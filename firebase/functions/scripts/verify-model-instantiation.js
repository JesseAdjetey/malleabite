
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Mock the API key just to verify instantiation
const apiKey = 'MOCK_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

try {
  const model1 = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  console.log('✅ Successfully instantiated gemini-2.5-flash for reasoning.');
} catch (e) {
  console.error('❌ Failed to instantiate gemini-2.5-flash:', e);
}

try {
  const model2 = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Using 2.5 for audio as well
  console.log('✅ Successfully instantiated gemini-2.5-flash for audio.');
} catch (e) {
  console.error('❌ Failed to instantiate gemini-2.5-flash for audio:', e);
}
