// Query all tasks and sessions for a user (top-level collections)
// Usage: node admin-scripts/query-user-data.js user@example.com

const admin = require("firebase-admin");
const fs = require("fs");

function getCredentialHint() {
  const adcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (adcPath) {
    const exists = fs.existsSync(adcPath);
    return `${exists ? "Found" : "Could not find"} GOOGLE_APPLICATION_CREDENTIALS at ${adcPath}. Make sure it points to a readable service account JSON file.`;
  }

  return "No GOOGLE_APPLICATION_CREDENTIALS env var detected. Set it to a service account JSON path or run `gcloud auth application-default login` to provide ADC.";
}

function initializeFirebaseApp() {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (err) {
    const hint = getCredentialHint();
    throw new Error(`${err.message}\n${hint}`);
  }
}

// Initialize with ADC. Replace with credential.cert(serviceAccount) if needed.
initializeFirebaseApp();

const db = admin.firestore();

async function queryUserData(customerEmail) {
  try {
    const { uid, email } = await admin.auth().getUserByEmail(customerEmail);

    const tasksSnap = await db
      .collection("tasks")
      .where("user_uid", "==", uid)
      .get();
    const sessionsSnap = await db
      .collection("sessions")
      .where("user_uid", "==", uid)
      .get();

    return {
      uid,
      email,
      tasks: tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      sessions: sessionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };
  } catch (err) {
    throw attachCredentialHint(err);
  }
}

function attachCredentialHint(err) {
  const isCredentialError =
    err?.errorInfo?.code === "app/invalid-credential" || err?.codePrefix === "app";

  if (!isCredentialError) return err;

  const hint = getCredentialHint();
  if (err.message?.includes(hint)) return err;

  const withHint = new Error(`${err.message}\n${hint}`);
  withHint.code = err.code;
  withHint.errorInfo = err.errorInfo;
  withHint.codePrefix = err.codePrefix;
  return withHint;
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
