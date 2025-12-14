// // delete-unassigned-sessions.js
// // 一次性删除所有 taskId == null 的 sessions

// const admin = require("firebase-admin");

// // 如果你用 gcloud auth application-default login：
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
// });

// // 如果你是用 serviceAccount json，就换成：
// // const serviceAccount = require("./serviceAccountKey.json");
// // admin.initializeApp({
// //   credential: admin.credential.cert(serviceAccount),
// // });

// const db = admin.firestore();

// async function deleteAllUnassignedSessions(batchSize = 400) {
//   let totalDeleted = 0;

//   while (true) {
//     const snap = await db
//       .collectionGroup("sessions")      // users/{uid}/sessions
//       .where("taskId", "==", null)     // 只找 taskId 为 null 的
//       .limit(batchSize)
//       .get();

//     if (snap.empty) {
//       console.log("✔ 没有更多 taskId = null 的 sessions 了");
//       break;
//     }

//     const batch = db.batch();
//     snap.docs.forEach((doc) => {
//       batch.delete(doc.ref);
//     });

//     await batch.commit();

//     totalDeleted += snap.size;
//     console.log(`本轮删除 ${snap.size} 条，累计删除 ${totalDeleted} 条`);
//   }

//   console.log("🎉 全部删除完成！");
// }

// deleteAllUnassignedSessions()
//   .then(() => process.exit(0))
//   .catch((err) => {
//     console.error("删除过程中出错：", err);
//     process.exit(1);
//   });
