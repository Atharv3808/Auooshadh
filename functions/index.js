const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// Example Protected Operation: Admin Approval Escalation
// This function could be exposed via HTTPS callable to ensure only an admin
// can approve a doctor's account robustly.
exports.approveDoctor = functions.https.onCall(async (data, context) => {
  // Check auth
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated users can call this function."
    );
  }

  // Verify caller is admin
  const callerSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!callerSnap.exists || callerSnap.data().role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only administrators can approve doctors."
    );
  }

  const { doctorId } = data;
  if (!doctorId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with a valid 'doctorId'."
    );
  }

  // Update status
  try {
    await admin.firestore().collection("users").doc(doctorId).update({
      status: "approved",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedBy: context.auth.uid
    });
    return { success: true, message: "Doctor approved successfully." };
  } catch (error) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// Other functions:
// exports.generatePDFTrigger = ...
// exports.secureAlertValidation = ...
