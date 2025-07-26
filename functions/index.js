/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeApp } from "firebase/app";

// Your Firebase config
const firebaseConfig = {
  // ... your config here ...
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const createUser = httpsCallable(functions, "createUser");

async function handleSignup(formData) {
  try {
    const result = await createUser(formData);
    if (result.data.status === 1) {
      // Success! You can now log in the user, show a message, etc.
      alert("Account created! Please log in.");
    } else {
      alert("Account creation failed.");
    }
  } catch (error) {
    // Handle error (e.g., show error message)
    alert(error.message || "Signup failed.");
  }
}
