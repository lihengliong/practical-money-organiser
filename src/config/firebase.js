// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth} from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAQjKinU2gZxJwljG9DdktxGwmEYw1BTGM",
  authDomain: "practical-money-organiser.firebaseapp.com",
  projectId: "practical-money-organiser",
  storageBucket: "practical-money-organiser.firebasestorage.app",
  messagingSenderId: "920772146039",
  appId: "1:920772146039:web:ca9914f55e98cede3ca772",
  measurementId: "G-7W073WBRTJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const auth = getAuth(app)