#!/bin/bash
# 🚀 Quick Deploy Script for Mally AI (Linux/Mac)

echo "🤖 Deploying Mally AI to Firebase..."
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found!"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI found"

# Check if logged in
echo ""
echo "Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please login to Firebase..."
    firebase login
    if [ $? -ne 0 ]; then
        echo "❌ Login failed!"
        exit 1
    fi
fi

echo "✅ Authenticated"

# Set Gemini API Key Secret
echo ""
echo "📝 Configuring Gemini API key..."
echo "Checking if GEMINI_API_KEY secret exists..."

if ! firebase functions:secrets:access GEMINI_API_KEY &> /dev/null; then
    echo "⚠️  GEMINI_API_KEY secret not found"
    echo ""
    echo "Please enter your Gemini API key:"
    echo "(Get it from: https://makersuite.google.com/app/apikey)"
    read -p "API Key: " apiKey
    
    if [ -z "$apiKey" ]; then
        echo "❌ No API key provided!"
        exit 1
    fi
    
    echo "Setting secret..."
    echo "$apiKey" | firebase functions:secrets:set GEMINI_API_KEY
    if [ $? -ne 0 ]; then
        echo "❌ Failed to set secret!"
        exit 1
    fi
    echo "✅ Secret configured"
else
    echo "✅ GEMINI_API_KEY secret already exists"
fi

# Build functions
echo ""
echo "🔨 Building Firebase Functions..."
cd firebase/functions
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    cd ../..
    exit 1
fi
cd ../..
echo "✅ Build successful"

# Deploy functions
echo ""
echo "🚀 Deploying to Firebase..."
firebase deploy --only functions

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "✅ Mally AI is now live with full intelligence!"
    echo ""
    echo "Test it with these commands:"
    echo "  • 'Schedule a meeting tomorrow at 2pm'"
    echo "  • 'Add buy groceries to my todos'"
    echo "  • 'Set an alarm for 8am every weekday'"
    echo ""
    echo "Monitor your usage at: https://aistudio.google.com/"
    echo ""
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Check the error messages above for details."
    exit 1
fi
