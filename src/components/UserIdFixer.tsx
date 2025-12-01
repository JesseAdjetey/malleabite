import React, { useState } from 'react';
import { db } from '@/integrations/firebase/config';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext.unified';

const UserIdFixer: React.FC = () => {
  const [isFixing, setIsFixing] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const { user } = useAuth();

  const collectionsToFix = [
    'todos',
    'calendar_events', 
    'eisenhower_items',
    'reminders',
    'alarms',
    'ai_suggestions',
    'module_instances',
    'pomodoro_sessions'
  ];

  const fallbackFields = ['user_id', 'ownerId', 'senderId', 'recipientId'];

  const fixUserIds = async () => {
    if (!user) {
      setResults(['❌ No authenticated user found']);
      return;
    }

    setIsFixing(true);
    setResults(['🔧 Starting userId repair process...']);
    const newResults: string[] = ['🔧 Starting userId repair process...'];

    let totalFixed = 0;
    let totalErrors = 0;

    for (const collectionName of collectionsToFix) {
      newResults.push(`\n📂 Processing collection: ${collectionName}`);
      setResults([...newResults]);

      try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);

        if (snapshot.empty) {
          newResults.push(`   ⚪ Collection is empty`);
          setResults([...newResults]);
          continue;
        }

        newResults.push(`   📊 Found ${snapshot.size} documents`);
        setResults([...newResults]);

        let fixedInCollection = 0;
        const batch = writeBatch(db);
        let batchCount = 0;

        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();

          // Skip if userId already exists
          if (data.userId) {
            continue;
          }

          // Try to find userId from fallback fields, or use current user
          let inferredUserId = user.uid; // Default to current user

          for (const field of fallbackFields) {
            if (data[field]) {
              inferredUserId = data[field];
              break;
            }
          }

          newResults.push(`   🔄 Fixing document ${docSnapshot.id}: adding userId = ${inferredUserId}`);
          setResults([...newResults]);

          batch.update(doc(db, collectionName, docSnapshot.id), { userId: inferredUserId });
          batchCount++;
          fixedInCollection++;

          // Commit batch every 500 operations (Firestore limit)
          if (batchCount >= 500) {
            await batch.commit();
            newResults.push(`   💾 Committed batch of ${batchCount} updates`);
            setResults([...newResults]);
            batchCount = 0;
          }
        }

        // Commit remaining operations
        if (batchCount > 0) {
          await batch.commit();
          newResults.push(`   💾 Committed final batch of ${batchCount} updates`);
          setResults([...newResults]);
        }

        newResults.push(`   ✅ Fixed ${fixedInCollection} documents`);
        setResults([...newResults]);

        totalFixed += fixedInCollection;

      } catch (error) {
        const errorMsg = `   ❌ Error processing collection ${collectionName}: ${error}`;
        newResults.push(errorMsg);
        setResults([...newResults]);
        totalErrors++;
      }
    }

    newResults.push('\n🎯 Summary:');
    newResults.push(`   ✅ Total documents fixed: ${totalFixed}`);
    newResults.push(`   ❌ Total errors: ${totalErrors}`);

    if (totalFixed > 0) {
      newResults.push('\n🎉 Repair completed! Refresh the page to see if the data loads properly.');
    } else if (totalErrors === 0) {
      newResults.push('\n✨ All documents already have userId fields - no repairs needed!');
    } else {
      newResults.push('\n⚠️ Some documents could not be repaired. Check the logs above for details.');
    }

    setResults(newResults);
    setIsFixing(false);
  };

  return (
    <div className="p-6 bg-gray-100 rounded-lg">
      <h2 className="text-xl font-bold mb-4">🔧 UserId Field Repair Tool</h2>
      <p className="mb-4 text-gray-600">
        This tool will add missing userId fields to your Firestore documents to fix permission errors.
      </p>
      
      <button
        onClick={fixUserIds}
        disabled={isFixing || !user}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {isFixing ? '🔄 Fixing...' : '🛠️ Fix Missing UserIds'}
      </button>

      {results.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Results:</h3>
          <pre className="bg-black text-green-400 p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {results.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
};

export default UserIdFixer;
