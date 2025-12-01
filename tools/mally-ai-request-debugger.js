// mally-ai-request-debugger.js
// Save this file to your desktop and load it in the browser console when using Mally AI
// It will intercept requests to Claude and Firebase Functions to help diagnose issues

(function() {
    console.log('Mally AI Request Debugger loaded!');
    console.log('This utility will monitor requests to the Anthropic API and Firebase Functions');
    console.log('Look for "MALLY-DEBUG" in the console to find relevant logs');
    
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch to intercept API calls
    window.fetch = async function(url, options) {
        if (url && typeof url === 'string') {
            // Looking for Claude API calls or Firebase Functions
            const isClaudeRequest = url.includes('anthropic.com') || 
                                   url.includes('api.anthropic.com');
            
            const isFirebaseFunctionRequest = url.includes('cloudfunctions.net') || 
                                            url.includes('firebase.googleapis.com/v1beta/projects') ||
                                            url.includes('processAIRequest') ||
                                            url.includes('createCalendarEvent') ||
                                            url.includes('transcribeAudio');
            
            if (isClaudeRequest || isFirebaseFunctionRequest) {
                console.log(`MALLY-DEBUG: Intercepted ${isClaudeRequest ? 'Claude API' : 'Firebase Function'} request`);
                
                try {
                    // Clone the options to avoid modifying the original
                    const clonedOptions = options ? JSON.parse(JSON.stringify(options)) : {};
                    
                    // If there's a body, parse and log it
                    if (options && options.body) {
                        if (typeof options.body === 'string') {
                            try {
                                const parsedBody = JSON.parse(options.body);
                                console.log('MALLY-DEBUG: Request Body:', parsedBody);
                                
                                // Log the specific prompt or messages
                                if (parsedBody.prompt) {
                                    console.log('MALLY-DEBUG: Prompt:', parsedBody.prompt);
                                }
                                if (parsedBody.messages) {
                                    console.log('MALLY-DEBUG: Messages:', parsedBody.messages);
                                }
                            } catch (e) {
                                console.log('MALLY-DEBUG: Failed to parse request body:', options.body);
                            }
                        }
                    }
                    
                    // Make the original request
                    const response = await originalFetch(url, options);
                    
                    // Clone the response to avoid consuming it
                    const clonedResponse = response.clone();
                    
                    // Try to get the response JSON
                    try {
                        const responseData = await clonedResponse.json();
                        console.log('MALLY-DEBUG: Response:', responseData);
                        
                        // Special handling for Claude responses
                        if (isClaudeRequest && responseData.content && responseData.content[0]) {
                            console.log('MALLY-DEBUG: Claude Response Text:', responseData.content[0].text);
                            
                            // Try to extract JSON from Claude's response
                            extractJSON(responseData.content[0].text);
                        }
                        
                        // Special handling for Edge Function responses
                        if (isEdgeFunctionRequest) {
                            console.log('MALLY-DEBUG: Edge Function Success:', 
                                responseData.operationResult?.success ? 'YES' : 'NO');
                                
                            if (!responseData.operationResult?.success) {
                                console.error('MALLY-DEBUG: Operation Failed!', 
                                    responseData.operationResult?.error || 'No error details provided');
                            }
                        }
                    } catch (e) {
                        console.log('MALLY-DEBUG: Could not parse response as JSON');
                    }
                    
                    return response;
                } catch (error) {
                    console.error('MALLY-DEBUG: Error intercepting request:', error);
                    // Fall back to original fetch
                    return originalFetch(url, options);
                }
            }
        }
        
        // For all other requests, use the original fetch
        return originalFetch(url, options);
    };
    
    // Helper function to extract JSON from Claude's response
    function extractJSON(text) {
        try {
            // Pattern 1: Code block with json tag
            let match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (match && match[1]) {
                console.log('MALLY-DEBUG: Found JSON in code block with json tag:', match[1]);
                try {
                    console.log('MALLY-DEBUG: Parsed JSON:', JSON.parse(match[1]));
                    return;
                } catch (e) {
                    console.log('MALLY-DEBUG: Failed to parse JSON from code block');
                }
            }
            
            // Pattern 2: Code block without json tag
            match = text.match(/```\s*(\{[\s\S]*?\})\s*```/);
            if (match && match[1]) {
                console.log('MALLY-DEBUG: Found JSON in generic code block:', match[1]);
                try {
                    console.log('MALLY-DEBUG: Parsed JSON:', JSON.parse(match[1]));
                    return;
                } catch (e) {
                    console.log('MALLY-DEBUG: Failed to parse JSON from generic code block');
                }
            }
            
            // Pattern 3: XML-style tags
            match = text.match(/<calendar_operation>([\s\S]*?)<\/calendar_operation>/);
            if (match && match[1]) {
                console.log('MALLY-DEBUG: Found JSON in XML-style tags:', match[1]);
                try {
                    console.log('MALLY-DEBUG: Parsed JSON:', JSON.parse(match[1]));
                    return;
                } catch (e) {
                    console.log('MALLY-DEBUG: Failed to parse JSON from XML tags');
                }
            }
            
            // Pattern 4: Direct JSON
            match = text.match(/(\{[\s\S]*?"action"\s*:\s*"(create|edit|delete|query)"[\s\S]*?\})/);
            if (match && match[1]) {
                console.log('MALLY-DEBUG: Found direct JSON:', match[1]);
                try {
                    console.log('MALLY-DEBUG: Parsed JSON:', JSON.parse(match[1]));
                    return;
                } catch (e) {
                    console.log('MALLY-DEBUG: Failed to parse direct JSON');
                }
            }
            
            console.log('MALLY-DEBUG: No structured JSON found in Claude response');
        } catch (e) {
            console.error('MALLY-DEBUG: Error extracting JSON:', e);
        }
    }
    
    console.log('MALLY-DEBUG: Debugger ready. Ask Mally AI to create a calendar event to test.');
})();
