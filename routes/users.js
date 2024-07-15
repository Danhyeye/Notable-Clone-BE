require('dotenv').config();
const express = require('express');
const router = express.Router();
const admin = require('../firebaseAdmin');
const pool = require('../db');
const jwt = require('jsonwebtoken');

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const JWT_SECRET = process.env.JWT_SECRET;

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);

router.post('/register', async (req, res) => {
    const { email, username, password, phone_number } = req.body;
    try {
        const userRecord = await admin.auth().createUser({
            email,
            password
        });
        const [result] = await pool.query(
            'INSERT INTO users (email, username, phone_number, password) VALUES (?, ?, ?, ?)',
            [email, username, phone_number, password]
        );
        const userId = result.insertId;

        res.json({ message: 'User registered successfully', user: { uid: userId, ...userRecord } });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(400).json({ error: error.message });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const auth = getAuth(firebaseApp);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await userCredential.user.getIdToken(true);
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userIdFromFirebase = decodedToken.uid;

        const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (!rows || rows.length === 0) {
            throw new Error('User not found in MySQL database');
        }
        const userId = rows[0].id;
        const token = jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.json({ message: 'Login successful', token, id: userId });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(400).json({ error: error.message });
    }
});


router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const link = await admin.auth().generatePasswordResetLink(email);
        await sendResetPasswordEmail(email, link);
        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/check-auth', async (req, res) => {
    const { token } = req.body;
    try {
        const decodedToken = jwt.verify(token, JWT_SECRET);
        res.json({ loggedIn: true, user: decodedToken });
    } catch (error) {
        res.status(400).json({ loggedIn: false, error: error.message });
    }
});

router.get('/user', async (req, res) => {
    const idToken = req.headers.authorization && req.headers.authorization.split(' ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const [rows] = await pool.query('SELECT * FROM users WHERE firebase_id = ?', [userId]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

module.exports = router;
