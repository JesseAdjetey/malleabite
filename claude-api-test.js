// Claude API Key Validation Test
// Run this with: node claude-api-test.js

const ANTHROPIC_API_KEY = 'your-api-key-here'; // Replace with your actual key

async function testClaudeAPI() {
  console.log('Testing Claude API key...');
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Key is valid!');
      console.log('Response:', data.content[0].text);
      return true;
    } else {
      const error = await response.json();
      console.log('❌ API Key validation failed:');
      console.log('Status:', response.status);
      console.log('Error:', error);
      
      // Common error codes
      switch (response.status) {
        case 401:
          console.log('🔑 Invalid API key or authentication failed');
          break;
        case 403:
          console.log('🚫 API key valid but insufficient permissions');
          break;
        case 429:
          console.log('⏰ Rate limit exceeded - key is valid but you hit limits');
          break;
        case 400:
          console.log('📝 Bad request - check your request format');
          break;
        default:
          console.log('❓ Unknown error occurred');
      }
      return false;
    }
  } catch (error) {
    console.log('❌ Network error or API unavailable:');
    console.log(error.message);
    return false;
  }
}

// Run the test
testClaudeAPI();
