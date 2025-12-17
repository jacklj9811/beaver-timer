// Query all tasks and sessions for a user (top-level collections)
// Usage: node admin-scripts/query-user-data.js user@example.com

const admin = require("firebase-admin");

// Initialize with ADC. Replace with credential.cert(serviceAccount) if needed.
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function queryUserData(customerEmail) {
  const { uid, email } = await admin.auth().getUserByEmail(customerEmail);

  const tasksSnap = await db.collection("tasks").where("user_uid", "==", uid).get();
  const sessionsSnap = await db.collection("sessions").where("user_uid", "==", uid).get();

  return {
    uid,
    email,
    tasks: tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    sessions: sessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
}

if (require.main === module) {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide customerEmail. Example: node admin-scripts/query-user-data.js user@example.com");
    process.exit(1);
  }

  queryUserData(email)
    .then((result) => {
      console.log(`Queried data for ${result.email} (${result.uid}):`);
      console.log(JSON.stringify({ tasks: result.tasks, sessions: result.sessions }, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to query user data:", err);
      process.exit(1);
    });
}

module.exports = { queryUserData };
