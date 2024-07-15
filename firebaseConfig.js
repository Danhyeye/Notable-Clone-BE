import firebase from 'firebase/app';
import 'firebase/auth';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const signInAndGetToken = async (email, password) => {
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        const token = await firebase.auth().currentUser.getIdToken(/* forceRefresh */ true);
        console.log('ID Token:', token);
        return token;
    } catch (error) {
        console.error('Error getting ID token:', error);
    }
};

// Example usage
signInAndGetToken('trancongdanhyeye@gmail.com', 'danhyeye');
