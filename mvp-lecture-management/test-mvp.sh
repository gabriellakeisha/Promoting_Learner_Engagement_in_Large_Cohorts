#!/bin/bash

echo "🧪 Testing MVP System (Fixed)"
echo ""

# Clean up old cookies
rm -f cookies.txt student-cookies.txt

# Step 1: Login as Lecturer
echo "1️⃣ Logging in as lecturer..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lecturer@qub.ac.uk",
    "password": "Test123!"
  }' \
  -c cookies.txt \
  -b cookies.txt

echo ""
sleep 2

# Check cookies file
echo "🔍 Checking cookies..."
cat cookies.txt | grep connect.sid
echo ""
echo "---"

# Step 2: Create Session
echo ""
echo "2️⃣ Creating lecture session..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "CSC3002 Lecture 5 - Database Design",
    "moduleCode": "CSC3002",
    "description": "Introduction to MongoDB"
  }' \
  -b cookies.txt \
  -c cookies.txt)

echo $SESSION_RESPONSE

# Check if session was created
if echo $SESSION_RESPONSE | grep -q "Authentication required"; then
    echo ""
    echo "❌ ERROR: Session creation failed - authentication issue"
    echo "Let me check the cookies file:"
    cat cookies.txt
    echo ""
    echo "Checking server session endpoint..."
    curl -s http://localhost:3000/api/auth/me -b cookies.txt
    exit 1
fi

# Extract the session ID and join code using Python
SESSION_ID=$(echo $SESSION_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['id'])" 2>/dev/null || echo "")
JOIN_CODE=$(echo $SESSION_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['joinCode'])" 2>/dev/null || echo "")

if [ -z "$SESSION_ID" ]; then
    echo "❌ Failed to extract session ID"
    exit 1
fi

echo ""
echo "✅ Session Created!"
echo "   Session ID: $SESSION_ID"
echo "   Join Code: $JOIN_CODE"
echo ""
sleep 2
echo "---"

# Step 3: Register Student
echo ""
echo "3️⃣ Registering student..."
STUDENT_EMAIL="alice_$(date +%s)@qub.ac.uk"  # Unique email
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$STUDENT_EMAIL\",
    \"password\": \"Student123!\",
    \"displayName\": \"Alice Anderson\",
    \"role\": \"student\"
  }"

echo ""
sleep 2
echo "---"

# Step 4: Student Login
echo ""
echo "4️⃣ Student logging in..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$STUDENT_EMAIL\",
    \"password\": \"Student123!\"
  }" \
  -c student-cookies.txt \
  -b student-cookies.txt

echo ""
sleep 2
echo "---"

# Step 5: Student Joins Session
echo ""
echo "5️⃣ Student joining session with code: $JOIN_CODE"
curl -X POST http://localhost:3000/api/sessions/join \
  -H "Content-Type: application/json" \
  -d "{
    \"joinCode\": \"$JOIN_CODE\"
  }" \
  -b student-cookies.txt \
  -c student-cookies.txt

echo ""
sleep 2
echo "---"

# Step 6: Send Messages
echo ""
echo "6️⃣ Sending messages..."

echo "   📝 Sending QUESTION..."
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"text\": \"What is the difference between SQL and NoSQL?\",
    \"type\": \"QUESTION\"
  }" \
  -b student-cookies.txt \
  -c student-cookies.txt

echo ""
sleep 1

echo "   💬 Sending COMMENT..."
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"text\": \"This example is really helpful!\",
    \"type\": \"COMMENT\"
  }" \
  -b student-cookies.txt \
  -c student-cookies.txt

echo ""
sleep 1

echo "   ❓ Sending CONFUSION..."
curl -X POST http://localhost:3000/api/messages/send \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"text\": \"I dont understand aggregation pipelines\",
    \"type\": \"CONFUSION\"
  }" \
  -b student-cookies.txt \
  -c student-cookies.txt

echo ""
sleep 2
echo "---"

# Step 7: Check Analytics
echo ""
echo "7️⃣ Checking lecturer analytics..."
curl -s http://localhost:3000/api/analytics/lecturer/$SESSION_ID \
  -b cookies.txt | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/analytics/lecturer/$SESSION_ID -b cookies.txt

echo ""
echo "---"

echo ""
echo "8️⃣ Checking student analytics..."
curl -s http://localhost:3000/api/analytics/student/$SESSION_ID \
  -b student-cookies.txt | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/analytics/student/$SESSION_ID -b student-cookies.txt

echo ""
echo ""
echo "✅ ALL TESTS COMPLETE!"
echo "📊 Session ID: $SESSION_ID"
echo "🔑 Join Code: $JOIN_CODE"
